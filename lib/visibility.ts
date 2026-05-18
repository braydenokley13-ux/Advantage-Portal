import type { Role, Task } from "./types";

/**
 * Task visibility rules per master plan:
 *   writer  → only own tasks
 *   editor  → only tasks assigned to them as editor
 *   leader  → all tasks
 *   admin   → all tasks
 */
export function visibleTasks(args: {
  tasks: Task[];
  role: Role;
  userId: string;
}): Task[] {
  const { tasks, role, userId } = args;
  if (role === "leader" || role === "admin") return tasks;
  if (role === "writer") return tasks.filter((t) => t.writerId === userId);
  if (role === "editor") return tasks.filter((t) => t.editorId === userId);
  return [];
}
