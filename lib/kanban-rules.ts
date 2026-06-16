import type { Role, TaskStatus } from "./types";
import { STATUS_DEFINITIONS } from "./status";

export const STATUS_ORDER: TaskStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "complete",
];

/**
 * Re-exported labels keyed by TaskStatus. Sourced from `STATUS_DEFINITIONS`
 * so labels stay consistent with descriptions and next-action copy.
 */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: STATUS_DEFINITIONS.not_started.label,
  in_progress: STATUS_DEFINITIONS.in_progress.label,
  submitted: STATUS_DEFINITIONS.submitted.label,
  complete: STATUS_DEFINITIONS.complete.label,
};

/**
 * Drag rules per role per master plan:
 * - writer: only own tasks; not_started <-> in_progress, plus dragging an
 *   in-progress draft toward Submitted as a shortcut into the submit composer
 * - editor: no dragging
 * - leader/admin: full control
 */
export function canDragTask(args: {
  role: Role;
  isOwnTask: boolean;
  from: TaskStatus;
}): boolean {
  if (args.role === "leader" || args.role === "admin") return true;
  if (args.role === "editor") return false;
  if (args.role === "writer") {
    if (!args.isOwnTask) return false;
    return args.from === "not_started" || args.from === "in_progress";
  }
  return false;
}

export function canDropTask(args: {
  role: Role;
  isOwnTask: boolean;
  to: TaskStatus;
}): boolean {
  if (args.role === "leader" || args.role === "admin") return true;
  if (args.role === "editor") return false;
  if (args.role === "writer") {
    if (!args.isOwnTask) return false;
    // Writers self-serve Not Started ⇄ In Progress, and may drop onto
    // Submitted to open the submission composer (a submission needs content,
    // so the board routes the drop into the submit flow rather than a raw
    // status flip — see KanbanBoard.handleDrop).
    return (
      args.to === "not_started" ||
      args.to === "in_progress" ||
      args.to === "submitted"
    );
  }
  return false;
}

/** Forward-only state machine transitions. */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  if (from === "not_started") return to === "in_progress";
  if (from === "in_progress") return to === "not_started" || to === "submitted";
  if (from === "submitted") return to === "in_progress" || to === "complete";
  return false;
}
