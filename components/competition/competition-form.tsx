"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useApiClient } from "@/lib/api/provider";
import { useRole } from "@/lib/role-context";
import type { CompetitionZ } from "@/lib/contracts";

function toDateInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * Create or edit a competition. Mount with a `key` tied to the competition id
 * (or "new") so the form resets when the target changes.
 */
export function CompetitionFormDialog({
  open,
  onOpenChange,
  competition,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition?: CompetitionZ | null;
  onSaved?: (competition: CompetitionZ) => void;
}) {
  const api = useApiClient();
  const { user } = useRole();
  const editing = !!competition;

  const [title, setTitle] = useState(competition?.title ?? "");
  const [prompt, setPrompt] = useState(competition?.prompt ?? "");
  const [description, setDescription] = useState(competition?.description ?? "");
  const [rules, setRules] = useState(competition?.rules ?? "");
  const [wordLimit, setWordLimit] = useState(
    competition?.wordLimit ? String(competition.wordLimit) : ""
  );
  const [closesAt, setClosesAt] = useState(toDateInput(competition?.closesAt));
  const [anon, setAnon] = useState(competition?.anonymizedJudging ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    if (!title.trim()) {
      setError("Give the competition a title.");
      return;
    }
    if (!closesAt) {
      setError("Set an entry deadline.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const closesIso = new Date(`${closesAt}T23:59:59`).toISOString();
      const wl = wordLimit ? Math.max(1, Number(wordLimit)) : undefined;
      let saved: CompetitionZ;
      if (editing && competition) {
        saved = await api.updateCompetition(competition.id, {
          title: title.trim(),
          prompt,
          description,
          rules,
          wordLimit: wl ?? null,
          closesAt: closesIso,
          anonymizedJudging: anon,
        });
      } else {
        saved = await api.createCompetition({
          title: title.trim(),
          prompt,
          description,
          rules,
          wordLimit: wl,
          closesAt: closesIso,
          anonymizedJudging: anon,
          createdById: user.id,
        });
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the competition.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit competition" : "New essay competition"}
          </DialogTitle>
          <DialogDescription>
            Set the prompt, rules, and deadline. You can open it for entries once
            it&apos;s ready.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-title">Title</Label>
            <Input
              id="c-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spring Voices Essay Prize"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-prompt">Prompt</Label>
            <Textarea
              id="c-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="The question or theme entrants respond to."
              className="min-h-[70px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea
              id="c-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, prizes, who it's for…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-rules">Rules</Label>
            <Textarea
              id="c-rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Eligibility, formatting, originality requirements…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-words">Word limit (optional)</Label>
              <Input
                id="c-words"
                type="number"
                min={1}
                value={wordLimit}
                onChange={(e) => setWordLimit(e.target.value)}
                placeholder="e.g. 800"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-closes">Entry deadline</Label>
              <Input
                id="c-closes"
                type="date"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Anonymous judging</p>
              <p className="text-xs text-muted-foreground">
                Hide author names from judges until the winner is announced.
              </p>
            </div>
            <Switch checked={anon} onCheckedChange={setAnon} />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editing ? (
              "Save changes"
            ) : (
              "Create competition"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
