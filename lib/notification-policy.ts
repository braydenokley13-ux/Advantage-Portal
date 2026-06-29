// Channel policy for product notifications, kept dependency-free so it can be
// shared by the browser store, the preferences UI, and server email routes
// without dragging in React or icon libraries.
import type { NotificationKind } from "./types";

/**
 * Which notification kinds are "important" enough to also send an email by
 * default. Chat messages stay email-quiet to avoid inbox noise — the in-app
 * bell and push cover those, and writers can opt in from the preferences
 * screen. Everything that needs a human to act or marks a milestone
 * (assignments, deadlines, submissions, feedback, decisions, completions, and
 * team-wide announcements) emails by default.
 */
export const EMAIL_DEFAULTS: Record<NotificationKind, boolean> = {
  task_assigned: true,
  deadline: true,
  submission: true,
  comment: true,
  review_decision: true,
  task_complete: true,
  message: false,
  announcement: true,
  feedback: true,
  competition: true,
};

/** Optional per-user override map (e.g. from the preferences screen). */
export type EmailPrefMap = Partial<Record<NotificationKind, boolean>>;

/**
 * Decide whether an email should go out for a notification kind. A caller can
 * pass the recipient's saved preference map; when it doesn't carry an explicit
 * choice for the kind we fall back to {@link EMAIL_DEFAULTS}.
 */
export function shouldEmailNotification(
  kind: NotificationKind,
  prefs?: EmailPrefMap
): boolean {
  const override = prefs?.[kind];
  if (typeof override === "boolean") return override;
  return EMAIL_DEFAULTS[kind] ?? false;
}

/**
 * Where the "Open in Advantage Portal" button in an email should land for a
 * given kind. Callers can still pass an explicit, more specific path (e.g. a
 * single task) — this is only the sensible default.
 */
export function defaultNotificationPath(kind: NotificationKind): string {
  switch (kind) {
    case "task_assigned":
    case "deadline":
    case "review_decision":
    case "task_complete":
      return "/tasks";
    case "submission":
    case "comment":
      return "/reviews";
    case "message":
      return "/messages";
    case "announcement":
      return "/announcements";
    case "feedback":
      return "/admin/feedback";
    case "competition":
      return "/competitions";
    default:
      return "/notifications";
  }
}
