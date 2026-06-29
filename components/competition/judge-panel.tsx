"use client";

import { useState } from "react";
import { Loader2, Check, EyeOff, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useApiClient } from "@/lib/api/provider";
import { useRole } from "@/lib/role-context";
import { COMPETITION_RUBRIC, RUBRIC_MAX, judgingIsBlind } from "@/lib/competition";
import type {
  CompetitionEntryZ,
  CompetitionScoreZ,
  CompetitionZ,
  UserZ,
} from "@/lib/contracts";

export function JudgePanel({
  competition,
  entries,
  scores,
  users,
  onScored,
}: {
  competition: CompetitionZ;
  entries: CompetitionEntryZ[];
  scores: CompetitionScoreZ[];
  users: UserZ[];
  onScored?: () => void;
}) {
  const { user } = useRole();
  const blind = judgingIsBlind(competition);
  const live = entries.filter((e) => e.status !== "withdrawn");

  if (live.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No entries to judge yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {blind && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5" /> Anonymous judging is on — author
          names are hidden until the winner is announced.
        </div>
      )}
      {live.map((entry, i) => (
        <EntryScoreCard
          key={entry.id}
          index={i + 1}
          entry={entry}
          author={users.find((u) => u.id === entry.authorId)}
          blind={blind}
          myScore={scores.find(
            (s) => s.entryId === entry.id && s.judgeId === user.id
          )}
          isOwn={entry.authorId === user.id}
          onScored={onScored}
        />
      ))}
    </div>
  );
}

function EntryScoreCard({
  index,
  entry,
  author,
  blind,
  myScore,
  isOwn,
  onScored,
}: {
  index: number;
  entry: CompetitionEntryZ;
  author?: UserZ;
  blind: boolean;
  myScore?: CompetitionScoreZ;
  isOwn: boolean;
  onScored?: () => void;
}) {
  const api = useApiClient();
  const { user } = useRole();
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const c of COMPETITION_RUBRIC) init[c.key] = myScore?.rubric?.[c.key] ?? 0;
    return init;
  });
  const [notes, setNotes] = useState(myScore?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = COMPETITION_RUBRIC.reduce(
    (sum, c) => sum + (values[c.key] ?? 0),
    0
  );

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.upsertScore({
        entryId: entry.id,
        judgeId: user.id,
        score: total,
        rubric: values,
        notes: notes.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onScored?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your score.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{entry.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {blind ? `Entry #${index}` : (author?.name ?? "Unknown")}
            {entry.wordCount ? ` · ${entry.wordCount} words` : ""}
          </p>
        </div>
        {entry.status === "winner" && <Badge variant="success">Winner</Badge>}
        {entry.status === "shortlisted" && (
          <Badge variant="warning">Shortlisted</Badge>
        )}
      </div>

      {entry.type === "google_doc" ? (
        <a
          href={entry.content}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline break-all"
        >
          Open the entry in Google Docs
        </a>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground max-h-48 overflow-y-auto scroll-thin rounded-md bg-secondary/30 p-3">
          {entry.content}
        </p>
      )}

      {isOwn ? (
        <p className="text-xs text-muted-foreground italic">
          This is your entry — you can&apos;t score your own work.
        </p>
      ) : (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {COMPETITION_RUBRIC.map((c) => (
              <div key={c.key} className="space-y-1">
                <Label htmlFor={`${entry.id}-${c.key}`}>{c.label}</Label>
                <Select
                  id={`${entry.id}-${c.key}`}
                  value={String(values[c.key] ?? 0)}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [c.key]: Number(e.target.value),
                    }))
                  }
                >
                  <option value="0">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${entry.id}-notes`}>Notes (optional)</Label>
            <Textarea
              id={`${entry.id}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked, what didn't…"
              className="min-h-[60px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-sm font-medium">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              {total} / {RUBRIC_MAX}
            </span>
            <div className="flex items-center gap-3">
              {error && <span className="text-xs text-red-600">{error}</span>}
              {saved && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
              <Button size="sm" onClick={save} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : myScore ? (
                  "Update score"
                ) : (
                  "Save score"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
