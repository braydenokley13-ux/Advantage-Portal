"use client";

import {
  Hash,
  Megaphone,
  Pin,
  Plus,
  Shield,
  Users as UsersIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useConversations,
  useMessages,
  useRealtimeRefetch,
  useUsers,
} from "@/lib/hooks";
import { useApiClient } from "@/lib/api/provider";
import { useRole } from "@/lib/role-context";
import {
  canCreateConversation,
  visibleConversations,
} from "@/lib/permissions";
import { initials, cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { useMemo, useState } from "react";
import type { Conversation, ConversationKind, User } from "@/lib/types";

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
  const api = useApiClient();
  // Conversations + last-message previews read through the API hooks; realtime
  // keeps the inbox live as new threads and messages land.
  const { data: conversationsData, refetch: refetchConversations } =
    useConversations();
  const { data: messagesData, refetch: refetchMessages } = useMessages();
  const { data: usersData } = useUsers();
  useRealtimeRefetch(["conversations", "messages"], () => {
    refetchConversations();
    refetchMessages();
  });
  const conversations = conversationsData ?? [];
  const messages = messagesData ?? [];
  const users = usersData ?? [];
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Inbox</h2>
          <Button
            size="icon"
            variant="ghost"
            disabled={!canCreateGroup}
            onClick={() => setCreateOpen(true)}
            aria-label="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
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

      <NewConversationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        currentUser={user}
        canCreateGroup={canCreateConversation(role, "group")}
        canCreateIssue={canCreateConversation(role, "issue")}
        onCreate={async (input) => {
          const conv = await api.createConversation(input);
          refetchConversations();
          onSelect(conv.id);
        }}
      />
    </div>
  );
}

function NewConversationDialog({
  open,
  onOpenChange,
  users,
  currentUser,
  canCreateGroup,
  canCreateIssue,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  currentUser: User;
  canCreateGroup: boolean;
  canCreateIssue: boolean;
  onCreate: (input: {
    kind: ConversationKind;
    title: string;
    memberIds: string[];
  }) => Promise<void>;
}) {
  const kinds = useMemo<ConversationKind[]>(
    () =>
      ([
        canCreateGroup ? "group" : null,
        canCreateIssue ? "issue" : null,
      ].filter(Boolean) as ConversationKind[]),
    [canCreateGroup, canCreateIssue]
  );
  const [kind, setKind] = useState<ConversationKind>(kinds[0] ?? "group");
  const [title, setTitle] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectable = users.filter(
    (u) => u.id !== currentUser.id && u.active !== false
  );
  const canSubmit = title.trim().length > 0 && !submitting;

  function reset() {
    setKind(kinds[0] ?? "group");
    setTitle("");
    setMemberIds([]);
    setSubmitting(false);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate({
        kind,
        title: title.trim(),
        // The creator is always a member.
        memberIds: [currentUser.id, ...memberIds],
      });
      onOpenChange(false);
      reset();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Start a group or issue channel. You’re added automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4 overflow-y-auto scroll-thin">
          {kinds.length > 1 && (
            <div className="space-y-1.5">
              <Label>Channel type</Label>
              <div className="flex gap-2">
                {kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      kind === k
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="conversation-title">Title</Label>
            <Input
              id="conversation-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spring issue planning"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Members</Label>
            <div className="max-h-56 overflow-y-auto scroll-thin rounded-md border border-border divide-y divide-border">
              {selectable.map((u) => {
                const checked = memberIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setMemberIds((prev) =>
                          e.target.checked
                            ? [...prev, u.id]
                            : prev.filter((id) => id !== u.id)
                        )
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>{initials(u.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {u.name}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {u.role}
                    </span>
                  </label>
                );
              })}
              {selectable.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No other members available.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="gradient"
            size="sm"
            disabled={!canSubmit}
            onClick={submit}
          >
            {submitting ? "Creating…" : "Create conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConversationAvatar({ conversation }: { conversation: Conversation }) {
  const { data: usersData } = useUsers();
  const users = usersData ?? [];
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
