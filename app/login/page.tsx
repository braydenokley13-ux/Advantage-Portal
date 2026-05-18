"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemoUsers, useSession } from "@/lib/session";
import { cn, initials } from "@/lib/utils";
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

  const next = search.get("next") || "/dashboard";

  useEffect(() => {
    if (session.isReady && session.isAuthenticated) {
      router.replace(next);
    }
  }, [session.isReady, session.isAuthenticated, router, next]);

  return (
    <LoginShell>
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
    <>
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
      <p className="text-center text-[11px] text-muted-foreground">
        Sessions persist via <code>localStorage</code>. Sign out from the
        avatar menu in the top bar.
      </p>
    </>
  );
}

function SupabaseLogin({ next }: { next: string }) {
  const search = useSearchParams();
  const session = useSession();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    search.get("error") ? "Sign-in link was invalid or expired. Try again." : null
  );
  const [notice, setNotice] = useState<"magic" | "confirm" | null>(null);

  const isSignup = mode === "signup";

  function switchMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setError(null);
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (isSignup) {
      const res = await session.signUp(name.trim(), email.trim(), password);
      setBusy(false);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation) setNotice("confirm");
      // Otherwise a session already exists — the redirect effect handles it.
    } else {
      const res = await session.signInWithPassword(email.trim(), password);
      setBusy(false);
      if (res.error) setError(res.error);
      // On success, onAuthStateChange triggers the redirect effect.
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await session.signInWithMagicLink(email.trim(), next);
    setBusy(false);
    if (res.error) setError(res.error);
    else setNotice("magic");
  }

  if (notice) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <Mail className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-medium">Check your email</p>
          <p className="text-xs text-muted-foreground">
            {notice === "confirm" ? (
              <>
                We sent a confirmation link to <strong>{email}</strong>. Open
                it to activate your account, then come back and sign in.
              </>
            ) : (
              <>
                We sent a sign-in link to <strong>{email}</strong>. Open it on
                this device to finish signing in.
              </>
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                mode === m
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@advantage.org"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={isSignup ? 6 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {isSignup && (
              <p className="text-[11px] text-muted-foreground">
                Use at least 6 characters.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        {!isSignup && (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              OR
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={handleMagicLink}
            >
              <Mail className="h-4 w-4" />
              Email me a sign-in link
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LoginShell({ children }: { children: React.ReactNode }) {
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
            Sign in to access the journal workspace.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
