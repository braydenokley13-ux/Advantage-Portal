"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemoUsers, useSession } from "@/lib/session";
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
    <Suspense fallback={<LoginShell mode="mock">Loading…</LoginShell>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();

  const next = search.get("next") || "/dashboard";

  useEffect(() => {
    if (session.isReady && session.isAuthenticated) {
      router.replace(next);
    }
  }, [session.isReady, session.isAuthenticated, router, next]);

  return (
    <LoginShell mode={session.mode}>
      {session.mode === "supabase" ? (
        <SupabaseLogin next={next} />
      ) : (
        <DemoLogin next={next} />
      )}
    </LoginShell>
  );
}

function DemoLogin({ next }: { next: string }) {
  const router = useRouter();
  const session = useSession();
  const demoUsers = useDemoUsers();

  function pick(userId: string) {
    session.signInAsDemoUser(userId);
    router.replace(next);
  }

  return (
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
  );
}

function SupabaseLogin({ next: _next }: { next: string }) {
  const session = useSession();
  const [tab, setTab] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setPending(true);
    try {
      if (tab === "password") {
        const { error } = await session.signInWithPassword(email, password);
        if (error) setMessage({ kind: "error", text: error });
        // Success: AuthGate-style effect in LoginInner redirects on session change.
      } else {
        const { error } = await session.signInWithMagicLink(email);
        if (error) setMessage({ kind: "error", text: error });
        else
          setMessage({
            kind: "info",
            text: "Check your email for a sign-in link.",
          });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex gap-1 rounded-md bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("password")}
            className={`flex-1 rounded px-3 py-1.5 transition-colors ${
              tab === "password" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Email + password
          </button>
          <button
            type="button"
            onClick={() => setTab("magic")}
            className={`flex-1 rounded px-3 py-1.5 transition-colors ${
              tab === "magic" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Magic link
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-xs font-medium">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="you@school.edu"
            />
          </label>

          {tab === "password" && (
            <label className="block text-xs font-medium">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="••••••••"
              />
            </label>
          )}

          {message && (
            <p
              className={`text-xs ${
                message.kind === "error" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {message.text}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {tab === "password" ? (
              <>
                <LogIn className="h-4 w-4" />
                {pending ? "Signing in…" : "Sign in"}
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                {pending ? "Sending…" : "Send magic link"}
              </>
            )}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground">
          Accounts are admin-provisioned. If you can&apos;t sign in, ask a
          journal lead to invite you from the admin console.
        </p>
      </CardContent>
    </Card>
  );
}

function LoginShell({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: "mock" | "supabase";
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
            {mode === "supabase"
              ? "Sign in to your journal account."
              : "Demo sign-in. Pick a user to preview the platform from their seat."}
          </p>
        </div>
        {children}
        {mode === "mock" && (
          <p className="text-center text-[11px] text-muted-foreground">
            Sessions persist via <code>localStorage</code>. Sign out from the
            avatar menu in the top bar.
          </p>
        )}
      </div>
    </div>
  );
}
