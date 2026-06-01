"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import {
  BookOpen,
  Calendar,
  Clock,
  GripVertical,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { motion } from "framer-motion";

const COLOR_BORDER: Record<Task["color"], string> = {
  green: "border-l-emerald-500",
  amber: "border-l-amber-500",
  red: "border-l-red-500",
};

export function TaskCard({
  task,
  draggable,
  onDragStart,
  onDragEnd,
  isDragging,
  onClick,
  changesRequested,
  showSubmit,
}: {
  task: Task;
  draggable: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  onClick?: () => void;
  /** Derived sub-state: this in_progress task came back after changes were requested. */
  changesRequested?: boolean;
  /** Writer owns this not-yet-submitted task — show an explicit submit CTA. */
  showSubmit?: boolean;
}) {
  // Use the live store so writer/editor avatars resolve against whichever
  // data mode is active (mock or Supabase). The previous `userById` was
  // wired only to the seed mock data and silently returned undefined in
  // Supabase mode, hiding the assignee avatars on every card.
  const { users, submissions } = useStore();
  const writer = users.find((u) => u.id === task.writerId);
  const editor = task.editorId
    ? users.find((u) => u.id === task.editorId)
    : undefined;
  const due = new Date(task.deadline);
  const overdue = isPast(due) && task.status !== "complete";
  const pendingExtension = task.extensionRequest?.status === "pending";
  const currentVersion =
    submissions.find((s) => s.id === task.currentSubmissionId)?.version ??
    submissions
      .filter((s) => s.taskId === task.id)
      .reduce((max, s) => Math.max(max, s.version), 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.15 }}
      draggable={draggable}
      onDragStart={onDragStart as never}
      onDragEnd={onDragEnd as never}
      onClick={onClick}
      className={cn(
        "group rounded-lg bg-card border border-border border-l-4 shadow-soft",
        COLOR_BORDER[task.color],
        draggable
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-default opacity-95",
        "hover:shadow-elevated transition-shadow"
      )}
    >
      <div className="flex items-start gap-2 p-3">
        {draggable && (
          <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {task.instructions}
          </p>

          {(task.wordCountTarget || task.citationsRequired || changesRequested || pendingExtension) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {changesRequested && (
                <Badge variant="warning" className="gap-1 h-5 px-1.5 text-[10px]">
                  <RefreshCw className="h-3 w-3" /> Changes requested
                </Badge>
              )}
              {task.wordCountTarget && (
                <Badge variant="outline" className="gap-1 h-5 px-1.5 text-[10px]">
                  {task.wordCountTarget.toLocaleString()} words
                </Badge>
              )}
              {task.citationsRequired && (
                <Badge variant="outline" className="gap-1 h-5 px-1.5 text-[10px]">
                  <BookOpen className="h-3 w-3" /> Citations
                </Badge>
              )}
              {pendingExtension && (
                <Badge variant="outline" className="gap-1 h-5 px-1.5 text-[10px]">
                  <Clock className="h-3 w-3" /> Extension requested
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span
                className={cn(
                  "text-muted-foreground",
                  overdue && "text-red-600 font-medium"
                )}
              >
                {overdue
                  ? `Overdue ${formatDistanceToNowStrict(due)}`
                  : format(due, "MMM d")}
              </span>
            </div>
            <div className="flex items-center -space-x-1.5">
              {writer && (
                <Avatar className="h-6 w-6 ring-2 ring-card">
                  <AvatarFallback className="text-[9px]">
                    {initials(writer.name)}
                  </AvatarFallback>
                </Avatar>
              )}
              {editor && (
                <Avatar className="h-6 w-6 ring-2 ring-card">
                  <AvatarFallback className="text-[9px]">
                    {initials(editor.name)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSubmit && (
        <button
          type="button"
          onClick={(e) => {
            // Don't let the click also trigger card drag/select side effects.
            e.stopPropagation();
            onClick?.();
          }}
          className={cn(
            "w-full border-t border-border px-3 py-2 flex items-center justify-center gap-1.5",
            "text-[11px] font-medium rounded-b-lg transition-colors",
            changesRequested
              ? "text-amber-800 bg-amber-50 hover:bg-amber-100"
              : "text-primary hover:bg-primary/5"
          )}
        >
          <Send className="h-3 w-3" />
          {changesRequested ? "Revise & resubmit" : "Submit work"}
        </button>
      )}

      {task.status === "submitted" && (
        <div className="border-t border-border px-3 py-1.5 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-b-lg">
          <MessageSquare className="h-3 w-3" />
          <span>Awaiting editor review</span>
          {currentVersion > 0 && (
            <Badge variant="warning" className="ml-auto">
              v{currentVersion}
            </Badge>
          )}
        </div>
      )}
    </motion.div>
  );
}
