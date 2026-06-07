"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useApiClient } from "@/lib/api/provider";
import { useReviews } from "@/lib/hooks";
import { emailOnReview } from "@/lib/email/workflow";
import { useRole } from "@/lib/role-context";
import { canReview } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ReviewDecision, Submission, Task } from "@/lib/types";

/**
 * Reusable editor feedback templates. Click to drop the template into the
 * notes box; the editor still picks the decision and can edit the text.
 * Wording is intentionally short and supportive for teen writers.
 */
const FEEDBACK_TEMPLATES: {
  label: string;
  decision: ReviewDecision;
  body: string;
}[] = [
  {
    label: "Great work — approved",
    decision: "approved",
    body: "Strong piece. Tight thesis, clean structure, sources line up. Approving.",
  },
  {
    label: "Needs stronger sources",
    decision: "changes_requested",
    body: "Argument is solid but the sourcing doesn't carry it yet. Add at least two primary sources and tighten any claim that currently leans on a single link.",
  },
  {
    label: "Clarify the argument",
    decision: "changes_requested",
    body: "I had to re-read to find the through-line. Lead with the thesis, then build the case. Each section should answer: how does this support the main point?",
  },
  {
    label: "Shorten / simplify",
    decision: "changes_requested",
    body: "Trim ~20%. Cut anywhere two sentences could be one. Aim for clarity over cleverness — your readers are skimming.",
  },
  {
    label: "Fix citations",
    decision: "changes_requested",
    body: "Citations need a pass: link primary sources, drop dead links, and keep the format consistent across the piece.",
  },
];

const DECISIONS: {
  value: ReviewDecision;
  label: string;
  icon: typeof CheckCircle2;
  tone: string;
  effect: string;
}[] = [
  {
    value: "approved",
    label: "Approve",
    icon: CheckCircle2,
    tone: "bg-emerald-600 hover:bg-emerald-700 text-white",
    effect: "Marks task complete.",
  },
  {
    value: "changes_requested",
    label: "Request changes",
    icon: RefreshCw,
    tone: "bg-amber-500 hover:bg-amber-600 text-white",
    effect: "Returns to In Progress for revision.",
  },
  {
    value: "rejected",
    label: "Reject",
    icon: XCircle,
    tone: "bg-red-600 hover:bg-red-700 text-white",
    effect: "Closes the task as rejected.",
  },
];

export function ReviewPanel({
  task,
  submission,
  onDecided,
}: {
  task: Task;
  submission?: Submission;
  onDecided?: () => void;
}) {
  const { user } = useRole();
  const api = useApiClient();
  // Reviews for the selected submission, read straight through the API hook.
  const { data: reviewsData, refetch: refetchReviews } = useReviews(
    submission?.id
  );
  const [picked, setPicked] = useState<ReviewDecision | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = canReview({ task, user });
  const submissionReviews = (reviewsData ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const lastReview = submissionReviews[0];

  if (!submission) {
    return (
      <p className="text-sm text-muted-foreground">
        Once a submission exists, reviewers can render a decision here.
      </p>
    );
  }

  if (task.status === "complete") {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="success">Closed</Badge>
          {lastReview && (
            <span className="text-xs text-muted-foreground capitalize">
              {lastReview.decision.replace("_", " ")}
            </span>
          )}
        </div>
        {lastReview?.notes && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lastReview.notes}
          </p>
        )}
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-center">
        <p className="text-sm font-medium">Review unavailable</p>
        <p className="text-xs text-muted-foreground mt-1">
          {user.id === task.writerId
            ? "Writers can't review their own submissions."
            : task.status !== "submitted"
              ? "There's no submission awaiting review."
              : "Only the assigned editor (or a leader/admin) can review."}
        </p>
      </div>
    );
  }

  async function decide() {
    if (!picked || !submission || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.createReview({
        submissionId: submission.id,
        reviewerId: user.id,
        decision: picked,
        notes: notes.trim() || undefined,
      });
      emailOnReview(task, picked, notes.trim() || undefined);
      setPicked(null);
      setNotes("");
      refetchReviews();
      onDecided?.();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't record that decision. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {DECISIONS.map((d) => {
          const active = picked === d.value;
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => setPicked(active ? null : d.value)}
              className={cn(
                "rounded-lg border border-border bg-card p-3 text-left transition-all",
                active
                  ? "ring-2 ring-primary/50 border-primary/50 shadow-soft"
                  : "hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md",
                    active ? d.tone : "bg-secondary text-muted-foreground"
                  )}
                >
                  <d.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{d.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                {d.effect}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          <Sparkles className="h-3 w-3" /> Quick feedback templates
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => {
                setPicked(tpl.decision);
                setNotes(tpl.body);
              }}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] hover:bg-accent transition-colors"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={
          picked === "changes_requested"
            ? "What needs to change before this is ready? Be specific and kind."
            : picked === "rejected"
              ? "Why are you returning this submission?"
              : "Optional reviewer notes…"
        }
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Reviewing {`v${submission.version}`} of &ldquo;{task.title}&rdquo;.
        </p>
        <Button
          variant="gradient"
          disabled={!picked || busy}
          onClick={decide}
        >
          {busy ? "Saving…" : "Submit decision"}
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}
