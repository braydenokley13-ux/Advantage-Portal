/**
 * Server-only helpers shared by the league API routes.
 *
 * Two concerns live here: authorizing a board member (leader/admin) for the
 * admin-driven routes, and computing a writer's live standing (total points +
 * leaderboard rank) for the celebratory emails. Both are pure of any email or
 * HTTP concern so the routes stay thin.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";
import type { Standing } from "./emails";

type BoardAuth =
  | { ok: true; userId: string; role: Role }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Authorize the caller as a board member. Resolves the Supabase auth session
 * via the cookie-bound server client, then confirms the user is an active
 * leader/admin in `public.users`. Returns a discriminated result the route
 * turns into a 401/403 — it never throws.
 */
export async function requireBoardMember(): Promise<BoardAuth> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, status: 401, error: "Supabase is not configured." };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: "Sign in first." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  const row = profile as { role: Role; active: boolean } | null;
  if (!row || !row.active) {
    return { ok: false, status: 403, error: "Your account is not active." };
  }
  if (row.role !== "leader" && row.role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Only board members (leaders and admins) can manage the league.",
    };
  }

  return { ok: true, userId: user.id, role: row.role };
}

/**
 * Compute a writer's current standing: their total points and their rank
 * (1-based; ties share the better rank). Uses two cheap aggregate queries so it
 * scales to hundreds of writers without loading the whole table.
 */
export async function computeStanding(
  admin: SupabaseClient,
  writerId: string
): Promise<Standing> {
  const { data: mine } = await admin
    .from("league_points")
    .select("total_points")
    .eq("writer_id", writerId)
    .maybeSingle();

  const total = (mine as { total_points: number } | null)?.total_points ?? 0;

  // Rank = (writers strictly ahead) + 1.
  const { count } = await admin
    .from("league_points")
    .select("writer_id", { count: "exact", head: true })
    .gt("total_points", total);

  return { totalPoints: total, rank: (count ?? 0) + 1 };
}
