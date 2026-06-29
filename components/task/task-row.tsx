"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { useStatusDefinitions } from "@/lib/use-status";
import type { Task } from "@/lib/types";
import { BookOpen, Calendar, Clock } from "lucide-react";
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
  const { user: viewer } = useRole();
  const statusDefs = useStatusDefinitions();
  const writer = users.find((u) => u.id === task.writerId);
  const editor = task.editorId
    ? users.find((u) => u.id === task.editorId)
    : undefined;
  const due = new Date(task.deadline);
  const overdue = isPast(due) && task.status !== "complete";
  // Don't echo the writer's own name back at them — they already know.
  const showWriterName = writer && writer.id !== viewer.id;

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
          {showWriterName && <span>· {writer!.name}</span>}
          {task.citationsRequired && (
            <span className="inline-flex items-center gap-0.5">
              · <BookOpen className="h-3 w-3" /> citations
            </span>
          )}
          {task.extensionRequest?.status === "pending" && (
            <span className="inline-flex items-center gap-0.5 text-amber-700">
              · <Clock className="h-3 w-3" /> extension pending
            </span>
          )}
        </div>
      </div>
      <Badge
        variant={STATUS_TONE[task.status]}
        title={statusDefs[task.status].description}
      >
        {statusDefs[task.status].label}
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
