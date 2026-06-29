"use client";

import { useState } from "react";
import { Loader2, Check, PenLine, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useApiClient } from "@/lib/api/provider";
import { useRole } from "@/lib/role-context";
import { entryStatusLabel, isOpenForEntries } from "@/lib/competition";
import { cn } from "@/lib/utils";
import type { CompetitionEntryZ, CompetitionZ } from "@/lib/contracts";

type EntryType = "inline" | "google_doc";

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function EntryForm({
  competition,
  entry,
  onSaved,
}: {
  competition: CompetitionZ;
  entry: CompetitionEntryZ | null;
  onSaved?: () => void;
}) {
  const api = useApiClient();
  const { user } = useRole();
  const open = isOpenForEntries(competition);

  const [type, setType] = useState<EntryType>(
    entry?.type === "google_doc" ? "google_doc" : "inline"
  );
  const [title, setTitle] = useState(entry?.title ?? "");
  const [inline, setInline] = useState(
    entry && entry.type !== "google_doc" ? entry.content : ""
  );
  const [docUrl, setDocUrl] = useState(
    entry?.type === "google_doc" ? entry.content : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const words = countWords(inline);
  const overLimit =
    type === "inline" &&
    typeof competition.wordLimit === "number" &&
    words > competition.wordLimit;

  // Read-only once the window has closed — show the locked entry instead.
  if (!open) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Your entry</p>
          {entry && (
            <Badge variant="secondary">{entryStatusLabel(entry.status)}</Badge>
          )}
        </div>
        {entry ? (
          <>
            <p className="text-sm font-semibold">{entry.title}</p>
            {entry.type === "google_doc" ? (
              <a
                href={entry.content}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline break-all"
              >
                {entry.content}
              </a>
            ) : (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground line-clamp-6">
                {entry.content}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Entries are closed for this competition.
          </p>
        )}
      </div>
    );
  }

  async function submit() {
    if (busy) return;
    const content = type === "google_doc" ? docUrl.trim() : inline.trim();
    if (!title.trim()) {
      setError("Add a title for your entry.");
      return;
    }
    if (!content) {
      setError(
        type === "google_doc"
          ? "Paste the link to your essay."
          : "Write your essay before submitting."
      );
      return;
    }
    if (overLimit) {
      setError(`You're over the ${competition.wordLimit}-word limit.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        type,
        content,
        wordCount: type === "inline" ? words : undefined,
      };
      if (entry) {
        await api.updateEntry(entry.id, payload);
      } else {
        await api.createEntry({
          competitionId: competition.id,
          authorId: user.id,
          ...payload,
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {entry ? "Edit your entry" : "Enter this competition"}
        </p>
        {entry && (
          <Badge variant="secondary">{entryStatusLabel(entry.status)}</Badge>
        )}
      </div>

      <div className="flex gap-2">
        {(
          [
            { v: "inline", label: "Write here", icon: PenLine },
            { v: "google_doc", label: "Google Doc link", icon: Link2 },
          ] as { v: EntryType; label: string; icon: typeof PenLine }[]
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setType(opt.v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
              type === opt.v
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-accent"
            )}
          >
            <opt.icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entry-title">Title</Label>
        <Input
          id="entry-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Your essay's title"
        />
      </div>

      {type === "inline" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="entry-body">Essay</Label>
            <span
              className={cn(
                "text-[11px]",
                overLimit ? "text-red-600" : "text-muted-foreground"
              )}
            >
              {words} words
              {typeof competition.wordLimit === "number" &&
                ` / ${competition.wordLimit}`}
            </span>
          </div>
          <Textarea
            id="entry-body"
            value={inline}
            onChange={(e) => setInline(e.target.value)}
            placeholder="Write or paste your essay here…"
            className="min-h-[220px]"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="entry-url">Google Doc link</Label>
          <Input
            id="entry-url"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="https://docs.google.com/…"
          />
          <p className="text-[11px] text-muted-foreground">
            Make sure sharing is set so judges can open it.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : entry ? (
            "Update entry"
          ) : (
            "Submit entry"
          )}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
