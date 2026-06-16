/**
 * Status taxonomy for tasks across the portal.
 *
 * The portal uses four canonical statuses. "Submitted" doubles as the
 * editorial "In Review" state — once a writer submits, the draft is in
 * review until an editor renders a decision. We surface a derived
 * "Changes Requested" sub-state for tasks that have bounced back to
 * `in_progress` after a `changes_requested` review (see `deriveSubState`).
 *
 * Wording is teen-friendly and consistent across Dashboard, Board,
 * Calendar, Notifications, and the Task drawer.
 */
import type { Review, Task, TaskStatus } from "./types";

export type StatusBadgeTone = "default" | "secondary" | "warning" | "success";

/**
 * Is the task's deadline blown *for the writer*?
 *
 * The deadline is the writer's bar: turn a draft in by this date. Once the
 * writer submits (`submitted`) or the task is closed (`complete`), the ball is
 * in the editor's court and the deadline no longer applies — so we stop
 * flagging it as overdue. Overdue therefore only means "a draft is still owed
 * and the date has passed," i.e. status is `not_started` or `in_progress`.
 *
 * This is the single source of truth for the red "Overdue" badge across the
 * board, calendar, dashboard, and task drawer. Review-SLA logic ("this
 * submission has sat in review too long") is a separate concern and lives with
 * the reviews surface, not here.
 */
export function isTaskOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status === "submitted" || task.status === "complete") return false;
  return new Date(task.deadline).getTime() < now.getTime();
}

/**
 * Display rules per status. A single source of truth for labels, short
 * teen-readable definitions, and the suggested next action.
 */
export const STATUS_DEFINITIONS: Record<
  TaskStatus,
  {
    label: string;
    /** One-line definition shown in tooltips and microcopy. */
    description: string;
    /** What the writer/editor should do next. */
    nextAction: { writer: string; editor: string; leader: string };
    badgeTone: StatusBadgeTone;
  }
> = {
  not_started: {
    label: "Not Started",
    description: "Assignment is open. Nobody has started drafting yet.",
    nextAction: {
      writer: "Open the brief and start a draft.",
      editor: "Wait — there's nothing to review yet.",
      leader: "Confirm the writer has what they need.",
    },
    badgeTone: "secondary",
  },
  in_progress: {
    label: "In Progress",
    description:
      "A draft is being written or revised. This is also the state a draft returns to after an editor requests changes.",
    nextAction: {
      writer: "Continue the draft, then submit when ready.",
      editor: "Wait for the writer's submission.",
      leader: "Track progress and offer guidance if needed.",
    },
    badgeTone: "default",
  },
  submitted: {
    label: "Submitted",
    description:
      "Writer turned in a version. The draft is now in editor review.",
    nextAction: {
      writer: "Sit tight — your editor has the draft.",
      editor: "Open the Review tab and approve, request changes, or return.",
      leader: "Step in only if the review is overdue.",
    },
    badgeTone: "warning",
  },
  complete: {
    label: "Complete",
    description:
      "Editor approved the draft (or closed the task). No more action needed.",
    nextAction: {
      writer: "Done — nice work.",
      editor: "Closed.",
      leader: "Ready for publication or already shipped.",
    },
    badgeTone: "success",
  },
};

/**
 * Sub-states derived from the latest review. `submitted` is the canonical
 * "In Review" — but a draft that bounced back to `in_progress` after a
 * `changes_requested` review carries a different meaning than a brand-new
 * `in_progress` draft. We expose that as a derived sub-state without
 * adding to the canonical TaskStatus union (which would explode the
 * permission/transition matrices).
 */
export type TaskSubState = "fresh_draft" | "changes_requested" | null;

export function deriveSubState(args: {
  task: Task;
  reviews: Review[];
  /** Map of submission.id -> task.id. */
  submissionTaskMap?: Map<string, string>;
}): TaskSubState {
  const { task, reviews } = args;
  if (task.status !== "in_progress") return null;
  // Find the most recent review on any submission belonging to this task.
  const taskReviews = reviews
    .filter((r) => {
      if (!args.submissionTaskMap) return false;
      return args.submissionTaskMap.get(r.submissionId) === task.id;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const last = taskReviews[0];
  if (!last) return "fresh_draft";
  return last.decision === "changes_requested" ? "changes_requested" : null;
}

/** Display helpers for the derived sub-state. */
export const SUBSTATE_LABEL: Record<NonNullable<TaskSubState>, string> = {
  fresh_draft: "Drafting",
  changes_requested: "Changes Requested",
};
