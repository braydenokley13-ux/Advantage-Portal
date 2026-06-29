/**
 * Writers League — record weekly awards (board only).
 *
 * The board submits up to three winners for a given week (Best Argument, Best
 * Use of Data, Editor's Pick). Inserting each row fires a database trigger that
 * awards 50 points and records an "award" point event — no manual point entry.
 * Afterwards we email each winner their congratulations (CC journal) and send
 * the journal a single summary listing all winners and their new totals.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailWeeklyAwards } from "@/lib/league/emails";
import { computeStanding, requireBoardMember } from "@/lib/league/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LeagueAwardType } from "@/lib/league/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const AwardsRequest = z.object({
  // ISO date (YYYY-MM-DD) the awards are "for".
  weekOf: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "weekOf must be a YYYY-MM-DD date.")
    .optional(),
  winners: z
    .array(
      z.object({
        writerId: z.string().uuid(),
        awardType: z.enum([
          "best_argument",
          "best_use_of_data",
          "editors_pick",
        ]),
      })
    )
    .min(1)
    .max(3),
});

type WriterRow = { id: string; name: string; email: string };

export async function POST(req: NextRequest) {
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

  const parsed = AwardsRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide 1–3 winners, each with a writer and award type." },
      { status: 400 }
    );
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

  const weekOf = parsed.data.weekOf ?? new Date().toISOString().slice(0, 10);

  // Insert all awards in one shot; each row triggers its own +50 point event.
  const { error: insertError } = await admin.from("weekly_awards").insert(
    parsed.data.winners.map((w) => ({
      writer_id: w.writerId,
      award_type: w.awardType,
      week_of: weekOf,
    }))
  );

  if (insertError) {
    console.error("[league-awards] Insert failed:", insertError);
    return NextResponse.json(
      { error: "Could not record the awards." },
      { status: 500 }
    );
  }

  // Resolve winner contact details for the emails.
  const writerIds = [...new Set(parsed.data.winners.map((w) => w.writerId))];
  const { data: writersData } = await admin
    .from("writers")
    .select("id, name, email")
    .in("id", writerIds);
  const writerById = new Map(
    ((writersData ?? []) as WriterRow[]).map((w) => [w.id, w])
  );

  // Compute each winner's standing AFTER the points landed.
  const winners = [];
  for (const w of parsed.data.winners) {
    const writer = writerById.get(w.writerId);
    if (!writer) continue;
    const standing = await computeStanding(admin, w.writerId);
    winners.push({
      writerName: writer.name,
      writerEmail: writer.email,
      awardType: w.awardType as LeagueAwardType,
      standing,
    });
  }

  const email = await emailWeeklyAwards({ weekOf, winners });

  return NextResponse.json({ ok: true, weekOf, awarded: winners.length, email });
}
