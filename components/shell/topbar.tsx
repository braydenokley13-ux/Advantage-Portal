"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  MessageSquare,
  Search,
  Users as UsersIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserMenu } from "./user-menu";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { visibleConversations } from "@/lib/permissions";
import { visibleTasks } from "@/lib/visibility";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: typeof Search;
};

const PER_GROUP = 5;

// Global search is on the roadmap but not implemented yet — the previous
// always-visible search input was a placeholder with no handler. Hidden
// here until the search index ships so users don't type into a dead
// affordance.
export function Topbar() {
  const router = useRouter();
  const { user, role } = useRole();
  const { tasks, users, conversations } = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const taskHits = visibleTasks({ tasks, role, userId: user.id })
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, PER_GROUP)
      .map((t) => ({
        id: `task-${t.id}`,
        label: t.title,
        hint: "Task",
        href: "/tasks",
        icon: CheckSquare,
      }));

    const peopleHits = users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .slice(0, PER_GROUP)
      .map((u) => ({
        id: `user-${u.id}`,
        label: u.name,
        hint: u.role,
        href: "/team",
        icon: UsersIcon,
      }));

    const convoHits = visibleConversations({ conversations, user })
      .filter((c) => c.title.toLowerCase().includes(q))
      .slice(0, PER_GROUP)
      .map((c) => ({
        id: `convo-${c.id}`,
        label: c.title,
        hint: "Conversation",
        href: "/messages",
        icon: MessageSquare,
      }));

    return [...taskHits, ...peopleHits, ...convoHits];
  }, [query, tasks, users, conversations, role, user]);

  // Close the results panel on an outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(href: string) {
    setQuery("");
    setOpen(false);
    router.push(href);
  }

  const showPanel = open && query.trim().length > 0;

  return (
    <header
      data-tour="topbar"
      className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 md:px-6"
    >
      <div className="flex-1 max-w-xl" ref={containerRef}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Search tasks, people, messages…"
            className="pl-9 bg-card"
            aria-label="Search tasks, people, and messages"
          />

          {showPanel && (
            <div className="absolute left-0 right-0 top-full mt-1.5 rounded-lg border border-border bg-card shadow-elevated overflow-hidden">
              {results.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No matches for “{query.trim()}”
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto scroll-thin py-1">
                  {results.map((r) => {
                    const Icon = r.icon;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => go(r.href)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent",
                            "focus-visible:outline-none focus-visible:bg-accent"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {r.label}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {r.hint}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <NotificationsPopover />
      <UserMenu />
    </header>
  );
}
