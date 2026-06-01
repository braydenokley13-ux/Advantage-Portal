"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { isOnboarded } from "@/lib/onboarding";

/**
 * Hard gate for the authenticated app shell. Redirects to /login when the
 * session is empty, and to /welcome when a real (Supabase) user has not yet
 * completed onboarding. Holds the shell behind a spinner until the session
 * and (in Supabase mode) the data store have hydrated, and re-fetches the
 * store on navigation so changes made by other users surface.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isReady, isAuthenticated, currentUser, mode } = useSession();
  const { hydrated, hydrationError, refresh } = useStore();

  const needsOnboarding =
    isReady &&
    isAuthenticated &&
    mode === "supabase" &&
    !!currentUser &&
    !isOnboarded(currentUser.id);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      const next = pathname && pathname !== "/login" ? pathname : "/dashboard";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (needsOnboarding) {
      router.replace("/welcome");
    }
  }, [isReady, isAuthenticated, needsOnboarding, pathname, router]);

  // Re-fetch the store on navigation (Supabase mode only) so a user picks up
  // changes made by others. The store's own hydration effect covers the
  // initial load, so the first pathname render is skipped.
  const firstNav = useRef(true);
  useEffect(() => {
    if (mode !== "supabase" || !isAuthenticated) return;
    if (firstNav.current) {
      firstNav.current = false;
      return;
    }
    refresh();
  }, [pathname, mode, isAuthenticated, refresh]);

  const awaitingData = mode === "supabase" && isAuthenticated && !hydrated;

  if (!isReady || !isAuthenticated || needsOnboarding || awaitingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          {awaitingData ? "Loading portal data…" : "Loading session…"}
        </div>
      </div>
    );
  }

  if (hydrationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-soft">
          <h1 className="text-base font-semibold">Couldn’t load the portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {hydrationError}
          </p>
          <button
            type="button"
            onClick={() => refresh()}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
