"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { STATUS_LABELS } from "@/lib/kanban-rules";
import type { Task } from "@/lib/types";
import { Calendar } from "lucide-react";
import { format, isPast, formatDistanceToNowStrict } from "date-fns";

const STATUS_TONE: Record<
  Task["status"],
  "default" | "secondary" | "warning" | "success"
> = {
  not_started: "secondary",
  in_progress: "default",
  submitted: "warning",
  complete: "success",
};

const COLOR_DOT: Record<Task["color"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export function TaskRow({
  task,
  onOpen,
}: {
  task: Task;
  onOpen?: (id: string) => void;
}) {
  const { users } = useStore();
  const writer = users.find((u) => u.id === task.writerId);
  const editor = task.editorId
    ? users.find((u) => u.id === task.editorId)
    : undefined;
  const due = new Date(task.deadline);
  const overdue = isPast(due) && task.status !== "complete";

  return (
    <button
      type="button"
      onClick={() => onOpen?.(task.id)}
      className="group w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/60 transition-colors text-left"
    >
      <span className={cn("h-2 w-2 rounded-full", COLOR_DOT[task.color])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span className={cn(overdue && "text-red-600 font-medium")}>
            {overdue
              ? `Overdue ${formatDistanceToNowStrict(due)}`
              : format(due, "MMM d")}
          </span>
          {writer && <span>· {writer.name}</span>}
        </div>
      </div>
      <Badge variant={STATUS_TONE[task.status]}>
        {STATUS_LABELS[task.status]}
      </Badge>
      {editor && (
        <Avatar className="h-7 w-7 hidden sm:flex">
          <AvatarFallback className="text-[10px]">
            {initials(editor.name)}
          </AvatarFallback>
        </Avatar>
      )}
    </button>
  );
}
