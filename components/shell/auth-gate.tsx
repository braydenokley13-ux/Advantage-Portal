"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

/**
 * Hard gate for the authenticated app shell. Redirects to /login when the
 * session is empty. Renders a minimal spinner during hydration so we don't
 * flash protected content while reading localStorage.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isReady, isAuthenticated } = useSession();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      const next = pathname && pathname !== "/login" ? pathname : "/dashboard";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [isReady, isAuthenticated, pathname, router]);

  if (!isReady || !isAuthenticated) {
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
