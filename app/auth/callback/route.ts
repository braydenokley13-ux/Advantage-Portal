/**
 * Supabase Auth callback — completes the magic-link / email-confirm flow.
 *
 * Supabase redirects here with a `code` query param after the user clicks
 * the link in their email. We exchange the code for a session (which sets
 * the auth cookies), then bounce them to the page they were originally
 * trying to reach (or /dashboard).
 *
 * If supabase isn't configured (mock mode), we simply send them to /login.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/dashboard";

  if (!code) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("error", "missing_code");
    return NextResponse.redirect(back);
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("error", error.message);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
