"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Inbox,
  MessageSquare,
  Pencil,
  Send,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addDays } from "date-fns";
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
import { EditorialChecklist } from "./editorial-checklist";
import { SensitivePanel } from "./sensitive-panel";
import { useEditorialChecklist, useTasks } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { canEditTask, canReview, canSubmit } from "@/lib/permissions";
import { STATUS_LABELS } from "@/lib/kanban-rules";
import { STATUS_DEFINITIONS } from "@/lib/status";
import {
  STAGE_DEFINITIONS,
  deriveStoryStage,
  nextActionForRole,
} from "@/lib/newsroom-stage";
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
  // Tasks are the source of truth — read via useTasks so sensitive flag
  // changes triggered inside the drawer (raise/clear/hold) round-trip via
  // the API and refetch into this view too.
  const { data: tasksData, refetch: refetchTasks } = useTasks();
  // Sync caches kept on the store: submissions, users, sections, issues,
  // and the existing extension-request mutators (unchanged this phase).
  const {
    submissions,
    users,
    sections,
    issues,
    requestExtension,
    decideExtension,
  } = useStore();
  const tasks = tasksData ?? [];
  const { user } = useRole();
  const [extOpen, setExtOpen] = useState(false);
  const [extDate, setExtDate] = useState("");
  const [extReason, setExtReason] = useState("");

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

  // Pull the checklist BEFORE any early-return so React's hook count
  // stays stable across renders. The hook accepts nullable ids and just
  // resolves to null when there's no task yet.
  const { data: checklistData } = useEditorialChecklist(task?.id ?? null);

  if (!task) return null;

  const writer = users.find((u) => u.id === task.writerId);
  const editor = task.editorId
    ? users.find((u) => u.id === task.editorId)
    : undefined;
  const copyEditor = task.copyEditorId
    ? users.find((u) => u.id === task.copyEditorId)
    : undefined;
  const factChecker = task.factCheckerId
    ? users.find((u) => u.id === task.factCheckerId)
    : undefined;
  const section = task.sectionId
    ? sections.find((s) => s.id === task.sectionId)
    : undefined;
  const issue = task.issueId
    ? issues.find((i) => i.id === task.issueId)
    : undefined;
  const checklist = checklistData ?? undefined;
  const stageInfo = deriveStoryStage({ task, checklist: checklist ?? undefined, issue });
  const nextNewsroomAction = nextActionForRole(stageInfo.stage, user.role);
  const due = new Date(task.deadline);
  const overdue = isPast(due) && task.status !== "complete";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="p-0">
        <DialogHeader className="pr-12">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_TONE[task.status]}>
                {STATUS_LABELS[task.status]}
              </Badge>
              <Badge variant={STAGE_DEFINITIONS[stageInfo.stage].tone}>
                {STAGE_DEFINITIONS[stageInfo.stage].label}
              </Badge>
              {section && (
                <Badge variant="secondary">{section.name}</Badge>
              )}
              {issue && (
                <Badge variant="outline">{issue.name}</Badge>
              )}
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
                  <span>{editor.name} · section editor</span>
                </span>
              )}
              {copyEditor && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">
                      {initials(copyEditor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{copyEditor.name} · copy</span>
                </span>
              )}
              {factChecker && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">
                      {initials(factChecker.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{factChecker.name} · fact-check</span>
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
                  Stage · {STAGE_DEFINITIONS[stageInfo.stage].label}
                </p>
                <p className="text-sm leading-snug">
                  {STAGE_DEFINITIONS[stageInfo.stage].description}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Next:</span>{" "}
                  {nextNewsroomAction}
                </p>
                {stageInfo.reasons.length > 0 && (
                  <ul className="text-[11px] text-amber-700 mt-1 space-y-0.5 list-disc pl-4">
                    {stageInfo.reasons.map((r) => (
                      <li key={r.code}>{r.message}</li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2 mt-1">
                  <span className="font-medium">Status:</span>{" "}
                  {STATUS_DEFINITIONS[task.status].description}
                </p>
              </div>

              <SensitivePanel task={task} onChanged={refetchTasks} />

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

              {extensionPanel({
                task,
                user,
                extOpen,
                setExtOpen,
                extDate,
                setExtDate,
                extReason,
                setExtReason,
                requestExtension,
                decideExtension,
              })}

              {task.brief && (
                <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Assignment brief
                  </p>
                  {task.brief.angle && (
                    <BriefRow label="Angle" value={task.brief.angle} />
                  )}
                  {task.brief.mustAnswer && task.brief.mustAnswer.length > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Must-answer questions
                      </p>
                      <ul className="list-disc pl-5 text-sm space-y-0.5">
                        {task.brief.mustAnswer.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {task.brief.requiredSources &&
                    task.brief.requiredSources.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Required sources
                        </p>
                        <ul className="list-disc pl-5 text-sm space-y-0.5">
                          {task.brief.requiredSources.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  {task.brief.quoteRequirements && (
                    <BriefRow
                      label="Quote requirements"
                      value={task.brief.quoteRequirements}
                    />
                  )}
                  {task.brief.visualNeeds && (
                    <BriefRow
                      label="Visuals / design"
                      value={task.brief.visualNeeds}
                    />
                  )}
                  {task.brief.publishingNotes && (
                    <BriefRow
                      label="Publishing notes"
                      value={task.brief.publishingNotes}
                    />
                  )}
                </div>
              )}

              <EditorialChecklist task={task} />

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

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

/**
 * Extension request UI: writers can ask for more time; leaders/admins can
 * approve or deny. Kept inline in the drawer (rather than a separate dialog)
 * so the request and decision live next to the task brief.
 */
function extensionPanel(args: {
  task: Task;
  user: { id: string; role: string };
  extOpen: boolean;
  setExtOpen: (v: boolean) => void;
  extDate: string;
  setExtDate: (v: string) => void;
  extReason: string;
  setExtReason: (v: string) => void;
  requestExtension: (input: {
    taskId: string;
    requestedById: string;
    newDeadline: string;
    reason: string;
  }) => unknown;
  decideExtension: (input: {
    taskId: string;
    decidedById: string;
    approve: boolean;
  }) => void;
}) {
  const {
    task,
    user,
    extOpen,
    setExtOpen,
    extDate,
    setExtDate,
    extReason,
    setExtReason,
    requestExtension,
    decideExtension,
  } = args;

  const isWriter = user.role === "writer" && task.writerId === user.id;
  const isApprover = user.role === "leader" || user.role === "admin";
  const pending = task.extensionRequest?.status === "pending";
  const decided =
    task.extensionRequest &&
    task.extensionRequest.status !== "pending"
      ? task.extensionRequest
      : null;

  const minDate = format(addDays(new Date(task.deadline), 1), "yyyy-MM-dd");

  if (decided) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-xs">
        <p>
          <span className="font-medium">Extension {decided.status}.</span>{" "}
          New deadline: {format(new Date(decided.newDeadline), "MMM d, yyyy")}.
        </p>
      </div>
    );
  }

  if (pending && isApprover && task.extensionRequest) {
    const req = task.extensionRequest;
    return (
      <div className="rounded-lg border border-amber-300/60 bg-amber-50/40 p-3 space-y-2">
        <p className="text-xs font-medium">Extension requested</p>
        <p className="text-xs text-muted-foreground">
          New deadline: {format(new Date(req.newDeadline), "MMM d, yyyy")}
        </p>
        <p className="text-xs">{req.reason}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              decideExtension({
                taskId: task.id,
                decidedById: user.id,
                approve: true,
              })
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              decideExtension({
                taskId: task.id,
                decidedById: user.id,
                approve: false,
              })
            }
          >
            <XCircle className="h-3.5 w-3.5" /> Deny
          </Button>
        </div>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        Extension requested. Waiting for a leader or admin to review.
      </div>
    );
  }

  if (!isWriter) return null;

  if (!extOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setExtOpen(true)}
      >
        <CalendarPlus className="h-3.5 w-3.5" /> Request extension
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-xs font-medium">Request more time</p>
      <Input
        type="date"
        min={minDate}
        value={extDate}
        onChange={(e) => setExtDate(e.target.value)}
      />
      <Textarea
        value={extReason}
        onChange={(e) => setExtReason(e.target.value)}
        placeholder="Tell your editor why you need more time. Be brief and honest."
        className="min-h-[80px]"
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setExtOpen(false);
            setExtDate("");
            setExtReason("");
          }}
        >
          Cancel
        </Button>
        <Button
          variant="gradient"
          size="sm"
          disabled={!extDate || !extReason.trim()}
          onClick={() => {
            requestExtension({
              taskId: task.id,
              requestedById: user.id,
              newDeadline: new Date(extDate).toISOString(),
              reason: extReason.trim(),
            });
            setExtOpen(false);
            setExtDate("");
            setExtReason("");
          }}
        >
          Send request
        </Button>
      </div>
    </div>
  );
}
