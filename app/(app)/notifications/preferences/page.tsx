"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { NOTIFICATION_META, NOTIFICATION_ORDER } from "@/lib/notifications";
import { useRole } from "@/lib/role-context";
import { useSession } from "@/lib/session";
import type { NotificationKind } from "@/lib/types";

type Channel = "in_app" | "push" | "email";
type Prefs = Record<NotificationKind, Record<Channel, boolean>>;

const CHANNELS: { key: Channel; label: string; help: string }[] = [
  { key: "in_app", label: "In-app", help: "Bell and inbox" },
  { key: "push", label: "Push", help: "Mobile + web push" },
  { key: "email", label: "Email", help: "Daily digest" },
];

function defaultPrefs(): Prefs {
  const p = {} as Prefs;
  for (const kind of NOTIFICATION_ORDER) {
    p[kind] = {
      in_app: true,
      push: kind !== "task_complete",
      email: kind === "deadline" || kind === "announcement",
    };
  }
  return p;
}

const STORAGE_KEY = "advantage-portal:notif-prefs";

function readPrefs(key: string): Prefs {
  if (typeof window === "undefined") return defaultPrefs();
  const saved = window.localStorage.getItem(key);
  if (!saved) return defaultPrefs();
  try {
    return { ...defaultPrefs(), ...JSON.parse(saved) };
  } catch {
    return defaultPrefs();
  }
}

export default function NotificationPreferencesPage() {
  const { user } = useRole();
  const session = useSession();
  const key = `${STORAGE_KEY}:${user.id}`;
  const [prefsState, setPrefsState] = useState<{
    key: string;
    prefs: Prefs;
  }>(() => ({ key, prefs: readPrefs(key) }));
  const [testStatus, setTestStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const prefs = prefsState.key === key ? prefsState.prefs : readPrefs(key);

  function update(kind: NotificationKind, channel: Channel, value: boolean) {
    setPrefsState((state) => {
      const current = state.key === key ? state.prefs : readPrefs(key);
      const next: Prefs = {
        ...current,
        [kind]: { ...current[kind], [channel]: value },
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(next));
      }
      return { key, prefs: next };
    });
  }

  async function sendTestEmail() {
    setTestStatus("sending");
    setTestError(null);

    try {
      const res = await fetch("/api/email/notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          kind: "announcement",
          title: "Your Advantage Portal email test worked",
          body: "This confirms app emails can reach your inbox.",
          actionPath: "/notifications/preferences",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "The test email failed.");
      }
      setTestStatus("sent");
    } catch (err) {
      setTestStatus("error");
      setTestError(
        err instanceof Error ? err.message : "The test email failed."
      );
    }
  }

  return (
    <div className="container py-6 md:py-8 space-y-6 max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/notifications">
          <ChevronLeft className="h-4 w-4" /> Back to notifications
        </Link>
      </Button>

      <PageHeader
        title="Notification preferences"
        description="Choose how you want to be reached for each event type."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              <Mail className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Email delivery test</p>
              <p className="text-xs text-muted-foreground">
                Sends a real email to {user.email} so you can confirm the
                portal can reach your inbox.
              </p>
              {session.mode !== "supabase" && (
                <p className="text-xs text-muted-foreground">
                  Real email delivery turns on when the app is running in
                  Supabase mode.
                </p>
              )}
              {testStatus === "sent" && (
                <p className="text-xs font-medium text-emerald-700">
                  Test email sent. Check your inbox.
                </p>
              )}
              {testStatus === "error" && (
                <p className="text-xs font-medium text-destructive">
                  {testError}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={session.mode !== "supabase" || testStatus === "sending"}
            onClick={sendTestEmail}
          >
            {testStatus === "sending" ? "Sending..." : "Send test email"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[1fr,repeat(3,7rem)] items-center gap-3 px-5 py-3 border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Event</span>
            {CHANNELS.map((c) => (
              <span key={c.key} className="text-center">
                {c.label}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {NOTIFICATION_ORDER.map((kind) => {
              const meta = NOTIFICATION_META[kind];
              const Icon = meta.icon;
              return (
                <li
                  key={kind}
                  className="grid grid-cols-1 md:grid-cols-[1fr,repeat(3,7rem)] items-center gap-3 px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${meta.tone}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  {CHANNELS.map((c) => (
                    <div
                      key={c.key}
                      className="flex md:justify-center items-center gap-2"
                    >
                      <span className="md:hidden text-xs text-muted-foreground w-16">
                        {c.label}
                      </span>
                      <Switch
                        checked={prefs[kind]?.[c.key] ?? false}
                        onCheckedChange={(v) => update(kind, c.key, v)}
                      />
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-1">
        <p className="text-xs font-medium">How we keep this quiet</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Identical alerts are deduped within a short window so you don&apos;t get
          pinged three times for the same thing across in-app, push, and email.
          You can mute any event type per channel above. Preferences are stored
          locally for this demo session.
        </p>
      </div>
    </div>
  );
}
