"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  Hash,
  Megaphone,
  Paperclip,
  Pin,
  Send,
  Users as UsersIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { canPostInConversation } from "@/lib/permissions";
import { initials, cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";

export function ChatView({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack?: () => void;
}) {
  const { user } = useRole();
  const { conversations, messages, users, sendMessage } = useStore();
  const conversation = conversations.find((c) => c.id === conversationId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  function send() {
    if (!draft.trim() || !canPost) return;
    sendMessage({
      conversationId: conversation!.id,
      authorId: user.id,
      body: draft.trim(),
    });
    setDraft("");
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
      </header>

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
                        : "bg-card border border-border rounded-tl-sm"
                    )}
                  >
                    {m.body}
                  </div>
                  {isMe && (
                    <span className="mt-0.5 text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      <CheckCheck className="h-3 w-3 text-primary" />
                      Read
                    </span>
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
              disabled={!draft.trim()}
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
    </div>
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
