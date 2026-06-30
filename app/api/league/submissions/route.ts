/**
 * Writers League — submission intake.
 *
 * POST is the public entry point a student uses to submit a piece. It:
 *   1. upserts the writer by email (so the roster grows automatically),
 *   2. assigns a board editor by round-robin rotation,
 *   3. inserts the submission as "under review", and
 *   4. emails the writer a confirmation (CC journal) and the journal a full
 *      notification.
 *
 * Points and audit rows are handled entirely by database triggers on later
 * status changes — this route never touches league_points.
 *
 * Runs on the Node runtime (nodemailer + service-role client) and is never
 * cached.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assignEditorByRotation } from "@/lib/league/assign";
import { emailSubmissionReceived } from "@/lib/league/emails";
import { normalizeEmailAddress } from "@/lib/email/mailer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WriterRow } from "@/lib/league/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SubmissionRequest = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  school: z.string().trim().max(160).optional().default(""),
  grade: z.string().trim().max(40).optional().default(""),
  articleTitle: z.string().trim().min(2).max(200),
  // Accept any http(s) URL — Google Docs links vary in shape.
  googleDocLink: z
    .string()
    .trim()
    .url()
    .max(600)
    .refine((u) => /^https?:\/\//i.test(u), "Link must be an http(s) URL."),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = SubmissionRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Please provide your name, a valid email, an article title, and a Google Doc link.",
      },
      { status: 400 }
    );
  }

  const email = normalizeEmailAddress(parsed.data.email);
  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: "The league is not configured (Supabase service role missing)." },
      { status: 503 }
    );
  }

  // 1. Upsert the writer by email. Only identity fields are written, so an
  //    existing writer's signup_date and is_active are preserved.
  const { data: writerData, error: writerError } = await admin
    .from("writers")
    .upsert(
      {
        name: parsed.data.name,
        email,
        school: parsed.data.school,
        grade: parsed.data.grade,
      },
      { onConflict: "email" }
    )
    .select("id, name, email, school, grade, signup_date, is_active")
    .single();

  if (writerError || !writerData) {
    console.error("[league-submit] Writer upsert failed:", writerError);
    return NextResponse.json(
      { error: "We couldn't save your details. Please try again." },
      { status: 500 }
    );
  }
  const writer = writerData as WriterRow;

  // 2. Assign an editor by rotation, driven by the current submission count.
  const { count } = await admin
    .from("league_submissions")
    .select("id", { count: "exact", head: true });
  const editor = assignEditorByRotation(count ?? 0);

  // 3. Insert the submission. season_id is defaulted to the active season by a
  //    trigger; status defaults to 'under_review'.
  const { data: submission, error: submissionError } = await admin
    .from("league_submissions")
    .insert({
      writer_id: writer.id,
      article_title: parsed.data.articleTitle,
      google_doc_link: parsed.data.googleDocLink,
      assigned_editor: editor.name,
    })
    .select("id, submission_date")
    .single();

  if (submissionError || !submission) {
    console.error("[league-submit] Submission insert failed:", submissionError);
    return NextResponse.json(
      { error: "We couldn't record your submission. Please try again." },
      { status: 500 }
    );
  }

  // 4. Fire the confirmation + notification emails (best-effort).
  const submittedAt = new Date(
    (submission as { submission_date: string }).submission_date
  ).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  const emailResult = await emailSubmissionReceived({
    writerName: writer.name,
    writerEmail: writer.email,
    school: writer.school,
    grade: writer.grade,
    articleTitle: parsed.data.articleTitle,
    googleDocLink: parsed.data.googleDocLink,
    assignedEditor: editor.name,
    submittedAt,
  });

  return NextResponse.json({
    ok: true,
    submissionId: (submission as { id: string }).id,
    assignedEditor: editor.name,
    email: emailResult,
  });
}
