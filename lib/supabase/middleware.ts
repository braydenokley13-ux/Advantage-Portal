/**
 * Edge-middleware Supabase client. Refreshes the auth cookie on every
 * request so the SSR session and the browser stay in sync.
 *
 * Returns:
 *   • response — the (possibly cookie-mutated) NextResponse to forward
 *   • user     — the current Supabase user, or null
 *
 * If env vars are missing or data-mode is "mock", returns `{ response,
 * user: null, mode: "mock" }` so callers can short-circuit.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveDataMode } from "./env";

export async function updateSupabaseSession(req: NextRequest): Promise<{
  response: NextResponse;
  user: { id: string } | null;
  mode: "mock" | "supabase";
}> {
  const response = NextResponse.next({ request: req });
  const resolved = resolveDataMode();
  if (resolved.mode !== "supabase" || !resolved.config) {
    return { response, user: null, mode: "mock" };
  }

  const client = createServerClient(resolved.config.url, resolved.config.anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          response.cookies.set({ name, value, ...options });
        }
      },
    },
  });

  const { data } = await client.auth.getUser();
  return {
    response,
    user: data.user ? { id: data.user.id } : null,
    mode: "supabase",
  };
}
