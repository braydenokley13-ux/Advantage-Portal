/**
 * Server-side Supabase client. Lazy-imported by route handlers and server
 * actions only; do not import from a client component.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { resolveDataMode } from "./env";

export async function getSupabaseServerClient() {
  const resolved = resolveDataMode();
  if (resolved.mode !== "supabase" || !resolved.config) return null;
  // Next 15: `cookies()` returns a Promise<ReadonlyRequestCookies>.
  const cookieStore = await cookies();
  return createServerClient(
    resolved.config.url,
    resolved.config.anonKey,
    {
      cookies: {
        getAll: () =>
          cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (toSet) => {
          // In a server component, `set` is a no-op (cookies are read-only)
          // so we silently swallow the call; in route handlers / actions
          // it persists. The supabase/ssr helper expects this shape.
          for (const { name, value, options } of toSet) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {
              // ignore: read-only cookie store in some contexts
            }
          }
        },
      },
    }
  );
}
