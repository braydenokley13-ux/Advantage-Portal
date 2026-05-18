"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RoleSwitcher } from "./role-switcher";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";

export function Topbar() {
  return (
    <header
      data-tour="topbar"
      className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 md:px-6"
    >
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks, people, messages…"
            className="pl-9 bg-card"
          />
        </div>
      </div>

      <NotificationsPopover />
      <RoleSwitcher />
    </header>
  );
}
