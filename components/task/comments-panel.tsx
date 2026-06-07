"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquare, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useApiClient } from "@/lib/api/provider";
import { useComments } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { emailOnComment } from "@/lib/email/workflow";
import { useRole } from "@/lib/role-context";
import { canComment } from "@/lib/permissions";
import { initials, cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Comment, Submission, Task } from "@/lib/types";

const EMPTY_COMMENTS: Comment[] = [];

export function CommentsPanel({
  task,
  submission,
}: {
  task: Task;
  submission?: Submission;
}) {
  const { user } = useRole();
  const api = useApiClient();
  // Comments for the selected submission via the API hook; users stays on the
  // store for the sync name lookup.
  const { data: commentsData, refetch: refetchComments } = useComments(
    submission?.id
  );
  const { users } = useStore();
  const comments = commentsData ?? EMPTY_COMMENTS;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const allowed = canComment({ task, user });

  async function resolve(id: string) {
    if (resolvingId) return;
    setResolvingId(id);
    setError(null);
    try {
      await api.toggleResolveComment(id);
      refetchComments();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't update that comment. Please try again."
      );
    } finally {
      setResolvingId(null);
    }
  }

  const { general, inline } = useMemo(() => {
    if (!submission) return { general: [] as Comment[], inline: [] as Comment[] };
    const all = comments
      .filter((c) => c.submissionId === submission.id)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    return {
      general: all.filter((c) => !c.inline),
      inline: all.filter((c) => c.inline),
    };
  }, [comments, submission]);

  if (!submission) {
    return (
      <p className="text-sm text-muted-foreground">
        Comments appear once a submission exists.
      </p>
    );
  }

  async function send() {
    if (busy || !draft.trim() || !submission) return;
    setBusy(true);
    setError(null);
    try {
      await api.createComment({
        submissionId: submission.id,
        authorId: user.id,
        body: draft.trim(),
        inline: false,
      });
      emailOnComment(task, user.id);
      setDraft("");
      refetchComments();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't post that comment. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            General comments
          </h4>
          <span className="text-[10px] text-muted-foreground">
            v{submission.version}
          </span>
        </div>

        {general.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center">
            <MessageSquare className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-sm font-medium">No general comments yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Leave overall feedback for the writer.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {general.map((c) => {
              const author = users.find((u) => u.id === c.authorId);
              return (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-lg border border-border bg-card p-3",
                    c.resolved && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {initials(author?.name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{author?.name}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(c.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm mt-1 leading-relaxed">{c.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => resolve(c.id)}
                      disabled={resolvingId === c.id}
                      className={cn(
                        "text-xs flex items-center gap-1 rounded-md px-2 py-1 transition-colors disabled:opacity-50",
                        c.resolved
                          ? "bg-emerald-100 text-emerald-700"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Check className="h-3 w-3" />
                      {c.resolved ? "Resolved" : "Resolve"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {allowed ? (
          <div className="rounded-lg border border-border bg-card p-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a general comment…"
              className="min-h-[64px] border-0 shadow-none focus-visible:ring-0 px-2"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <p className="text-[10px] text-muted-foreground">
                For line-anchored notes, use the inline viewer in the Review tab.
              </p>
              <Button
                size="sm"
                onClick={send}
                disabled={!draft.trim() || busy}
              >
                <Send className="h-3.5 w-3.5" />{" "}
                {busy ? "Posting…" : "Comment"}
              </Button>
            </div>
            {error && (
              <p className="px-2 pb-2 text-xs text-red-600">{error}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            You don&apos;t have permission to comment on this task.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Inline comments
          </h4>
          <Badge variant="secondary" className="h-5">
            {inline.length}
          </Badge>
        </div>
        {inline.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No inline comments on this version yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {inline.map((c) => {
              const author = users.find((u) => u.id === c.authorId);
              return (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-md border border-border bg-card p-2.5",
                    c.resolved && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="h-5 shrink-0">
                      L{c.lineNumber}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">{author?.name}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(c.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-[13px] mt-0.5 leading-relaxed">
                        {c.body}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => resolve(c.id)}
                      disabled={resolvingId === c.id}
                      className={cn(
                        "text-[10px] flex items-center gap-1 rounded-md px-1.5 py-0.5 disabled:opacity-50",
                        c.resolved
                          ? "bg-emerald-100 text-emerald-700"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Check className="h-3 w-3" />
                      {c.resolved ? "Resolved" : "Resolve"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
