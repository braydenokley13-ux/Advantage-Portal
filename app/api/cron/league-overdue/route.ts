/**
 * Writers League — overdue submission cron.
 *
 * Scheduled for 08:00 (see vercel.json). Scans every submission still "under
 * review" and, based on how long it's been waiting, nudges the right people:
 *   • > 5 days  → reminder to the assigned editor
 *   • > 7 days  → escalation to the league inbox
 *   • ≥ 10 days → urgent escalation to the league inbox
 *
 * The send/no-send decision (including the "never twice in one day" rule) lives
 * in the pure {@link scanOverdueSubmissions} scanner; this route is the shell
 * that loads rows, sends the emails, and stamps the matching `*_sent_at` column
 * so the same nudge never repeats that day.
 *
 * Protect it with CRON_SECRET, sent as `Authorization: Bearer <CRON_SECRET>`
 * (Vercel Cron does this automatically) or `?secret=<CRON_SECRET>`.
 */
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { boardMemberEmail } from "@/lib/league/config";
import {
  emailOverdueEditorReminder,
  emailOverdueEscalation,
} from "@/lib/league/emails";
import {
  scanOverdueSubmissions,
  type OverdueSubmissionInput,
} from "@/lib/league/overdue";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Raw row shape from the under-review query (writers embedded for the name).
type Row = {
  id: string;
  article_title: string;
  google_doc_link: string;
  assigned_editor: string;
  submission_date: string;
  reminder_sent_at: string | null;
  escalation_sent_at: string | null;
  urgent_escalation_sent_at: string | null;
  writers: { name: string } | null;
};

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[league-overdue] CRON_SECRET is not set");
    return NextResponse.json({ error: "Cron is not configured." }, { status: 500 });
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
      { error: "Overdue scan needs Supabase mode with a service-role key." },
      { status: 400 }
    );
  }

  // Only under-review pieces can be overdue.
  const { data, error } = await admin
    .from("league_submissions")
    .select(
      "id, article_title, google_doc_link, assigned_editor, submission_date, reminder_sent_at, escalation_sent_at, urgent_escalation_sent_at, writers(name)"
    )
    .eq("status", "under_review");

  if (error) {
    console.error("[league-overdue] Load failed:", error);
    return NextResponse.json({ error: "Could not load submissions." }, { status: 500 });
  }

  // supabase-js types to-one embeds as arrays; PostgREST returns a single
  // object for the foreign-key embed — cast through `unknown` to the real shape.
  const rows = (data ?? []) as unknown as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const scannerInput: OverdueSubmissionInput[] = rows.map((r) => ({
    id: r.id,
    article_title: r.article_title,
    assigned_editor: r.assigned_editor,
    submission_date: r.submission_date,
    reminder_sent_at: r.reminder_sent_at,
    escalation_sent_at: r.escalation_sent_at,
    urgent_escalation_sent_at: r.urgent_escalation_sent_at,
    writer_name: r.writers?.name ?? "the writer",
  }));

  const now = new Date();
  const actions = scanOverdueSubmissions(scannerInput, now);

  let emailed = 0;
  let stamped = 0;
  let skippedNoEditorEmail = 0;

  for (const action of actions) {
    const row = byId.get(action.submissionId);
    if (!row) continue;

    if (action.tier === "reminder") {
      // Reminder goes to the assigned editor; resolve their email from config.
      const editorEmail = boardMemberEmail(action.assignedEditor);
      if (!editorEmail) {
        // Unknown editor — can't deliver; leave the column unstamped so it can
        // send once the board roster is corrected.
        skippedNoEditorEmail += 1;
        console.warn(
          `[league-overdue] No email for editor "${action.assignedEditor}" — reminder skipped.`
        );
        continue;
      }
      const result = await emailOverdueEditorReminder({
        editorName: action.assignedEditor,
        editorEmail,
        writerName: action.writerName,
        articleTitle: action.articleTitle,
        daysWaiting: action.daysOverdue,
        googleDocLink: row.google_doc_link,
      });
      if (result.skipped) continue; // email not configured — retry next run
      emailed += result.sent;
    } else {
      // Escalation / urgent → the league inbox.
      const result = await emailOverdueEscalation({
        writerName: action.writerName,
        articleTitle: action.articleTitle,
        assignedEditor: action.assignedEditor,
        daysOverdue: action.daysOverdue,
        urgent: action.tier === "urgent",
      });
      if (result.skipped) continue;
      emailed += result.sent;
    }

    // Stamp the de-dupe column so this tier won't fire again today.
    const { error: stampError } = await admin
      .from("league_submissions")
      .update({ [action.sentColumn]: now.toISOString() })
      .eq("id", action.submissionId);
    if (stampError) {
      console.error("[league-overdue] Stamp failed:", stampError);
    } else {
      stamped += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    actions: actions.length,
    emailed,
    stamped,
    skippedNoEditorEmail,
  });
}

// Vercel Cron issues a GET; external schedulers may POST. Both run the scan.
export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
