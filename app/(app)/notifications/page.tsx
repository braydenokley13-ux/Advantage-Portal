"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { NotificationItem } from "@/components/notifications/notification-item";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";
import type { NotificationKind } from "@/lib/types";

type Tab = "all" | "unread" | NotificationKind;

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "task_assigned", label: "Tasks" },
  { value: "review_decision", label: "Reviews" },
  { value: "comment", label: "Comments" },
  { value: "message", label: "Messages" },
  { value: "deadline", label: "Deadlines" },
  { value: "announcement", label: "Announcements" },
];

export default function NotificationsPage() {
  const { user } = useRole();
  const { notifications, markAllRead } = useStore();
  const [tab, setTab] = useState<Tab>("all");

  const mine = useMemo(
    () =>
      notifications
        .filter((n) => n.userId === user.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [notifications, user.id]
  );

  const filtered = useMemo(() => {
    if (tab === "all") return mine;
    if (tab === "unread") return mine.filter((n) => !n.read);
    return mine.filter((n) => n.kind === tab);
  }, [mine, tab]);

  const unread = mine.filter((n) => !n.read).length;

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Notifications"
        description="Everything that needs your attention."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => markAllRead(user.id)}
              disabled={unread === 0}
            >
              Mark all read
            </Button>
            <Button asChild variant="gradient">
              <Link href="/notifications/preferences">
                <Settings className="h-4 w-4" /> Preferences
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const count =
            t.value === "all"
              ? mine.length
              : t.value === "unread"
                ? unread
                : mine.filter((n) => n.kind === t.value).length;
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card hover:bg-accent border-border"
              )}
            >
              {t.label}
              {count > 0 && (
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className="h-4 px-1.5 text-[9px]"
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No notifications here</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tab === "unread"
                ? "You're all caught up."
                : "We'll keep this list up to date."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
