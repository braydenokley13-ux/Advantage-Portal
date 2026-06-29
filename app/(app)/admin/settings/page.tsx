"use client";

/* eslint-disable react-hooks/set-state-in-effect */
// Settings forms sync local draft state from the async-loaded site config —
// the same data-into-state pattern the store provider uses.

import { useEffect, useState } from "react";
import { Palette, ToggleRight, Check, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/ui/states";
import { useRole } from "@/lib/role-context";
import { useSiteConfig } from "@/lib/site-config";
import { canManageSettings } from "@/lib/permissions";
import type { Role } from "@/lib/types";

/** Feature toggles surfaced in the editor. Keys match nav-config `feature`. */
const FEATURES: { key: string; label: string; description: string }[] = [
  {
    key: "competitions",
    label: "Essay competitions",
    description: "Run scored essay competitions with judging and a leaderboard.",
  },
  {
    key: "feedback",
    label: "Feedback",
    description: "Let the team send feedback on anything from the top bar.",
  },
];

export default function SettingsPage() {
  const { role } = useRole();
  const { config, save } = useSiteConfig();

  if (!canManageSettings(role)) {
    return (
      <AccessDenied
        title="Admin access required"
        description="Only admins can change branding, feature toggles, and workflow settings."
      />
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        title="Settings"
        description="Brand the portal, turn features on or off, and tune the workflow — no redeploy needed."
      />
      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">
            <Palette className="mr-1.5 h-4 w-4" /> Branding
          </TabsTrigger>
          <TabsTrigger value="features">
            <ToggleRight className="mr-1.5 h-4 w-4" /> Features
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <BrandingCard config={config} save={save} />
        </TabsContent>
        <TabsContent value="features" className="mt-4">
          <FeaturesCard config={config} save={save} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type CardProps = {
  config: ReturnType<typeof useSiteConfig>["config"];
  save: ReturnType<typeof useSiteConfig>["save"];
};

/** Small hook for a Save button: tracks busy + a transient "Saved" flag. */
function useSaver(run: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await run();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save changes.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, saved, error, onSave };
}

function SaveButton({
  busy,
  saved,
  error,
}: {
  busy: boolean;
  saved: boolean;
  error: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
      </Button>
      {saved && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
          <Check className="h-3.5 w-3.5" /> Saved
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function BrandingCard({ config, save }: CardProps) {
  const [name, setName] = useState(config.brand.name);
  const [tagline, setTagline] = useState(config.brand.tagline);
  const [from, setFrom] = useState(config.brand.accentFrom);
  const [to, setTo] = useState(config.brand.accentTo);

  // Keep the form in sync once the config finishes loading.
  useEffect(() => {
    setName(config.brand.name);
    setTagline(config.brand.tagline);
    setFrom(config.brand.accentFrom);
    setTo(config.brand.accentTo);
  }, [config.brand.name, config.brand.tagline, config.brand.accentFrom, config.brand.accentTo]);

  const saver = useSaver(() =>
    save({
      brand: {
        name: name.trim() || "Advantage",
        tagline: tagline.trim(),
        accentFrom: from,
        accentTo: to,
      },
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          The name, tagline, and accent gradient shown across the portal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            saver.onSave();
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg text-white shadow-soft"
              style={{
                backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
              }}
            >
              <span className="text-lg font-semibold">
                {(name.trim()[0] ?? "A").toUpperCase()}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-semibold leading-tight">{name || "Advantage"}</p>
              <p className="text-xs text-muted-foreground">{tagline}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Name</Label>
              <Input
                id="brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Advantage"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-tagline">Tagline</Label>
              <Input
                id="brand-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Newsroom"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-from">Accent — start</Label>
              <div className="flex items-center gap-2">
                <input
                  id="brand-from"
                  type="color"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background"
                  aria-label="Accent gradient start colour"
                />
                <Input value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-to">Accent — end</Label>
              <div className="flex items-center gap-2">
                <input
                  id="brand-to"
                  type="color"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background"
                  aria-label="Accent gradient end colour"
                />
                <Input value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>

          <SaveButton busy={saver.busy} saved={saver.saved} error={saver.error} />
        </form>
      </CardContent>
    </Card>
  );
}

function FeaturesCard({ config, save }: CardProps) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const f of FEATURES) next[f.key] = config.features[f.key]?.enabled ?? true;
    setEnabled(next);
  }, [config.features]);

  const saver = useSaver(() => {
    const features: Record<string, { enabled: boolean; roles: Role[] }> = {};
    for (const f of FEATURES) {
      features[f.key] = {
        enabled: enabled[f.key] ?? true,
        roles: config.features[f.key]?.roles ?? [
          "writer",
          "editor",
          "leader",
          "admin",
        ],
      };
    }
    return save({ features });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Features</CardTitle>
        <CardDescription>
          Turn optional sections of the portal on or off for everyone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            saver.onSave();
          }}
        >
          <div className="divide-y divide-border rounded-lg border border-border">
            {FEATURES.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
                <Switch
                  checked={enabled[f.key] ?? true}
                  onCheckedChange={(v) =>
                    setEnabled((prev) => ({ ...prev, [f.key]: v }))
                  }
                />
              </div>
            ))}
          </div>
          <SaveButton busy={saver.busy} saved={saver.saved} error={saver.error} />
        </form>
      </CardContent>
    </Card>
  );
}
