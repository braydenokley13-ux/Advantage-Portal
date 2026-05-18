"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./notification-item";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const { user } = useRole();
  const { notifications, markAllRead } = useStore();

  const mine = notifications
    .filter((n) => n.userId === user.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const unread = mine.filter((n) => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              className={cn(
                "absolute right-1.5 top-1.5 inline-flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white ring-2 ring-background"
              )}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold tracking-tight">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAllRead(user.id)}
              disabled={unread === 0}
            >
              Mark all read
            </Button>
          </div>
        </div>

        <div className="max-h-[26rem] overflow-y-auto scroll-thin divide-y divide-border">
          {mine.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-sm font-medium">Nothing yet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                We'll notify you about tasks, reviews, and messages.
              </p>
            </div>
          ) : (
            mine
              .slice(0, 6)
              .map((n) => <NotificationItem key={n.id} notification={n} />)
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-2 py-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              See all
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link
              href="/notifications/preferences"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-3.5 w-3.5" /> Preferences
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
