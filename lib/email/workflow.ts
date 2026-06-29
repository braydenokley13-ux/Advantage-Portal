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

/**
 * A comment landed → tell the other people on the task, never the author.
 * When the writer comments, the editor hears about it; when the editor (or a
 * leader/admin) comments, the writer does. This keeps a back-and-forth thread
 * alive instead of only ever pinging the writer.
 */
export function emailOnComment(task: Task, authorId: string): void {
  fanOutNotificationEmail(
    [task.writerId, task.editorId].filter((id) => id && id !== authorId),
    {
      kind: "comment",
      title: `New comment on ${task.title}`,
    }
  );
}

/**
 * A task was edited → notify whoever the edit affects:
 *  - a new writer / editor learns they've been (re)assigned,
 *  - a moved deadline pings the writer and editor so nobody misses it.
 * Pass the task as it looked before and after the edit.
 */
export function emailOnTaskEdited(args: {
  previous: Task;
  next: Task;
}): void {
  const { previous, next } = args;

  if (next.writerId && next.writerId !== previous.writerId) {
    fanOutNotificationEmail([next.writerId], {
      kind: "task_assigned",
      title: `Assigned: ${next.title}`,
      body: `Due ${new Date(next.deadline).toLocaleDateString()}`,
    });
  }

  if (next.editorId && next.editorId !== previous.editorId) {
    fanOutNotificationEmail([next.editorId], {
      kind: "task_assigned",
      title: `Editing: ${next.title}`,
      body: "You are the assigned editor.",
    });
  }

  if (next.deadline !== previous.deadline) {
    // Don't double-notify someone who was just (re)assigned above — they
    // already got the new deadline in their assignment email.
    const reassigned = new Set(
      [
        next.writerId !== previous.writerId ? next.writerId : null,
        next.editorId !== previous.editorId ? next.editorId : null,
      ].filter(Boolean) as string[]
    );
    fanOutNotificationEmail(
      [next.writerId, next.editorId].filter(
        (id) => id && !reassigned.has(id)
      ),
      {
        kind: "deadline",
        title: `Deadline updated: ${next.title}`,
        body: `Now due ${new Date(next.deadline).toLocaleDateString()}.`,
      }
    );
  }
}

/** A task was marked complete (outside the review-approval path) → tell the writer. */
export function emailOnTaskCompleted(task: Task): void {
  fanOutNotificationEmail([task.writerId], {
    kind: "task_complete",
    title: `Marked complete: ${task.title}`,
    body: "Nice work — this story is done.",
  });
}

/** An issue shipped → congratulate every writer whose story ran in it. */
export function emailOnIssuePublished(
  issueName: string,
  writerIds: Array<string | undefined | null>
): void {
  fanOutNotificationEmail(writerIds, {
    kind: "task_complete",
    title: `Published: ${issueName}`,
    body: "Your story is live in this issue. 🎉",
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

/**
 * A report reached a terminal state → give the reporter closure without
 * disclosing the outcome (resolution details stay between moderators and the
 * reported user). De-dupes so a bulk action emails each reporter once.
 */
export function emailOnModerationResolved(
  reporterIds: Array<string | undefined | null>
): void {
  fanOutNotificationEmail(reporterIds, {
    kind: "comment",
    title: "Your report was reviewed",
    body: "Thanks for helping keep the newsroom safe. A moderator has reviewed your report.",
    actionPath: "/notifications",
  });
}

/** New feedback arrived → alert admins and leaders so it gets triaged. */
export function emailOnFeedbackSubmitted(
  users: User[],
  subject: string
): void {
  fanOutNotificationEmail(staffIds(users, ["admin", "leader"]), {
    kind: "feedback",
    title: "New feedback received",
    body: subject.slice(0, 120),
    actionPath: "/admin/feedback",
  });
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
