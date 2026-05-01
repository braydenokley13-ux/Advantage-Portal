import type { Role, TaskStatus } from "./types";

export const STATUS_ORDER: TaskStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "complete",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  complete: "Complete",
};

/**
 * Drag rules per role per master plan:
 * - writer: only own tasks; only between not_started <-> in_progress
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
    return args.to === "not_started" || args.to === "in_progress";
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
