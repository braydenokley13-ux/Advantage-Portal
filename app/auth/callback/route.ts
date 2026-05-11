/**
 * OAuth / magic-link callback. Supabase redirects the browser here with a
 * one-time `code` (PKCE) or `token_hash` (OTP), which we exchange for a
 * session cookie before forwarding the user to their intended page.
 *
 * Mock-mode safety: if Supabase env vars are missing we land at /login
 * instead of throwing — the callback is reachable in any deployment.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null): string {
  if (!value) return "/dashboard";
  // Only allow same-origin relative paths so an open-redirect can't be
  // smuggled through the `next` query parameter.
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  const client = await getSupabaseServerClient();
  if (!client) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      const back = new URL("/login", url.origin);
      back.searchParams.set("error", error.message);
      return NextResponse.redirect(back);
    }
  } else if (tokenHash && type) {
    const { error } = await client.auth.verifyOtp({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      token_hash: tokenHash,
    });
    if (error) {
      const back = new URL("/login", url.origin);
      back.searchParams.set("error", error.message);
      return NextResponse.redirect(back);
    }
  } else {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
