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

// Admin-configured baseline (Settings → Notifications), pushed in by the site
// config provider. Sits between a user's saved preference and the built-in
// EMAIL_DEFAULTS.
let _adminDefaults: Partial<Record<string, boolean>> = {};

/** Replace the admin-configured email baseline from site settings. */
export function setEmailDefaultsOverride(
  map: Partial<Record<string, boolean>> | null | undefined
): void {
  _adminDefaults = map ?? {};
}

/** The effective email default for a kind: admin baseline, else built-in. */
export function effectiveEmailDefault(kind: NotificationKind): boolean {
  const admin = _adminDefaults[kind];
  if (typeof admin === "boolean") return admin;
  return EMAIL_DEFAULTS[kind] ?? false;
}

/**
 * Decide whether an email should go out for a notification kind. Precedence:
 * the recipient's saved preference, then the admin-configured baseline, then
 * the built-in {@link EMAIL_DEFAULTS}.
 */
export function shouldEmailNotification(
  kind: NotificationKind,
  prefs?: EmailPrefMap
): boolean {
  const userPref = prefs?.[kind];
  if (typeof userPref === "boolean") return userPref;
  return effectiveEmailDefault(kind);
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
