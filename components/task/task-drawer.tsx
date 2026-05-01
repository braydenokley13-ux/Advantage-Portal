"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ClipboardList,
  Inbox,
  MessageSquare,
  Pencil,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SubmissionForm } from "./submission-form";
import { SubmissionHistory } from "./submission-history";
import { SubmissionViewer } from "./submission-viewer";
import { CommentsPanel } from "./comments-panel";
import { ReviewPanel } from "./review-panel";
import { TaskFormDialog } from "./task-form-dialog";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { canEditTask, canReview, canSubmit } from "@/lib/permissions";
import { STATUS_LABELS } from "@/lib/kanban-rules";
import { STATUS_DEFINITIONS } from "@/lib/status";
import { initials, cn } from "@/lib/utils";
import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import type { Submission, Task } from "@/lib/types";

const STATUS_TONE: Record<
  Task["status"],
  "default" | "secondary" | "warning" | "success"
> = {
  not_started: "secondary",
  in_progress: "default",
  submitted: "warning",
  complete: "success",
};

export function TaskDrawer({
  taskId,
  open,
  onOpenChange,
}: {
  taskId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { tasks, submissions, users } = useStore();
  const { user } = useRole();

  const task = useMemo(
    () => tasks.find((t) => t.id === taskId) ?? null,
    [tasks, taskId]
  );
  const taskSubmissions = useMemo(
    () =>
      task
        ? submissions
            .filter((s) => s.taskId === task.id)
            .sort((a, b) => b.version - a.version)
        : [],
    [submissions, task]
  );
  const current = taskSubmissions.find((s) => s.isCurrent) ?? taskSubmissions[0];

  const [selectedId, setSelectedId] = useState<string | undefined>(current?.id);
  useEffect(() => {
    setSelectedId(current?.id);
  }, [current?.id, taskId]);

  const selected: Submission | undefined =
    taskSubmissions.find((s) => s.id === selectedId) ?? current;

  const [tab, setTab] = useState("brief");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!task) return;
    if (canReview({ task, user })) setTab("review");
    else if (canSubmit({ task, user })) setTab("submit");
    else setTab("brief");
  }, [task, user]);

  if (!task) return null;

  const writer = users.find((u) => u.id === task.writerId);
  const editor = task.editorId
    ? users.find((u) => u.id === task.editorId)
    : undefined;
  const due = new Date(task.deadline);
  const overdue = isPast(due) && task.status !== "complete";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="p-0">
        <DialogHeader className="pr-12">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_TONE[task.status]}>
                {STATUS_LABELS[task.status]}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {task.color}
              </Badge>
            </div>
            {canEditTask(user.role) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
          <DialogTitle className="text-lg leading-tight mt-1">
            {task.title}
          </DialogTitle>
          <DialogDescription>
            <span className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span className={cn(overdue && "text-red-600 font-medium")}>
                  {overdue
                    ? `Overdue ${formatDistanceToNowStrict(due)}`
                    : `Due ${format(due, "MMM d, yyyy")}`}
                </span>
              </span>
              {writer && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">
                      {initials(writer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{writer.name} · writer</span>
                </span>
              )}
              {editor && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">
                      {initials(editor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{editor.name} · editor</span>
                </span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          <Tabs value={tab} onValueChange={setTab} className="p-5">
            <TabsList>
              <TabsTrigger value="brief">
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Brief
              </TabsTrigger>
              <TabsTrigger value="submit">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Submission
              </TabsTrigger>
              <TabsTrigger value="review">
                <Inbox className="h-3.5 w-3.5 mr-1.5" /> Review
              </TabsTrigger>
              <TabsTrigger value="comments">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Comments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brief" className="mt-4 space-y-4">
              <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  What this status means
                </p>
                <p className="text-sm leading-snug">
                  {STATUS_DEFINITIONS[task.status].description}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Next:</span>{" "}
                  {STATUS_DEFINITIONS[task.status].nextAction[
                    user.role === "admin" ? "leader" : user.role
                  ]}
                </p>
              </div>

              {(task.wordCountTarget ||
                task.citationsRequired ||
                task.extensionRequest) && (
                <div className="grid grid-cols-2 gap-2">
                  {task.wordCountTarget && (
                    <div className="rounded-md border border-border bg-card p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Word count target
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {task.wordCountTarget.toLocaleString()} words
                      </p>
                    </div>
                  )}
                  {task.citationsRequired && (
                    <div className="rounded-md border border-border bg-card p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Citations
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        Required for sources
                      </p>
                    </div>
                  )}
                  {task.extensionRequest && (
                    <div className="rounded-md border border-border bg-card p-2.5 col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Extension request — {task.extensionRequest.status}
                      </p>
                      <p className="text-xs mt-0.5">
                        New deadline:{" "}
                        {format(
                          new Date(task.extensionRequest.newDeadline),
                          "MMM d, yyyy"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {task.extensionRequest.reason}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Instructions
                </h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap mt-2">
                  {task.instructions}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="submit" className="mt-4 space-y-5">
              <SubmissionForm task={task} />

              <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Version history
                </h4>
                <SubmissionHistory
                  taskId={task.id}
                  selectedId={selected?.id}
                  onSelect={(s) => setSelectedId(s.id)}
                />
                {selected && (
                  <div className="pt-2">
                    <SubmissionViewer submission={selected} task={task} />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="review" className="mt-4 space-y-5">
              {selected ? (
                <SubmissionViewer submission={selected} task={task} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing to review yet.
                </p>
              )}

              <ReviewPanel task={task} submission={selected} />

              {taskSubmissions.length > 1 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                    Earlier versions
                  </h4>
                  <SubmissionHistory
                    taskId={task.id}
                    selectedId={selected?.id}
                    onSelect={(s) => setSelectedId(s.id)}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="comments" className="mt-4">
              <CommentsPanel task={task} submission={selected} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      <TaskFormDialog
        mode="edit"
        task={task}
        open={editing}
        onOpenChange={setEditing}
      />
    </Dialog>
  );
}
