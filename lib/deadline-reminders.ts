import type { Task, User } from "./types";

export type DeadlineKind = "7d" | "3d" | "1d" | "missed";

export interface DeadlineReminder {
  /** Unique key per (task, kind, recipient). Used for dedupe. */
  key: string;
  taskId: string;
  userId: string;
  kind: DeadlineKind;
  title: string;
  body?: string;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole days from `now` to deadline. Negative = past. */
export function daysUntilDeadline(deadlineISO: string, now: Date = new Date()) {
  const a = startOfDay(now).getTime();
  const b = startOfDay(new Date(deadlineISO)).getTime();
  return Math.round((b - a) / DAY_MS);
}

const KIND_META: Record<DeadlineKind, { label: string; days?: number }> = {
  "7d": { label: "due in 7 days", days: 7 },
  "3d": { label: "due in 3 days", days: 3 },
  "1d": { label: "due tomorrow", days: 1 },
  missed: { label: "is overdue" },
};

/**
 * Pure scanner. Given tasks/users and the set of already-issued keys,
 * return the new reminders that should fire now.
 *
 * Recipients:
 * - 7d/3d/1d: writer (and editor if assigned)
 * - missed:   writer, editor (if assigned), and the leader/admin escalation
 */
export function scanDeadlineReminders(args: {
  tasks: Task[];
  users: User[];
  issuedKeys: Set<string>;
  now?: Date;
}): DeadlineReminder[] {
  const now = args.now ?? new Date();
  const out: DeadlineReminder[] = [];

  const leaders = args.users.filter(
    (u) => u.role === "leader" && (u.active ?? true)
  );

  for (const task of args.tasks) {
    if (task.status === "complete") continue;
    const days = daysUntilDeadline(task.deadline, now);

    let kind: DeadlineKind | null = null;
    if (days < 0) kind = "missed";
    else if (days === 1) kind = "1d";
    else if (days === 3) kind = "3d";
    else if (days === 7) kind = "7d";
    if (!kind) continue;

    const recipients: string[] = [task.writerId];
    if (task.editorId) recipients.push(task.editorId);
    if (kind === "missed") {
      for (const l of leaders) {
        if (!recipients.includes(l.id)) recipients.push(l.id);
      }
    }

    const meta = KIND_META[kind];
    for (const userId of recipients) {
      const key = reminderKey(task.id, kind, userId);
      if (args.issuedKeys.has(key)) continue;
      out.push({
        key,
        taskId: task.id,
        userId,
        kind,
        title:
          kind === "missed"
            ? `Overdue: ${task.title}`
            : `${task.title} ${meta.label}`,
        body:
          kind === "missed"
            ? "Deadline has passed without completion."
            : `Deadline: ${new Date(task.deadline).toLocaleDateString()}`,
      });
    }
  }
  return out;
}

export function reminderKey(
  taskId: string,
  kind: DeadlineKind,
  userId: string
): string {
  return `${taskId}:${kind}:${userId}`;
}

