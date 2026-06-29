/**
 * Writers League — submission status change (board only).
 *
 * This is the single funnel for every status transition, so points and emails
 * can never be bypassed:
 *   • The database triggers (migration 0020) award points and flip a writer
 *     active the moment the row reaches "published" — atomic with this update.
 *   • This route sends the matching email afterwards: a celebration on publish
 *     (with live standings) or a warm, feedback-bearing note on rejection.
 *
 * The admin UI calls only this endpoint, so nothing is ever changed silently.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailPublished, emailRejected } from "@/lib/league/emails";
import { computeStanding, requireBoardMember } from "@/lib/league/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const StatusRequest = z.object({
  status: z.enum(["under_review", "approved", "rejected", "published"]),
  /** Optional editor note; surfaced to the writer on rejection. */
  feedback: z.string().trim().max(4000).optional(),
});

type SubmissionRow = {
  id: string;
  status: "under_review" | "approved" | "rejected" | "published";
  article_title: string;
  assigned_editor: string;
  editor_feedback: string | null;
  writer_id: string;
  writers: { name: string; email: string } | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireBoardMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = StatusRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status request." }, { status: 400 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: "The league is not configured." },
      { status: 503 }
    );
  }

  // Load the current row (with the writer) so we know the prior status and have
  // recipient details for the email.
  const { data, error } = await admin
    .from("league_submissions")
    .select(
      "id, status, article_title, assigned_editor, editor_feedback, writer_id, writers(name, email)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[league-status] Load failed:", error);
    return NextResponse.json({ error: "Could not load submission." }, { status: 500 });
  }
  const submission = data as SubmissionRow | null;
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const previousStatus = submission.status;
  const nextStatus = parsed.data.status;
  const feedback = parsed.data.feedback?.trim();

  // Build the patch. A decision (approved/rejected/published) stamps the
  // reviewed date; feedback is only overwritten when supplied.
  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus !== "under_review") {
    patch.reviewed_date = new Date().toISOString();
  }
  if (feedback) {
    patch.editor_feedback = feedback;
  }

  const { error: updateError } = await admin
    .from("league_submissions")
    .update(patch)
    .eq("id", id);

  if (updateError) {
    console.error("[league-status] Update failed:", updateError);
    return NextResponse.json(
      { error: "Could not update the submission status." },
      { status: 500 }
    );
  }

  // Email on the meaningful transitions only (the triggers already moved
  // points). Re-saving the same status is a no-op for mail.
  const writer = submission.writers;
  let email = null;

  if (nextStatus === "published" && previousStatus !== "published" && writer) {
    const standing = await computeStanding(admin, submission.writer_id);
    email = await emailPublished({
      writerName: writer.name,
      writerEmail: writer.email,
      articleTitle: submission.article_title,
      standing,
    });
  } else if (nextStatus === "rejected" && previousStatus !== "rejected" && writer) {
    email = await emailRejected({
      writerName: writer.name,
      writerEmail: writer.email,
      articleTitle: submission.article_title,
      assignedEditor: submission.assigned_editor,
      feedback: feedback ?? submission.editor_feedback ?? undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    previousStatus,
    status: nextStatus,
    email,
  });
}
