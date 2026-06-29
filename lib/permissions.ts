import type { Conversation, Role, Task, User } from "./types";

/** Writer may submit only if they own the task and it isn't complete. */
export function canSubmit(args: { task: Task; user: User }): boolean {
  if (args.user.role !== "writer") return false;
  if (args.task.writerId !== args.user.id) return false;
  if (args.task.status === "complete") return false;
  return true;
}

/** Editor reviews assigned tasks; leader/admin can review any. Writers cannot review their own. */
export function canReview(args: { task: Task; user: User }): boolean {
  if (args.task.status !== "submitted") return false;
  if (args.user.id === args.task.writerId) return false;
  if (args.user.role === "leader" || args.user.role === "admin") return true;
  if (args.user.role === "editor" && args.task.editorId === args.user.id)
    return true;
  return false;
}

/**
 * Leaders and admins can move a task straight to Complete without waiting on a
 * formal editor review. This is the manual escape hatch for stories that don't
 * need (or can't wait for) a review decision — mirrors the board's admin drag
 * to Complete. No-op once the task is already complete.
 */
export function canForceComplete(args: { task: Task; user: User }): boolean {
  if (args.task.status === "complete") return false;
  return args.user.role === "leader" || args.user.role === "admin";
}

export function canComment(args: { task: Task; user: User }): boolean {
  // Anyone with visibility into the task can comment on its submissions.
  if (args.user.role === "leader" || args.user.role === "admin") return true;
  if (args.user.id === args.task.writerId) return true;
  if (args.user.role === "editor" && args.task.editorId === args.user.id)
    return true;
  return false;
}

/** Creating a new conversation. */
export function canCreateConversation(role: Role, kind: Conversation["kind"]) {
  if (kind === "all_team") return false; // single channel, not user-creatable
  if (kind === "admins_only") return role === "admin";
  if (kind === "dm") return true;
  // group + issue: only leaders/admins
  return role === "leader" || role === "admin";
}

/** Posting messages into a conversation. */
export function canPostInConversation(args: {
  conversation: Conversation;
  user: User;
}): boolean {
  if (!args.conversation.memberIds.includes(args.user.id)) return false;
  if (args.conversation.kind === "all_team") {
    return args.user.role === "leader" || args.user.role === "admin";
  }
  if (args.conversation.kind === "admins_only") {
    return args.user.role === "leader" || args.user.role === "admin";
  }
  return true;
}

export function visibleConversations(args: {
  conversations: Conversation[];
  user: User;
}): Conversation[] {
  return args.conversations.filter((c) =>
    c.memberIds.includes(args.user.id)
  );
}

export function canCreateTask(role: Role) {
  return role === "leader" || role === "admin";
}

export function canEditTask(role: Role) {
  return role === "leader" || role === "admin";
}

/** View user list. Everyone with an account can see the team page. */
export function canViewTeam(role: Role) {
  void role;
  return true;
}

/** Mutate users (role changes, deactivate). Admin only per master plan. */
export function canManageUsers(role: Role) {
  return role === "admin";
}

export function canPostAnnouncement(role: Role) {
  return role === "leader" || role === "admin";
}

export function canPinMessage(role: Role) {
  return role === "leader" || role === "admin";
}

/**
 * Access to the moderation queue for reported messages. Leaders share
 * safety power with admins per the role policy; writers and editors
 * never see this surface.
 */
export function canModerate(role: Role) {
  return role === "leader" || role === "admin";
}

/** Edit portal-wide configuration (branding, feature toggles, workflows). */
export function canManageSettings(role: Role) {
  return role === "admin";
}
