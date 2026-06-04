/**
 * Edge middleware — refreshes the Supabase session on every request and
 * bounces unauthenticated traffic away from the protected app shell.
 *
 * Passes through untouched when the Supabase credentials are missing, so a
 * misconfigured deployment surfaces a clear error in-app rather than erroring
 * at the edge.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveDataMode } from "@/lib/supabase/env";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/welcome",
  "/board",
  "/calendar",
  "/messages",
  "/notifications",
  "/announcements",
  "/team",
  "/admin",
  "/tasks",
  "/reviews",
  "/issues",
  "/pitches",
];

export async function middleware(req: NextRequest) {
  const resolved = resolveDataMode();
  if (!resolved.config) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createServerClient(
    resolved.config.url,
    resolved.config.anonKey,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            res.cookies.set({ name, value, ...options });
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (!user && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
