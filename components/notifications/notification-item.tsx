"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { NOTIFICATION_META } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export function NotificationItem({
  notification,
  showAction = true,
}: {
  notification: Notification;
  showAction?: boolean;
}) {
  const { markNotificationRead } = useStore();
  const meta = NOTIFICATION_META[notification.kind];
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          meta.tone
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm leading-snug",
              notification.read ? "text-muted-foreground" : "font-medium"
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          )}
        </div>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">
          {meta.label} ·{" "}
          {formatDistanceToNowStrict(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
      {showAction && !notification.read && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => markNotificationRead(notification.id, true)}
          aria-label="Mark as read"
        >
          <Check className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
