"use client";

import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RoleSwitcher } from "./role-switcher";
import { useRole } from "@/lib/role-context";
import { notifications } from "@/lib/mock-data";

export function Topbar() {
  const { user } = useRole();
  const unread = notifications.filter(
    (n) => n.userId === user.id && !n.read
  ).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 md:px-6">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks, people, messages…"
            className="pl-9 bg-card"
          />
        </div>
      </div>

      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
        )}
      </Button>

      <RoleSwitcher />
    </header>
  );
}
