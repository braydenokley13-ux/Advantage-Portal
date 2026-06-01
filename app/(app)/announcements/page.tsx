"use client";

import { useMemo, useState } from "react";
import { Megaphone, Pin, PinOff, Send, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { canPinMessage, canPostAnnouncement } from "@/lib/permissions";
import { initials, cn } from "@/lib/utils";
import { format, formatDistanceToNowStrict } from "date-fns";

export default function AnnouncementsPage() {
  const { user, role } = useRole();
  const {
    conversations,
    messages,
    users,
    sendMessage,
    togglePinMessage,
    pushNotification,
  } = useStore();
  const [draft, setDraft] = useState("");
  const [pinNew, setPinNew] = useState(true);
  const [busy, setBusy] = useState(false);

  const allTeam = conversations.find((c) => c.kind === "all_team");
  const allowPost = canPostAnnouncement(role);
  const allowPin = canPinMessage(role);

  const thread = useMemo(() => {
    if (!allTeam) return [];
    return messages
      .filter((m) => m.conversationId === allTeam.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [messages, allTeam]);

  const pinned = thread.filter((m) => m.pinnedAt);
  const feed = thread.filter((m) => !m.pinnedAt);

  async function post() {
    if (busy || !draft.trim() || !allTeam || !allowPost) return;
    setBusy(true);
    try {
      const body = draft.trim();
      const m = await sendMessage({
        conversationId: allTeam.id,
        authorId: user.id,
        body,
      });
      if (pinNew && allowPin) {
        await togglePinMessage(m.id);
      }
      for (const memberId of allTeam.memberIds) {
        if (memberId === user.id) continue;
        pushNotification({
          userId: memberId,
          kind: "announcement",
          title: pinNew ? "New pinned announcement" : "New announcement",
          body: body.slice(0, 120),
        });
      }
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-6 md:py-8 space-y-6 max-w-3xl">
      <PageHeader
        title="Announcements"
        description="Team-wide updates. Posted into the all-team channel."
        actions={
          allowPost && (
            <Badge variant="warning" className="gap-1.5">
              <Pin className="h-3 w-3" /> {pinned.length} pinned
            </Badge>
          )
        }
      />

      {allowPost ? (
        <Card>
          <CardHeader>
            <CardTitle>New announcement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What does the team need to hear?"
              className="min-h-[110px]"
            />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-foreground"
                  checked={pinNew}
                  onChange={(e) => setPinNew(e.target.checked)}
                />
                Pin to top of all-team
              </label>
              <Button
                variant="gradient"
                onClick={post}
                disabled={!draft.trim() || busy}
              >
                <Send className="h-4 w-4" /> {busy ? "Posting…" : "Post announcement"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 flex items-start gap-3">
            <div className="mt-0.5 h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Read-only</p>
              <p className="text-xs text-muted-foreground mt-1">
                Only leaders and admins can post announcements. Everyone can
                read them.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {pinned.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pinned
          </h2>
          <div className="space-y-3">
            {pinned.map((m) => (
              <AnnouncementCard
                key={m.id}
                pinned
                allowPin={allowPin}
                authorName={
                  users.find((u) => u.id === m.authorId)?.name ?? "Unknown"
                }
                body={m.body}
                createdAt={m.createdAt}
                onTogglePin={() => togglePinMessage(m.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent
        </h2>
        {feed.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-2">
                <Megaphone className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No announcements yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                The team will see anything posted here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {feed.map((m) => (
              <AnnouncementCard
                key={m.id}
                allowPin={allowPin}
                authorName={
                  users.find((u) => u.id === m.authorId)?.name ?? "Unknown"
                }
                body={m.body}
                createdAt={m.createdAt}
                onTogglePin={() => togglePinMessage(m.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AnnouncementCard({
  pinned,
  authorName,
  body,
  createdAt,
  allowPin,
  onTogglePin,
}: {
  pinned?: boolean;
  authorName: string;
  body: string;
  createdAt: string;
  allowPin: boolean;
  onTogglePin: () => void;
}) {
  return (
    <Card
      className={cn(
        "p-4 flex gap-3 items-start",
        pinned && "ring-2 ring-amber-300/60 bg-amber-50/40"
      )}
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback>{initials(authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{authorName}</p>
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(createdAt), "MMM d, h:mm a")} ·{" "}
            {formatDistanceToNowStrict(new Date(createdAt), { addSuffix: true })}
          </span>
          {pinned && (
            <Badge variant="warning" className="gap-1">
              <Pin className="h-3 w-3" /> Pinned
            </Badge>
          )}
        </div>
        <p className="text-sm leading-relaxed mt-1 whitespace-pre-wrap">
          {body}
        </p>
      </div>
      {allowPin && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onTogglePin}
          aria-label={pinned ? "Unpin" : "Pin"}
        >
          {pinned ? (
            <PinOff className="h-4 w-4" />
          ) : (
            <Pin className="h-4 w-4" />
          )}
        </Button>
      )}
    </Card>
  );
}
