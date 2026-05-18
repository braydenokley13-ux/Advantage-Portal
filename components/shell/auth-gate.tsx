"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";

/**
 * Hard gate for the authenticated app shell. Redirects to /login when the
 * session is empty, and to /welcome when a real (Supabase) user has not yet
 * completed onboarding. Renders a minimal spinner during hydration so we
 * don't flash protected content while reading persisted state.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isReady, isAuthenticated, currentUser, mode } = useSession();

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

  if (!isReady || !isAuthenticated || needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Loading session…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
