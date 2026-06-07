"use client";

/**
 * Workflow notification emails for the submission → review → comment loop.
 *
 * These fan-outs used to live inside the store's mutators. Now that the
 * editing surfaces write through the API client directly, the same emails are
 * triggered here so behaviour is preserved without routing through `useStore`.
 *
 * Every call is best-effort (see `fanOutNotificationEmail`): a failed or
 * unconfigured send never throws and never blocks the user's action.
 */
import { fanOutNotificationEmail } from "./notify-client";
import type { ReviewDecision, Task } from "@/lib/types";

/** A writer submitted work → tell the assigned editor a new version is ready. */
export function emailOnSubmission(task: Task, version: number): void {
  if (!task.editorId) return;
  fanOutNotificationEmail([task.editorId], {
    kind: "submission",
    title: `New submission: ${task.title}`,
    body: `Version ${version} ready for review.`,
  });
}

/** An editor decided a review → tell the writer the outcome. */
export function emailOnReview(
  task: Task,
  decision: ReviewDecision,
  notes?: string
): void {
  fanOutNotificationEmail([task.writerId], {
    kind: "review_decision",
    title:
      decision === "approved"
        ? `Approved: ${task.title}`
        : decision === "rejected"
          ? `Rejected: ${task.title}`
          : `Changes requested: ${task.title}`,
    body: notes,
  });
}

/** A comment landed → tell the writer, unless they wrote it themselves. */
export function emailOnComment(task: Task, authorId: string): void {
  if (task.writerId === authorId) return;
  fanOutNotificationEmail([task.writerId], {
    kind: "comment",
    title: `New comment on ${task.title}`,
  });
}
