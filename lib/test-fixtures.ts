/**
 * Shared builders for tests. Each builder fills every required field of the
 * corresponding type and lets callers override any field.
 */
import type { Role, Task, TaskStatus, User } from "./types";

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function makeUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? nextId("user");
  return {
    id,
    name: overrides.name ?? `User ${id}`,
    email: overrides.email ?? `${id}@example.com`,
    role: overrides.role ?? "writer",
    avatarUrl: overrides.avatarUrl,
    active: overrides.active,
  };
}

export function makeUsersByRole(): Record<Role, User> {
  return {
    writer: makeUser({ id: "writer-1", role: "writer" }),
    editor: makeUser({ id: "editor-1", role: "editor" }),
    leader: makeUser({ id: "leader-1", role: "leader" }),
    admin: makeUser({ id: "admin-1", role: "admin" }),
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id ?? nextId("task");
  const status: TaskStatus = overrides.status ?? "not_started";
  return {
    id,
    title: overrides.title ?? `Task ${id}`,
    instructions: overrides.instructions ?? "Write something good.",
    writerId: overrides.writerId ?? "writer-1",
    editorId: "editorId" in overrides ? overrides.editorId : undefined,
    deadline: overrides.deadline ?? "2026-06-01T00:00:00.000Z",
    status,
    color: overrides.color ?? "green",
    currentSubmissionId: overrides.currentSubmissionId,
    createdAt: overrides.createdAt ?? "2026-05-01T00:00:00.000Z",
    wordCountTarget: overrides.wordCountTarget,
    citationsRequired: overrides.citationsRequired,
    extensionRequest: overrides.extensionRequest,
    sectionId: overrides.sectionId,
    pitchId: overrides.pitchId,
    issueId: overrides.issueId,
    copyEditorId: overrides.copyEditorId,
    factCheckerId: overrides.factCheckerId,
    slug: overrides.slug,
    brief: overrides.brief,
    wordCountActual: overrides.wordCountActual,
    sensitive: overrides.sensitive,
  };
}

/** ISO string `days` away from `now` (negative = past). */
export function isoOffsetDays(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
