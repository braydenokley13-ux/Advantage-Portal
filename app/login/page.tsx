"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { isDemoMode, useDemoUsers, useSession } from "@/lib/session";
import { initials } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLE_TONE: Record<Role, "default" | "secondary" | "warning" | "danger"> = {
  writer: "default",
  editor: "secondary",
  leader: "warning",
  admin: "danger",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell>Loading…</LoginShell>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const demoUsers = useDemoUsers();
  const demoEnabled = isDemoMode();

  const next = search.get("next") || "/dashboard";

  useEffect(() => {
    if (session.isReady && session.isAuthenticated) {
      router.replace(next);
    }
  }, [session.isReady, session.isAuthenticated, router, next]);

  function pick(userId: string) {
    if (!demoEnabled) return;
    session.signInAsDemoUser(userId);
    router.replace(next);
  }

  if (!demoEnabled) {
    return (
      <LoginShell demoBadge={false}>
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm font-medium">Sign-in is invite-only.</p>
            <p className="text-xs text-muted-foreground">
              Real authentication ships in the next release. If you should
              have access, ask an admin to send you an invite.
            </p>
          </CardContent>
        </Card>
      </LoginShell>
    );
  }

  return (
    <LoginShell demoBadge>
      <Card>
        <CardContent className="p-3">
          <ul className="divide-y divide-border">
            {demoUsers.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => pick(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email}
                    </p>
                  </div>
                  <Badge variant={ROLE_TONE[u.role]} className="capitalize">
                    {u.role}
                  </Badge>
                  <LogIn className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </LoginShell>
  );
}

function LoginShell({
  children,
  demoBadge = true,
}: {
  children: React.ReactNode;
  demoBadge?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white flex items-center justify-center shadow-soft">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Advantage Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            {demoBadge
              ? "Demo sign-in. Pick a user to preview the platform from their seat. Real auth ships in a later phase."
              : "Welcome. Sign in with the account your team admin set up for you."}
          </p>
        </div>
        {children}
        {demoBadge && (
          <p className="text-center text-[11px] text-muted-foreground">
            Sessions persist via <code>localStorage</code>. Sign out from the
            avatar menu in the top bar.
          </p>
        )}
      </div>
    </div>
  );
}
