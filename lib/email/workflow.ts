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
import type { Role, ReviewDecision, Task, User } from "@/lib/types";

/**
 * Active users in any of the given roles — the recipient set for the
 * "all editors / all leaders" style fan-outs that used to live on the store
 * (moderation reports, extension requests).
 */
function staffIds(users: User[], roles: Role[]): string[] {
  return users
    .filter((u) => u.active !== false && roles.includes(u.role))
    .map((u) => u.id);
}

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

/**
 * A chat message was reported → alert admins and leaders (except the reporter,
 * who already knows). Mirrors the store's old `createModerationReport` fan-out.
 */
export function emailOnModerationReport(
  users: User[],
  reporterId: string,
  note?: string
): void {
  fanOutNotificationEmail(
    staffIds(users, ["admin", "leader"]).filter((id) => id !== reporterId),
    {
      kind: "comment",
      title: "Message reported",
      body: note?.slice(0, 100),
    }
  );
}

/** A writer asked for more time → alert leaders and admins to triage it. */
export function emailOnExtensionRequest(users: User[], reason: string): void {
  fanOutNotificationEmail(staffIds(users, ["leader", "admin"]), {
    kind: "task_assigned",
    title: "Extension requested",
    body: reason.slice(0, 120),
  });
}

/**
 * A leader/admin decided an extension → tell the writer who asked. Pass the
 * task as it looked *before* the decision so the pending request's requester
 * is still attached.
 */
export function emailOnExtensionDecision(task: Task, approve: boolean): void {
  if (!task.extensionRequest) return;
  fanOutNotificationEmail([task.extensionRequest.requestedById], {
    kind: "task_assigned",
    title: approve
      ? `Extension approved: ${task.title}`
      : `Extension denied: ${task.title}`,
  });
}
