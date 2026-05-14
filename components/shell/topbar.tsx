"use client";

import { RoleSwitcher } from "./role-switcher";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";

// Global search is on the roadmap but not implemented yet — the previous
// always-visible search input was a placeholder with no handler. Hidden
// here until the search index ships so users don't type into a dead
// affordance.
export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-2 border-b border-border bg-background/80 backdrop-blur px-4 md:px-6">
      <NotificationsPopover />
      <RoleSwitcher />
    </header>
  );
}
