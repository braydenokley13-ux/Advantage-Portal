"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskCard } from "./task-card";
import { TaskDrawer } from "@/components/task/task-drawer";
import { useRole } from "@/lib/role-context";
import { useStore } from "@/lib/store";
import { visibleTasks } from "@/lib/visibility";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  canDragTask,
  canDropTask,
  isValidTransition,
} from "@/lib/kanban-rules";
import { STATUS_DEFINITIONS, deriveSubState } from "@/lib/status";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type BlockedToast = { title: string; reason: string } | null;

export function KanbanBoard() {
  const { role, user } = useRole();
  const { tasks, submissions, reviews, setTaskStatus } = useStore();
  const submissionTaskMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of submissions) m.set(s.id, s.taskId);
    return m;
  }, [submissions]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<TaskStatus | null>(null);
  const [blocked, setBlocked] = useState<BlockedToast>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const myTasks = useMemo(
    () => visibleTasks({ tasks, role, userId: user.id }),
    [tasks, role, user.id]
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      not_started: [],
      in_progress: [],
      submitted: [],
      complete: [],
    };
    for (const t of myTasks) map[t.status].push(t);
    return map;
  }, [myTasks]);

  function showBlocked(title: string, reason: string) {
    setBlocked({ title, reason });
    setTimeout(() => setBlocked(null), 2400);
  }

  function handleDragStart(task: Task, e: React.DragEvent) {
    const isOwn = task.writerId === user.id;
    if (!canDragTask({ role, isOwnTask: isOwn, from: task.status })) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(task.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setHoveredCol(null);
  }

  function handleDrop(to: TaskStatus, e: React.DragEvent) {
    e.preventDefault();
    setHoveredCol(null);
    const id = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const isOwn = task.writerId === user.id;
    if (!canDropTask({ role, isOwnTask: isOwn, to })) {
      showBlocked(task.title, dropDeniedReason({ role, isOwn, to }));
      return;
    }
    if (!isValidTransition(task.status, to)) {
      showBlocked(task.title, transitionDeniedReason(task.status, to));
      return;
    }
    if (task.status === to) return;
    if (to === "submitted") {
      showBlocked(
        task.title,
        "Use the Submission flow — drag-to-submit is disabled."
      );
      return;
    }
    if (task.status === "submitted" && to === "complete") {
      showBlocked(
        task.title,
        "Submitted work must go through editor review."
      );
      return;
    }

    setTaskStatus(task.id, to);
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[60vh]">
        {STATUS_ORDER.map((status) => {
          const items = tasksByStatus[status];
          const isHover = hoveredCol === status;
          return (
            <Card
              key={status}
              onDragOver={(e) => {
                if (draggingId) {
                  e.preventDefault();
                  setHoveredCol(status);
                }
              }}
              onDragLeave={() =>
                setHoveredCol((c) => (c === status ? null : c))
              }
              onDrop={(e) => handleDrop(status, e)}
              className={cn(
                "flex flex-col bg-secondary/50 border-dashed transition-colors",
                isHover && "ring-2 ring-primary/40 bg-primary/5"
              )}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <ColumnDot status={status} />
                  <h3
                    className="text-sm font-semibold tracking-tight"
                    title={STATUS_DEFINITIONS[status].description}
                  >
                    {STATUS_LABELS[status]}
                  </h3>
                </div>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <p className="px-4 -mt-1 pb-2 text-[11px] text-muted-foreground">
                {STATUS_DEFINITIONS[status].description}
              </p>

              <div className="flex-1 p-3 space-y-2 scroll-thin overflow-y-auto">
                <AnimatePresence>
                  {items.map((task) => {
                    const isOwn = task.writerId === user.id;
                    const draggable = canDragTask({
                      role,
                      isOwnTask: isOwn,
                      from: task.status,
                    });
                    const sub = deriveSubState({
                      task,
                      reviews,
                      submissionTaskMap,
                    });
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        draggable={draggable}
                        isDragging={draggingId === task.id}
                        onDragStart={(e) => handleDragStart(task, e)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setOpenTaskId(task.id)}
                        changesRequested={sub === "changes_requested"}
                      />
                    );
                  })}
                </AnimatePresence>

                {items.length === 0 && (
                  <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    Nothing here
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <TaskDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />

      {blocked && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md">
          <div className="rounded-lg bg-foreground text-background shadow-elevated px-4 py-3 text-sm">
            <p className="font-medium">Move blocked</p>
            <p className="text-xs opacity-80 mt-0.5">
              <span className="font-medium">{blocked.title}</span> · {blocked.reason}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ColumnDot({ status }: { status: TaskStatus }) {
  const cls = {
    not_started: "bg-muted-foreground/40",
    in_progress: "bg-primary",
    submitted: "bg-amber-500",
    complete: "bg-emerald-500",
  }[status];
  return <span className={cn("h-2 w-2 rounded-full", cls)} />;
}

function dropDeniedReason(args: {
  role: string;
  isOwn: boolean;
  to: TaskStatus;
}) {
  if (args.role === "editor")
    return "Editors don't move cards — review the submission instead.";
  if (args.role === "writer" && !args.isOwn)
    return "Writers can only move their own tasks.";
  if (args.role === "writer")
    return "Writers move only between Not Started and In Progress.";
  return "Move not allowed.";
}

function transitionDeniedReason(from: TaskStatus, to: TaskStatus) {
  if (from === "in_progress" && to === "submitted")
    return "Cannot drag into Submitted — use the Submission flow.";
  if (from === "submitted" && to === "complete")
    return "Submitted work must be reviewed by an editor.";
  if (from === "complete") return "Complete tasks cannot be moved.";
  return `Invalid transition: ${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}.`;
}
