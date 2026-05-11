/**
 * Refresh the Supabase auth cookie on every request and bounce
 * unauthenticated traffic out of the protected app shell.
 *
 * The matcher excludes Next internals (`_next/*`), the public auth flow
 * (`/login`, `/auth/*`), and the favicon. Static assets and route handlers
 * for those paths run untouched.
 *
 * In mock mode (no Supabase env vars), the middleware is a no-op —
 * `<AuthGate />` handles redirects on the client.
 */
import { type NextRequest, NextResponse } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/dashboard",
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
  const { response, user, mode } = await updateSupabaseSession(req);

  if (mode !== "supabase") return response;

  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting /login → drop them at /dashboard.
  if (user && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every path except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$).*)",
  ],
};
