"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquarePlus, Plus, Send, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { canComment } from "@/lib/permissions";
import { cn, initials } from "@/lib/utils";
import { format } from "date-fns";
import type { Submission, Task } from "@/lib/types";

export function InlineMarkdownViewer({
  task,
  submission,
}: {
  task: Task;
  submission: Submission;
}) {
  const { user } = useRole();
  const { comments, users, addComment, toggleResolveComment } = useStore();

  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [collapsedLines, setCollapsedLines] = useState<Set<number>>(new Set());

  const allowed = canComment({ task, user });

  const lines = useMemo(
    () => submission.content.split(/\r?\n/),
    [submission.content]
  );

  /** All inline comments for THIS submission version, grouped by 1-indexed line. */
  const byLine = useMemo(() => {
    const m = new Map<number, typeof comments>();
    comments
      .filter(
        (c) =>
          c.submissionId === submission.id &&
          c.inline &&
          typeof c.lineNumber === "number"
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .forEach((c) => {
        const n = c.lineNumber as number;
        const arr = m.get(n) ?? [];
        arr.push(c);
        m.set(n, arr);
      });
    return m;
  }, [comments, submission.id]);

  function toggleLineCollapsed(line: number) {
    setCollapsedLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }

  function send(line: number) {
    if (!draft.trim()) return;
    addComment({
      submissionId: submission.id,
      authorId: user.id,
      body: draft.trim(),
      inline: true,
      lineNumber: line,
    });
    setDraft("");
    setActiveLine(null);
  }

  return (
    <article className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/40">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Inline · v{submission.version}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>
        {allowed && (
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Click a line number to leave a comment.
          </span>
        )}
      </div>

      <div className="font-mono text-[13px] leading-relaxed">
        {lines.map((text, idx) => {
          const lineNo = idx + 1;
          const lineComments = byLine.get(lineNo) ?? [];
          const allResolved =
            lineComments.length > 0 &&
            lineComments.every((c) => c.resolved);
          const collapsed = collapsedLines.has(lineNo) || allResolved;
          const hasComments = lineComments.length > 0;
          const isActive = activeLine === lineNo;

          return (
            <div key={lineNo} className="group">
              <div
                className={cn(
                  "flex items-start gap-3 px-4 py-0.5 hover:bg-secondary/40 transition-colors",
                  isActive && "bg-primary/5",
                  hasComments && !allResolved && "bg-amber-50/40"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!allowed) return;
                    setActiveLine((prev) => (prev === lineNo ? null : lineNo));
                  }}
                  disabled={!allowed}
                  className={cn(
                    "shrink-0 w-9 select-none text-right tabular-nums text-[11px] pt-1",
                    allowed
                      ? "text-muted-foreground hover:text-primary cursor-pointer"
                      : "text-muted-foreground/60",
                    isActive && "text-primary font-medium"
                  )}
                  aria-label={`Add comment to line ${lineNo}`}
                  title={allowed ? `Comment on line ${lineNo}` : undefined}
                >
                  {lineNo}
                </button>
                <pre className="flex-1 min-w-0 whitespace-pre-wrap break-words py-1">
                  {text || " "}
                </pre>
                {hasComments && (
                  <button
                    type="button"
                    onClick={() => toggleLineCollapsed(lineNo)}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] mt-0.5",
                      allResolved
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    )}
                    title={collapsed ? "Expand comments" : "Collapse comments"}
                  >
                    <MessageSquarePlus className="h-3 w-3" />
                    {lineComments.length}
                  </button>
                )}
              </div>

              {hasComments && !collapsed && (
                <div className="ml-12 mr-4 mb-2 mt-1 space-y-2">
                  {lineComments.map((c) => {
                    const author = users.find((u) => u.id === c.authorId);
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "rounded-lg border border-border bg-background p-2.5 text-[12.5px] font-sans",
                          c.resolved && "opacity-60"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[9px]">
                              {initials(author?.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium">
                                {author?.name}
                              </p>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(c.createdAt), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="mt-0.5 leading-relaxed">{c.body}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleResolveComment(c.id)}
                            className={cn(
                              "text-[10px] flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors",
                              c.resolved
                                ? "bg-emerald-100 text-emerald-700"
                                : "text-muted-foreground hover:bg-accent"
                            )}
                          >
                            <Check className="h-3 w-3" />
                            {c.resolved ? "Resolved" : "Resolve"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasComments && collapsed && allResolved && (
                <div className="ml-12 mr-4 mb-1 -mt-0.5">
                  <button
                    type="button"
                    onClick={() => toggleLineCollapsed(lineNo)}
                    className="text-[10.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    {lineComments.length} resolved
                  </button>
                </div>
              )}

              {isActive && allowed && (
                <div className="ml-12 mr-4 mb-2 mt-1 rounded-lg border border-primary/30 bg-background p-2 font-sans">
                  <Textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Comment on line ${lineNo}…`}
                    className="min-h-[56px] border-0 shadow-none focus-visible:ring-0 px-1.5 text-sm"
                  />
                  <div className="flex items-center justify-between px-1 pt-1">
                    <p className="text-[10px] text-muted-foreground">
                      Anchored to v{submission.version}, line {lineNo}.
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setActiveLine(null);
                          setDraft("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => send(lineNo)}
                        disabled={!draft.trim()}
                      >
                        <Send className="h-3.5 w-3.5" /> Comment
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
