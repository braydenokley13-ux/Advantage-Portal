"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  EyeOff,
  Flag,
  Hash,
  Megaphone,
  Paperclip,
  Pin,
  Send,
  Shield,
  ShieldAlert,
  Users as UsersIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  useConversations,
  useMessages,
  useRealtimeRefetch,
  useUsers,
} from "@/lib/hooks";
import { useRole } from "@/lib/role-context";
import { useApiClient } from "@/lib/api/provider";
import { emailOnModerationReport } from "@/lib/email/workflow";
import { canModerate, canPostInConversation } from "@/lib/permissions";
import { initials, cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import type { Message, ModerationReason, User } from "@/lib/types";

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_USERS: User[] = [];

export function ChatView({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack?: () => void;
}) {
  const { user, role } = useRole();
  const api = useApiClient();
  // Conversations + this thread's messages read through the API hooks; realtime
  // keeps the thread live when another member posts (or a moderator hides a
  // message). The send path writes via the client and refetches focused state.
  const { data: conversationsData } = useConversations();
  const { data: usersData } = useUsers();
  const { data: messagesData, refetch: refetchMessages } =
    useMessages(conversationId);
  useRealtimeRefetch(["messages"], refetchMessages);
  const conversations = conversationsData ?? [];
  const users = usersData ?? EMPTY_USERS;
  const messages = messagesData ?? EMPTY_MESSAGES;
  const conversation = conversations.find((c) => c.id === conversationId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set());
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moderator = canModerate(role);

  const thread = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === conversationId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [messages, conversationId]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [thread.length]);

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Pick a conversation to start chatting.
      </div>
    );
  }

  const canPost = canPostInConversation({ conversation, user });
  const otherMember =
    conversation.kind === "dm"
      ? users.find(
          (u) => u.id !== user.id && conversation.memberIds.includes(u.id)
        )
      : undefined;

  async function send() {
    if (sending || !draft.trim() || !canPost) return;
    setSending(true);
    try {
      await api.sendMessage({
        conversationId: conversation!.id,
        authorId: user.id,
        body: draft.trim(),
      });
      setDraft("");
      refetchMessages();
    } finally {
      setSending(false);
    }
  }

  async function submitReport(input: {
    messageId: string;
    reason: ModerationReason;
    note: string;
  }) {
    await api.createModerationReport({
      messageId: input.messageId,
      reporterId: user.id,
      reason: input.reason,
      reporterNote: input.note.trim() || undefined,
    });
    emailOnModerationReport(users, user.id, input.note.trim() || undefined);
    setReportedIds((prev) => {
      const next = new Set(prev);
      next.add(input.messageId);
      return next;
    });
  }

  return (
    <div className="flex flex-1 flex-col min-w-0">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden -ml-1 p-1.5 rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <ConversationIcon kind={conversation.kind} name={conversation.title} />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight truncate">
              {conversation.title}
            </h2>
            <p className="text-xs text-muted-foreground capitalize">
              {conversation.kind === "dm" && otherMember
                ? otherMember.email
                : `${conversation.memberIds.length} members · ${conversation.kind.replace(
                    "_",
                    "-"
                  )}`}
            </p>
          </div>
        </div>

        {conversation.kind === "all_team" && (
          <Badge variant="warning" className="hidden sm:inline-flex">
            <Pin className="h-3 w-3 mr-1" /> Pinned announcements
          </Badge>
        )}
        {conversation.kind === "admins_only" && (
          <Badge variant="danger" className="hidden sm:inline-flex">
            <Shield className="h-3 w-3 mr-1" /> Admins & leaders only
          </Badge>
        )}
      </header>

      {conversation.kind !== "dm" && conversation.kind !== "admins_only" && (
        <div className="border-b border-border bg-secondary/40 px-5 py-2.5 flex items-start gap-2">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Be kind. This chat is moderated. Anything that feels off — flag it
            with the report button on a message.
          </p>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-4"
      >
        {thread.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-6 text-center">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Be the first to post.
            </p>
          </div>
        )}

        {thread.map((m, idx) => {
          const author = users.find((u) => u.id === m.authorId);
          const isMe = m.authorId === user.id;
          const prev = thread[idx - 1];
          const showDate =
            !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
          const dense =
            prev &&
            prev.authorId === m.authorId &&
            new Date(m.createdAt).getTime() -
              new Date(prev.createdAt).getTime() <
              5 * 60_000;

          return (
            <div key={m.id}>
              {showDate && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {format(new Date(m.createdAt), "EEE, MMM d")}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}

              <div
                className={cn(
                  "flex gap-3",
                  isMe && "justify-end",
                  dense && "mt-0.5"
                )}
              >
                {!isMe && !dense && (
                  <Avatar className="h-8 w-8 mt-0.5">
                    <AvatarFallback className="text-[10px]">
                      {initials(author?.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                )}
                {!isMe && dense && <div className="w-8" />}

                <div
                  className={cn(
                    "max-w-[75%]",
                    isMe ? "items-end" : "items-start",
                    "flex flex-col"
                  )}
                >
                  {!dense && (
                    <div
                      className={cn(
                        "flex items-center gap-2 mb-0.5",
                        isMe && "flex-row-reverse"
                      )}
                    >
                      <span className="text-xs font-medium">
                        {isMe ? "You" : author?.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(m.createdAt), "h:mm a")}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-soft",
                      isMe
                        ? "bg-brand-gradient text-white rounded-tr-sm"
                        : "bg-card border border-border rounded-tl-sm",
                      m.hiddenAt && "italic opacity-70"
                    )}
                  >
                    {m.hiddenAt && !moderator
                      ? "[message hidden by a moderator]"
                      : m.body}
                    {m.hiddenAt && moderator && (
                      <span className="block mt-1 text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                        <EyeOff className="h-3 w-3" /> hidden
                      </span>
                    )}
                  </div>
                  {isMe ? (
                    <span className="mt-0.5 text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      <CheckCheck className="h-3 w-3 text-primary" />
                      Read
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setReportTarget({ id: m.id, body: m.body })
                      }
                      disabled={reportedIds.has(m.id)}
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-60 disabled:cursor-default"
                      aria-label={
                        reportedIds.has(m.id)
                          ? "Already reported"
                          : "Report this message"
                      }
                    >
                      <Flag className="h-3 w-3" />
                      {reportedIds.has(m.id) ? "Reported" : "Report"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-card/60 p-3">
        {canPost ? (
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="icon" type="button">
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Attach</span>
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                conversation.kind === "all_team"
                  ? "Post an announcement to the whole team…"
                  : "Write a message — Enter to send, Shift+Enter for newline"
              }
              className="min-h-[44px] max-h-40 resize-none"
            />
            <Button
              variant="gradient"
              size="icon"
              onClick={send}
              disabled={!draft.trim() || sending}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        ) : (
          <div className="rounded-md bg-secondary px-3 py-2.5 text-xs text-muted-foreground text-center">
            {conversation.kind === "all_team"
              ? "Only leaders and admins can post in the all-team channel."
              : "You don't have permission to post in this conversation."}
          </div>
        )}
      </div>

      <ReportDialog
        key={reportTarget?.id ?? "no-report-target"}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={async ({ reason, note }) => {
          if (!reportTarget) return;
          await submitReport({
            messageId: reportTarget.id,
            reason,
            note,
          });
          // The dialog stays open and shows a success state; the user
          // closes it manually so they read the confirmation copy.
        }}
      />
    </div>
  );
}

const REASON_OPTIONS: { value: ModerationReason; label: string }[] = [
  { value: "inappropriate_language", label: "Inappropriate language" },
  { value: "bullying_or_harassment", label: "Bullying or harassment" },
  { value: "personal_information", label: "Personal / private info shared" },
  { value: "off_topic_or_spam", label: "Off-topic or spam" },
  { value: "other", label: "Other" },
];

function ReportDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: { id: string; body: string } | null;
  onClose: () => void;
  onSubmit: (input: { reason: ModerationReason; note: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState<ModerationReason>("inappropriate_language");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!target) return null;

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report message</DialogTitle>
          <DialogDescription className="text-xs">
            We take this seriously. Pick the closest reason and add details
            if you&apos;d like — an admin will review.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="px-5 pb-5 space-y-3 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Flag className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Thanks — an admin will review this.</p>
            <p className="text-xs text-muted-foreground">
              You won&apos;t see follow-up here, but action is taken privately.
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-3">
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Message you&apos;re reporting
              </p>
              <p className="text-sm mt-1 line-clamp-3">{target.body}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Reason</label>
              <Select
                value={reason}
                onChange={(e) => setReason(e.target.value as ModerationReason)}
              >
                {REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Note <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything else the admin should know?"
                className="min-h-[80px]"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="gradient"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSubmit({ reason, note });
                    setDone(true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Flag className="h-4 w-4" /> Send report
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConversationIcon({
  kind,
  name,
}: {
  kind: string;
  name: string;
}) {
  if (kind === "all_team")
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-white shadow-soft">
        <Megaphone className="h-4 w-4" />
      </div>
    );
  if (kind === "admins_only")
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700">
        <Shield className="h-4 w-4" />
      </div>
    );
  if (kind === "issue")
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
        <Hash className="h-4 w-4" />
      </div>
    );
  if (kind === "group")
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
        <UsersIcon className="h-4 w-4" />
      </div>
    );
  return (
    <Avatar className="h-9 w-9">
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
