"use client";

/* eslint-disable react-hooks/set-state-in-effect */
// Settings forms sync local draft state from the async-loaded site config —
// the same data-into-state pattern the store provider uses.

import { useEffect, useState } from "react";
import {
  Palette,
  ToggleRight,
  Check,
  Loader2,
  KanbanSquare,
  ListChecks,
  Bell,
  Plus,
  Trash2,
} from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/ui/states";
import { useRole } from "@/lib/role-context";
import { useSiteConfig } from "@/lib/site-config";
import { useStatusDefinitions } from "@/lib/use-status";
import { canManageSettings } from "@/lib/permissions";
import { STATUS_ORDER } from "@/lib/kanban-rules";
import { DEFAULT_CHECKLIST_TEMPLATE } from "@/lib/checklist-template";
import { NOTIFICATION_META, NOTIFICATION_ORDER } from "@/lib/notifications";
import { effectiveEmailDefault } from "@/lib/notification-policy";
import type { Role, ChecklistGroup } from "@/lib/types";

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
        <TabsList className="flex-wrap">
          <TabsTrigger value="branding">
            <Palette className="mr-1.5 h-4 w-4" /> Branding
          </TabsTrigger>
          <TabsTrigger value="features">
            <ToggleRight className="mr-1.5 h-4 w-4" /> Features
          </TabsTrigger>
          <TabsTrigger value="statuses">
            <KanbanSquare className="mr-1.5 h-4 w-4" /> Statuses
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ListChecks className="mr-1.5 h-4 w-4" /> Checklist
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 h-4 w-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <BrandingCard config={config} save={save} />
        </TabsContent>
        <TabsContent value="features" className="mt-4">
          <FeaturesCard config={config} save={save} />
        </TabsContent>
        <TabsContent value="statuses" className="mt-4">
          <StatusesCard save={save} />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4">
          <ChecklistCard config={config} save={save} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsCard save={save} />
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

type BadgeTone = "default" | "secondary" | "warning" | "success";

type StatusForm = {
  label: string;
  description: string;
  badgeTone: BadgeTone;
  writer: string;
  editor: string;
  leader: string;
};

