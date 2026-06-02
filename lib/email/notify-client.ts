// Browser-side helper that turns an in-app notification into a real email.
//
// It fires a best-effort POST to /api/email/notification and never throws: a
// rejected or unconfigured send must never break the user action that produced
// the notification. Real delivery only happens in Supabase mode (the route
// returns 400 otherwise), so callers gate on mode before invoking this.
import {
  defaultNotificationPath,
  shouldEmailNotification,
  type EmailPrefMap,
} from "@/lib/notification-policy";
import type { NotificationKind } from "@/lib/types";

export type NotificationEmailInput = {
  /** Recipient profile id. */
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** In-app path the email's action button should open. Defaults per kind. */
  actionPath?: string;
  /** Recipient's saved channel preferences, when known on this device. */
  prefs?: EmailPrefMap;
};

/**
 * Send a notification email for an important event. Skips quiet kinds (per
 * {@link shouldEmailNotification}) and is a no-op outside the browser.
 */
export function dispatchNotificationEmail(input: NotificationEmailInput): void {
  if (typeof window === "undefined") return;
  if (!shouldEmailNotification(input.kind, input.prefs)) return;

  const actionPath = input.actionPath ?? defaultNotificationPath(input.kind);

  void fetch("/api/email/notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      actionPath,
    }),
    // Let the request outlive a navigation triggered by the same click.
    keepalive: true,
  }).catch(() => {
    /* best-effort: in-app notification already recorded the event */
  });
}

/**
 * Fan an event out to several recipients at once. De-dupes ids and skips
 * falsy entries so callers can pass `[task.writerId, task.editorId]` directly.
 */
export function fanOutNotificationEmail(
  recipientIds: Array<string | undefined | null>,
  spec: Omit<NotificationEmailInput, "userId">
): void {
  const seen = new Set<string>();
  for (const id of recipientIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    dispatchNotificationEmail({ userId: id, ...spec });
  }
}
