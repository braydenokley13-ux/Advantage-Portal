"use client";

import {
  Hash,
  Megaphone,
  Pin,
  Shield,
  Users as UsersIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import {
  canCreateConversation,
  visibleConversations,
} from "@/lib/permissions";
import { initials, cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import type { Conversation, ConversationKind } from "@/lib/types";

const KIND_ICON: Partial<
  Record<ConversationKind, React.ComponentType<{ className?: string }>>
> = {
  group: UsersIcon,
  issue: Hash,
  all_team: Megaphone,
  admins_only: Shield,
};

export function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { user, role } = useRole();
  const { conversations, messages, users } = useStore();
  const [filter, setFilter] = useState("");

  const visible = visibleConversations({ conversations, user });
  const sorted = [...visible].sort(
    (a, b) =>
      new Date(b.lastMessageAt ?? 0).getTime() -
      new Date(a.lastMessageAt ?? 0).getTime()
  );

  const filtered = sorted.filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase())
  );

  const canCreateGroup =
    canCreateConversation(role, "group") || canCreateConversation(role, "issue");

  return (
    <div className="flex h-full flex-col border-r border-border bg-card/60">
      <div className="px-4 py-3 border-b border-border space-y-2">
        {/* "New conversation" button removed — the create flow isn't
            wired yet (button had no onClick) and a permanently-dead
            affordance is worse than no affordance. Track in roadmap. */}
        <h2 className="text-sm font-semibold tracking-tight">Inbox</h2>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search…"
          className="h-8 text-xs"
        />
      </div>

      <ul className="flex-1 overflow-y-auto scroll-thin">
        {filtered.map((c) => {
          const last = messages
            .filter((m) => m.conversationId === c.id)
            .slice(-1)[0];
          const lastAuthor = last
            ? users.find((u) => u.id === last.authorId)
            : undefined;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                  selectedId === c.id && "bg-accent"
                )}
              >
                <ConversationAvatar conversation={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    {c.lastMessageAt && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNowStrict(new Date(c.lastMessageAt), {
                          addSuffix: false,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <KindLabel kind={c.kind} />
                    {last && (
                      <p className="text-xs text-muted-foreground truncate">
                        {lastAuthor && (
                          <span className="font-medium">
                            {lastAuthor.name.split(" ")[0]}:{" "}
                          </span>
                        )}
                        {last.body}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-xs text-muted-foreground">
            No conversations
          </li>
        )}
      </ul>

      {!canCreateGroup && (
        <div className="px-4 py-3 border-t border-border text-[11px] text-muted-foreground">
          Only leaders &amp; admins can create groups or issue channels.
        </div>
      )}
    </div>
  );
}

function ConversationAvatar({ conversation }: { conversation: Conversation }) {
  const { users } = useStore();
  const { user: me } = useRole();

  if (conversation.kind === "dm") {
    const other = users.find(
      (u) => u.id !== me.id && conversation.memberIds.includes(u.id)
    );
    return (
      <Avatar className="h-9 w-9">
        <AvatarFallback>{initials(other?.name ?? "?")}</AvatarFallback>
      </Avatar>
    );
  }

  if (conversation.kind === "all_team") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-soft">
        <Megaphone className="h-4 w-4" />
      </div>
    );
  }

  if (conversation.kind === "admins_only") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
        <Shield className="h-4 w-4" />
      </div>
    );
  }

  const Icon = KIND_ICON[conversation.kind] ?? UsersIcon;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
      <Icon className="h-4 w-4" />
    </div>
  );
}

type KindBadge = {
  label: string;
  tone: "default" | "secondary" | "warning" | "danger";
};

function KindLabel({ kind }: { kind: ConversationKind }) {
  if (kind === "dm") return null;
  const map: Record<Exclude<ConversationKind, "dm">, KindBadge> = {
    group: { label: "Group", tone: "secondary" },
    issue: { label: "Issue", tone: "default" },
    all_team: { label: "All-team", tone: "warning" },
    admins_only: { label: "Admins", tone: "danger" },
  };
  const v = map[kind];
  return (
    <Badge variant={v.tone} className="h-4 px-1.5 text-[9px] uppercase">
      {kind === "all_team" && <Pin className="h-2.5 w-2.5 mr-0.5" />}
      {kind === "admins_only" && <Shield className="h-2.5 w-2.5 mr-0.5" />}
      {v.label}
    </Badge>
  );
}
