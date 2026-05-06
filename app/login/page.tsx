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

  const next = search.get("next") || "/dashboard";

  useEffect(() => {
    if (session.isReady && session.isAuthenticated) {
      router.replace(next);
    }
  }, [session.isReady, session.isAuthenticated, router, next]);

  return (
    <LoginShell mode={session.mode}>
      {session.mode === "supabase" ? (
        <SupabaseAuthForm onSignedIn={() => router.replace(next)} />
      ) : (
        <DemoUserPicker
          onPick={(id) => {
            session.signInAsDemoUser(id);
            router.replace(next);
          }}
        />
      )}
    </LoginShell>
  );
}

// ── Mock-mode demo picker (unchanged) ─────────────────────────────────────
function DemoUserPicker({ onPick }: { onPick: (userId: string) => void }) {
  const demoUsers = useDemoUsers();
  return (
    <Card>
      <CardContent className="p-3">
        <ul className="divide-y divide-border">
          {demoUsers.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onPick(u.id)}
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

// ── Supabase Auth: email+password and magic-link ──────────────────────────
type Pane = "password" | "magic" | "signup";

function SupabaseAuthForm({ onSignedIn }: { onSignedIn: () => void }) {
  const session = useSession();
  const [pane, setPane] = useState<Pane>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setPending(true);
    try {
      if (pane === "password") {
        const { error } = await session.signInWithPassword(email, password);
        if (error) setError(error);
        else onSignedIn();
      } else if (pane === "signup") {
        const { error } = await session.signUpWithPassword(email, password, name);
        if (error) setError(error);
        else
          setInfo(
            "Account created. If email confirmation is required, check your inbox."
          );
      } else {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined;
        const { error } = await session.signInWithMagicLink(email, redirectTo);
        if (error) setError(error);
        else setInfo("Magic link sent. Check your email to finish signing in.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-2 text-xs">
          <PaneButton active={pane === "password"} onClick={() => { setPane("password"); reset(); }}>
            Sign in
          </PaneButton>
          <PaneButton active={pane === "magic"} onClick={() => { setPane("magic"); reset(); }}>
            Magic link
          </PaneButton>
          <PaneButton active={pane === "signup"} onClick={() => { setPane("signup"); reset(); }}>
            Sign up
          </PaneButton>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {pane === "signup" && (
            <div className="space-y-1">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              autoComplete="email"
            />
          </div>
          {pane !== "magic" && (
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={pane === "signup" ? "new-password" : "current-password"}
              />
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          {info && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{info}</p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pane === "magic" ? (
              <>
                <Mail className="h-4 w-4" />
                {pending ? "Sending…" : "Send magic link"}
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                {pending ? "Working…" : pane === "signup" ? "Create account" : "Sign in"}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PaneButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2 py-1 rounded-md transition-colors " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent")
      }
    >
      {children}
    </button>
  );
}

function LoginShell({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode?: "mock" | "supabase";
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
              ? "Sign in with your account, or request a magic link."
              : "Demo sign-in. Pick a user to preview the platform from their seat."}
          </p>
        </div>
        {children}
        <p className="text-center text-[11px] text-muted-foreground">
          {mode === "supabase"
            ? "Sessions are managed by Supabase Auth. Sign out from the avatar menu."
            : "Demo sessions persist via localStorage. Sign out from the avatar menu."}
        </p>
      </div>
    </div>
  );
}
