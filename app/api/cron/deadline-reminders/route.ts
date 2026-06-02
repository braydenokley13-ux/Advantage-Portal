/**
 * Deadline reminder cron.
 *
 * Scans every open task and emails the writer/editor (plus leaders on overdue
 * stories) at the 7-day, 3-day, 1-day, and overdue marks, recording each sent
 * reminder so it never fires twice. Also drops an in-app "deadline"
 * notification so the bell stays in sync.
 *
 * This must be triggered by a scheduler — the app has no always-on worker.
 * See docs/deadline-reminder-emails.md for free scheduling options (Vercel
 * Hobby cron is once-per-day; a GitHub Actions schedule is free and can run
 * hourly). Protect it with CRON_SECRET, sent either as `Authorization: Bearer
 * <CRON_SECRET>` (Vercel Cron does this automatically) or `?secret=<CRON_SECRET>`.
 */
import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/auth/redirects";
import { isCronAuthorized } from "@/lib/cron-auth";
import { scanDeadlineReminders } from "@/lib/deadline-reminders";
import { emailIsConfigured, normalizeEmailAddress, sendEmail } from "@/lib/email/mailer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { notificationEmail } from "@/emails/templates";
import type { Task, User } from "@/lib/types";

// nodemailer needs the Node runtime; force-dynamic stops any caching of the run.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sending happens over SMTP one message at a time; give the batch room to run.
export const maxDuration = 60;

type TaskRow = {
  id: string;
  title: string;
  deadline: string;
  status: Task["status"];
  writer_id: string;
  editor_id: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  active: boolean;
};

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[deadline-cron] CRON_SECRET is not set");
    return NextResponse.json(
      { error: "Cron is not configured." },
      { status: 500 }
    );
  }

  if (
    !isCronAuthorized({
      authorization: req.headers.get("authorization"),
      querySecret: req.nextUrl.searchParams.get("secret"),
      expectedSecret: secret,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Deadline reminders need Supabase mode with a service-role key." },
      { status: 400 }
    );
  }

  // Open tasks + active users — the only inputs the scanner needs.
  const [tasksRes, usersRes, sentRes] = await Promise.all([
    admin
      .from("tasks")
      .select("id, title, deadline, status, writer_id, editor_id")
      .neq("status", "complete"),
    admin.from("users").select("id, name, email, role, active").eq("active", true),
    admin.from("deadline_reminders_sent").select("task_id, kind, user_id"),
  ]);

  if (tasksRes.error || usersRes.error || sentRes.error) {
    console.error(
      "[deadline-cron] Load failed:",
      tasksRes.error ?? usersRes.error ?? sentRes.error
    );
    return NextResponse.json({ error: "Could not load data." }, { status: 500 });
  }

  const taskRows = (tasksRes.data ?? []) as TaskRow[];
  const userRows = (usersRes.data ?? []) as UserRow[];

  const tasks = taskRows.map(
    (t) =>
      ({
        id: t.id,
        title: t.title,
        deadline: t.deadline,
        status: t.status,
        writerId: t.writer_id,
        editorId: t.editor_id ?? undefined,
      }) as Task
  );
  const users = userRows.map(
    (u) =>
      ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
      }) as User
  );
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const issuedKeys = new Set(
    (sentRes.data ?? []).map(
      (r) =>
        `${(r as { task_id: string }).task_id}:${(r as { kind: string }).kind}:${(r as { user_id: string }).user_id}`
    )
  );

  const reminders = scanDeadlineReminders({ tasks, users, issuedKeys });

  if (reminders.length === 0) {
    return NextResponse.json({
      ok: true,
      scannedTasks: tasks.length,
      fired: 0,
      emailed: 0,
    });
  }

  // In-app bell parity: one "deadline" notification per fired reminder.
  const { error: notifyError } = await admin.from("notifications").insert(
    reminders.map((r) => ({
      user_id: r.userId,
      kind: "deadline",
      title: r.title,
      body: r.body,
    }))
  );
  if (notifyError) {
    console.error("[deadline-cron] Notification insert failed:", notifyError);
  }

  const actionUrl = appUrl("/tasks", req);
  const canEmail = emailIsConfigured();
  let emailed = 0;
  let emailFailures = 0;

  if (canEmail) {
    for (const reminder of reminders) {
      const recipient = userById.get(reminder.userId);
      const to = recipient ? normalizeEmailAddress(recipient.email) : null;
      if (!to) continue;
      try {
        await sendEmail({
          to,
          subject: reminder.title,
          html: notificationEmail({
            email: to,
            title: reminder.title,
            body: reminder.body,
            actionUrl,
            actionLabel: "Open in Advantage Portal",
            kindLabel: "Deadline coming up",
          }),
        });
        emailed += 1;
      } catch (err) {
        emailFailures += 1;
        console.error(`[deadline-cron] Email to ${to} failed:`, err);
      }
    }
  }

  // Record every fired reminder so it never repeats, even if its email bounced
  // (the in-app notification already captured it; deadlines aren't retried).
  const { error: sentError } = await admin
    .from("deadline_reminders_sent")
    .upsert(
      reminders.map((r) => ({
        task_id: r.taskId,
        kind: r.kind,
        user_id: r.userId,
      })),
      { onConflict: "task_id,kind,user_id", ignoreDuplicates: true }
    );
  if (sentError) {
    console.error("[deadline-cron] Dedup write failed:", sentError);
  }

  return NextResponse.json({
    ok: true,
    scannedTasks: tasks.length,
    fired: reminders.length,
    emailed,
    emailFailures,
    emailConfigured: canEmail,
  });
}

// Vercel Cron issues a GET; external schedulers may POST. Both run the scan.
export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
