"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useApiClient } from "@/lib/api/provider";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import type { SensitiveReason, Task } from "@/lib/types";
import { format } from "date-fns";

const REASON_LABEL: Record<SensitiveReason, string> = {
  student_privacy: "Student privacy",
  politics: "Politics / geopolitics",
  financial_claims: "Financial claims",
  allegations: "Allegations / accusations",
  medical_or_mental_health: "Medical / mental health",
  other: "Other sensitive issue",
};

/**
 * Editorial-safety panel for the story drawer. Reasonable people may
 * disagree about whether a piece is sensitive — the bar to raise is low,
 * the bar to clear is leader/admin only. This is distinct from message
 * moderation (which lives at /admin/moderation).
 */
export function SensitivePanel({
  task,
  onChanged,
}: {
  task: Task;
  /** Called after a successful raise / clear / hold so the parent drawer
   *  can refetch the task and any dependent resources (checklist gets
   *  the sensitive group seeded on raise). */
  onChanged?: () => void;
}) {
  const api = useApiClient();
  // Users stays on the store for the sync name lookup.
  const { users } = useStore();
  const { user, role } = useRole();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<SensitiveReason>("student_privacy");
  const [notes, setNotes] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDecide = role === "leader" || role === "admin";
  const canRaise = !task.sensitive;

  async function runDecision(
    status: "cleared" | "holding",
    note?: string
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.decideSensitiveFlag({
        taskId: task.id,
        decidedById: user.id,
        status,
        note,
      });
      onChanged?.();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't update that flag. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function runRaise() {
    if (busy || !notes.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.raiseSensitiveFlag({
        taskId: task.id,
        raisedById: user.id,
        reason,
        notes: notes.trim(),
      });
      setOpen(false);
      setNotes("");
      onChanged?.();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't raise that flag. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (task.sensitive) {
    const f = task.sensitive;
    const raisedBy = users.find((u) => u.id === f.raisedById);
    const decidedBy = users.find((u) => u.id === f.decidedById);
    const tone =
      f.status === "open"
        ? "border-red-300/70 bg-red-50/70"
        : f.status === "holding"
          ? "border-amber-300/70 bg-amber-50/70"
          : "border-emerald-300/70 bg-emerald-50/70";

    return (
      <div className={`rounded-lg border p-3 space-y-2 ${tone}`}>
        <div className="flex items-center gap-2">
          {f.status === "cleared" ? (
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-red-700" />
          )}
          <p className="text-sm font-medium">
            Sensitive story — {REASON_LABEL[f.reason]}
          </p>
        </div>
        <p className="text-xs">{f.notes}</p>
        <p className="text-[11px] text-muted-foreground">
          Raised by {raisedBy?.name ?? "unknown"} ·{" "}
          {format(new Date(f.raisedAt), "MMM d, yyyy")}
          {decidedBy && f.decidedAt
            ? ` · ${f.status} by ${decidedBy.name} ${format(new Date(f.decidedAt), "MMM d")}`
            : ""}
        </p>
        {f.decisionNote && (
          <p className="text-xs italic">"{f.decisionNote}"</p>
        )}

        {canDecide && f.status === "open" && (
          <div className="space-y-2 pt-2 border-t border-border/60">
            <Textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Decision note for the writer / editor."
              className="min-h-[60px]"
              disabled={busy}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  runDecision("cleared", decisionNote.trim() || undefined)
                }
              >
                <Play className="h-3.5 w-3.5" /> Clear (allow publish)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  runDecision("holding", decisionNote.trim() || undefined)
                }
              >
                <Pause className="h-3.5 w-3.5" /> Hold
              </Button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
        {canDecide && f.status !== "open" && (
          <div className="pt-2 border-t border-border/60 flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                runDecision(f.status === "cleared" ? "holding" : "cleared")
              }
            >
              {f.status === "cleared" ? "Hold again" : "Re-clear"}
            </Button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  if (!canRaise) return null;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className="h-3.5 w-3.5" /> Flag sensitive
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-xs font-medium">Flag this story for editorial review</p>
      <div className="space-y-1.5">
        <Label className="text-xs">Reason</Label>
        <Select
          value={reason}
          onChange={(e) => setReason(e.target.value as SensitiveReason)}
        >
          {(
            [
              "student_privacy",
              "politics",
              "financial_claims",
              "allegations",
              "medical_or_mental_health",
              "other",
            ] as SensitiveReason[]
          ).map((r) => (
            <option key={r} value={r}>
              {REASON_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What is the editorial concern? Be brief and specific."
        className="min-h-[80px]"
        disabled={busy}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNotes("");
            setError(null);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="gradient"
          size="sm"
          disabled={!notes.trim() || busy}
          onClick={runRaise}
        >
          {busy ? "Saving…" : "Raise flag"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