function StatusesCard({ save }: { save: CardProps["save"] }) {
  const defs = useStatusDefinitions();
  const seed = () => {
    const out: Record<string, StatusForm> = {};
    for (const s of STATUS_ORDER) {
      const d = defs[s];
      out[s] = {
        label: d.label,
        description: d.description,
        badgeTone: d.badgeTone,
        writer: d.nextAction.writer,
        editor: d.nextAction.editor,
        leader: d.nextAction.leader,
      };
    }
    return out;
  };
  const [form, setForm] = useState<Record<string, StatusForm>>(seed);
  useEffect(() => setForm(seed()), [defs]); // eslint-disable-line

  const saver = useSaver(() => {
    const statuses: Record<string, Omit<StatusForm, "writer" | "editor" | "leader"> & {
      nextAction: { writer: string; editor: string; leader: string };
    }> = {};
    for (const s of STATUS_ORDER) {
      const f = form[s];
      statuses[s] = {
        label: f.label,
        description: f.description,
        badgeTone: f.badgeTone,
        nextAction: { writer: f.writer, editor: f.editor, leader: f.leader },
      };
    }
    return save({ statuses });
  });

  function patch(status: string, key: keyof StatusForm, value: string) {
    setForm((prev) => ({ ...prev, [status]: { ...prev[status], [key]: value } }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task statuses</CardTitle>
        <CardDescription>
          Rename the four workflow statuses and tune their colour and next-step
          copy. The underlying workflow stays the same.
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
          {STATUS_ORDER.map((s) => {
            const f = form[s];
            if (!f) return null;
            return (
              <div key={s} className="rounded-lg border border-border p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={f.label}
                      onChange={(e) => patch(s, "label", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Badge colour</Label>
                    <Select
                      value={f.badgeTone}
                      onChange={(e) => patch(s, "badgeTone", e.target.value)}
                    >
                      <option value="secondary">Grey</option>
                      <option value="default">Blue</option>
                      <option value="warning">Amber</option>
                      <option value="success">Green</option>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={f.description}
                    onChange={(e) => patch(s, "description", e.target.value)}
                    className="min-h-[50px]"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Writer next step</Label>
                    <Input
                      value={f.writer}
                      onChange={(e) => patch(s, "writer", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Editor next step</Label>
                    <Input
                      value={f.editor}
                      onChange={(e) => patch(s, "editor", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Leader next step</Label>
                    <Input
                      value={f.leader}
                      onChange={(e) => patch(s, "leader", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <SaveButton busy={saver.busy} saved={saver.saved} error={saver.error} />
        </form>
      </CardContent>
    </Card>
  );
}

type ChecklistFormItem = {
  key: string;
  label: string;
  group: ChecklistGroup;
  required: boolean;
};

const CHECKLIST_GROUPS: { group: ChecklistGroup; label: string }[] = [
  { group: "general", label: "General (every story)" },
  { group: "business", label: "Business / markets stories" },
  { group: "sensitive", label: "Sensitive stories" },
];

function ChecklistCard({ config, save }: CardProps) {
  const seed = () => {
    const out: Record<ChecklistGroup, ChecklistFormItem[]> = {
      general: [],
      business: [],
      sensitive: [],
    };
    for (const { group } of CHECKLIST_GROUPS) {
      const items =
        config.checklistTemplate?.[group] ?? DEFAULT_CHECKLIST_TEMPLATE[group];
      out[group] = items.map((i) => ({ ...i, group }));
    }
    return out;
  };
  const [groups, setGroups] = useState<Record<ChecklistGroup, ChecklistFormItem[]>>(
    seed
  );
  const [seq, setSeq] = useState(0);
  useEffect(() => setGroups(seed()), [config.checklistTemplate]); // eslint-disable-line

  const saver = useSaver(() =>
    save({
      checklistTemplate: {
        general: groups.general,
        business: groups.business,
        sensitive: groups.sensitive,
      },
    })
  );

  function update(group: ChecklistGroup, key: string, patch: Partial<ChecklistFormItem>) {
    setGroups((prev) => ({
      ...prev,
      [group]: prev[group].map((i) => (i.key === key ? { ...i, ...patch } : i)),
    }));
  }
  function remove(group: ChecklistGroup, key: string) {
    setGroups((prev) => ({
      ...prev,
      [group]: prev[group].filter((i) => i.key !== key),
    }));
  }
  function add(group: ChecklistGroup) {
    const key = `${group[0]}_custom_${seq}`;
    setSeq((n) => n + 1);
    setGroups((prev) => ({
      ...prev,
      [group]: [...prev[group], { key, label: "", group, required: true }],
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editorial checklist</CardTitle>
        <CardDescription>
          The quality gates seeded onto every story. Edits apply to newly seeded
          checklists.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            saver.onSave();
          }}
        >
          {CHECKLIST_GROUPS.map(({ group, label }) => (
            <div key={group} className="space-y-2">
              <p className="text-sm font-medium">{label}</p>
              <div className="space-y-2">
                {groups[group].map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <Input
                      value={item.label}
                      onChange={(e) =>
                        update(group, item.key, { label: e.target.value })
                      }
                      placeholder="Checklist item…"
                    />
                    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <Switch
                        checked={item.required}
                        onCheckedChange={(v) =>
                          update(group, item.key, { required: v })
                        }
                      />
                      Required
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(group, item.key)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => add(group)}
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
          ))}
          <SaveButton busy={saver.busy} saved={saver.saved} error={saver.error} />
        </form>
      </CardContent>
    </Card>
  );
}

function NotificationsCard({ save }: { save: CardProps["save"] }) {
  const seed = () => {
    const out: Record<string, boolean> = {};
    for (const kind of NOTIFICATION_ORDER) out[kind] = effectiveEmailDefault(kind);
    return out;
  };
  const [defaults, setDefaults] = useState<Record<string, boolean>>(seed);

  const saver = useSaver(() => save({ notificationDefaults: defaults }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email defaults</CardTitle>
        <CardDescription>
          Which notification kinds email everyone by default. Members can still
          override these on their own preferences page.
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
            {NOTIFICATION_ORDER.map((kind) => (
              <div
                key={kind}
                className="flex items-center justify-between gap-4 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {NOTIFICATION_META[kind].label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {NOTIFICATION_META[kind].description}
                  </p>
                </div>
                <Switch
                  checked={defaults[kind] ?? false}
                  onCheckedChange={(v) =>
                    setDefaults((prev) => ({ ...prev, [kind]: v }))
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
