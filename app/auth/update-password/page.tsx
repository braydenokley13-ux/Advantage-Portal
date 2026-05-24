"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function UpdatePasswordInner() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setReady(true);
      setHasSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white flex items-center justify-center shadow-soft">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Update password
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose a new password for Advantage Portal.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {!ready ? (
              <p className="text-center text-sm text-muted-foreground">
                Checking your reset link...
              </p>
            ) : success ? (
              <div className="space-y-4 text-center">
                <KeyRound className="mx-auto h-8 w-8 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Password updated</p>
                  <p className="text-xs text-muted-foreground">
                    You can keep working in the portal now.
                  </p>
                </div>
                <Button asChild className="w-full">
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              </div>
            ) : !hasSession ? (
              <div className="space-y-4 text-center">
                <p className="text-sm font-medium">Reset link needed</p>
                <p className="text-xs text-muted-foreground">
                  Open the password reset link from your email first, then this
                  page will let you save a new password.
                </p>
                <Button asChild className="w-full">
                  <Link href="/login">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Saving password..." : "Save new password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <UpdatePasswordInner />
    </Suspense>
  );
}
