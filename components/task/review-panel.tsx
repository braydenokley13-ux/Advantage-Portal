"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { canReview } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ReviewDecision, Submission, Task } from "@/lib/types";

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
  const { reviews, submitReview } = useStore();
  const [picked, setPicked] = useState<ReviewDecision | null>(null);
  const [notes, setNotes] = useState("");

  const allowed = canReview({ task, user });
  const submissionReviews = submission
    ? reviews
        .filter((r) => r.submissionId === submission.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    : [];
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

  function decide() {
    if (!picked || !submission) return;
    submitReview({
      submissionId: submission.id,
      reviewerId: user.id,
      decision: picked,
      notes: notes.trim() || undefined,
    });
    setPicked(null);
    setNotes("");
    onDecided?.();
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

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={
          picked === "changes_requested"
            ? "What needs to change before this is ready?"
            : picked === "rejected"
              ? "Why are you rejecting this submission?"
              : "Optional reviewer notes…"
        }
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Reviewing {`v${submission.version}`} of "{task.title}".
        </p>
        <Button
          variant="gradient"
          disabled={!picked}
          onClick={decide}
        >
          Submit decision
        </Button>
      </div>
    </div>
  );
}
