import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appUrl, safeNextPath } from "@/lib/auth/redirects";
import { normalizeEmailAddress, sendEmail } from "@/lib/email/mailer";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { notificationEmail } from "@/emails/templates";

const NOTIFICATION_LABELS = {
  task_assigned: "New assignment",
  deadline: "Deadline coming up",
  submission: "Draft submitted",
  comment: "Comments and mentions",
  review_decision: "Editor decision",
  task_complete: "Task wrapped",
  message: "Direct message",
  announcement: "Team announcement",
} as const;

const NotificationEmailRequest = z.object({
  userId: z.string().uuid(),
  kind: z.enum([
    "task_assigned",
    "deadline",
    "submission",
    "comment",
    "review_decision",
    "task_complete",
    "message",
    "announcement",
  ]),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(500).optional(),
  actionPath: z.string().trim().max(300).optional(),
});

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: "writer" | "editor" | "leader" | "admin";
  active: boolean;
};

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Email delivery needs Supabase mode." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = NotificationEmailRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Notification email request is invalid." },
      { status: 400 }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { data: profiles, error: profileError } = await supabase
    .from("users")
    .select("id, name, email, role, active")
    .in("id", [user.id, parsed.data.userId]);

  if (profileError) {
    console.error("[notification-email] Profile lookup failed:", profileError);
    return NextResponse.json({ error: "Could not find profile." }, { status: 500 });
  }

  const rows = (profiles ?? []) as ProfileRow[];
  const actor = rows.find((row) => row.id === user.id);
  const recipient = rows.find((row) => row.id === parsed.data.userId);

  if (!actor || !actor.active) {
    return NextResponse.json({ error: "Sender is not active." }, { status: 403 });
  }
  if (!recipient || !recipient.active) {
    return NextResponse.json(
      { error: "Recipient is not active." },
      { status: 404 }
    );
  }

  // Workspace trust model: any active member may trigger a notification email
  // to another active member. This is required for normal workflow fan-out — a
  // writer submitting a draft notifies their editor, an editor's decision
  // notifies the writer, and so on. Content is constrained by the schema above
  // (enumerated kind, length-capped title/body) and only ever renders as a
  // branded portal notification, so the cross-user path is intentionally open.

  const to = normalizeEmailAddress(recipient.email);
  if (!to) {
    return NextResponse.json(
      { error: "Recipient email address is invalid." },
      { status: 400 }
    );
  }

  const actionPath = parsed.data.actionPath
    ? safeNextPath(parsed.data.actionPath, "/notifications")
    : undefined;
  const actionUrl = actionPath ? appUrl(actionPath, req) : undefined;

  try {
    await sendEmail({
      to,
      subject: parsed.data.title,
      html: notificationEmail({
        email: to,
        title: parsed.data.title,
        body: parsed.data.body,
        actionUrl,
        actionLabel: "Open in Advantage Portal",
        kindLabel: NOTIFICATION_LABELS[parsed.data.kind],
      }),
    });
  } catch (err) {
    console.error("[notification-email] Send failed:", err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
