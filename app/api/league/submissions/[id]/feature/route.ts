/**
 * Writers League — mark a piece featured on the homepage (board only).
 *
 * Setting `featured_at` fires a database trigger that awards 25 points and
 * records a "feature" point event. Guarded so a piece is only ever scored once:
 * if it's already featured, this is a no-op. After the points land we email the
 * writer (CC journal) and notify the journal with the live standing.
 */
import { NextRequest, NextResponse } from "next/server";
import { emailFeatured } from "@/lib/league/emails";
import { computeStanding, requireBoardMember } from "@/lib/league/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SubmissionRow = {
  id: string;
  article_title: string;
  featured_at: string | null;
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

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: "The league is not configured." },
      { status: 503 }
    );
  }

  const { data, error } = await admin
    .from("league_submissions")
    .select("id, article_title, featured_at, writer_id, writers(name, email)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[league-feature] Load failed:", error);
    return NextResponse.json({ error: "Could not load submission." }, { status: 500 });
  }
  const submission = data as SubmissionRow | null;
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  // Idempotent: already featured → nothing to score or send.
  if (submission.featured_at) {
    return NextResponse.json({ ok: true, alreadyFeatured: true });
  }

  const { error: updateError } = await admin
    .from("league_submissions")
    .update({ featured_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("[league-feature] Update failed:", updateError);
    return NextResponse.json(
      { error: "Could not feature the submission." },
      { status: 500 }
    );
  }

  let email = null;
  if (submission.writers) {
    const standing = await computeStanding(admin, submission.writer_id);
    email = await emailFeatured({
      writerName: submission.writers.name,
      writerEmail: submission.writers.email,
      articleTitle: submission.article_title,
      standing,
    });
  }

  return NextResponse.json({ ok: true, email });
}
