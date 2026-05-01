"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, cn } from "@/lib/utils";
import { userById } from "@/lib/mock-data";
import type { Task } from "@/lib/types";
import { Calendar, GripVertical, MessageSquare } from "lucide-react";
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
}: {
  task: Task;
  draggable: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  onClick?: () => void;
}) {
  const writer = userById(task.writerId);
  const editor = task.editorId ? userById(task.editorId) : undefined;
  const due = new Date(task.deadline);
  const overdue = isPast(due) && task.status !== "complete";

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

      {task.status === "submitted" && (
        <div className="border-t border-border px-3 py-1.5 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-b-lg">
          <MessageSquare className="h-3 w-3" />
          <span>Awaiting editor review</span>
          <Badge variant="warning" className="ml-auto">
            v
            {/* version is implied; we show a marker */}1
          </Badge>
        </div>
      )}
    </motion.div>
  );
}
