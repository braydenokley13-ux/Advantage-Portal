"use client";

import { format, isPast, isToday, isTomorrow } from "date-fns";
import { Calendar } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { STATUS_LABELS } from "@/lib/kanban-rules";
import { cn, initials } from "@/lib/utils";
import type { Task } from "@/lib/types";

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

export function AgendaView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[];
  onSelectTask?: (id: string) => void;
}) {
  const { users } = useStore();

  const sorted = [...tasks].sort(
    (a, b) =>
      new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  );

  const groups = new Map<string, Task[]>();
  for (const t of sorted) {
    const key = format(new Date(t.deadline), "yyyy-MM-dd");
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  if (groups.size === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center">
        <Calendar className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">No deadlines match these filters</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try widening the writer or status filter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([dateKey, dayTasks]) => {
        const date = new Date(dateKey);
        const isOverdueGroup = dayTasks.every(
          (t) => isPast(date) && t.status !== "complete"
        );
        return (
          <section key={dateKey}>
            <div className="flex items-center gap-2 mb-2">
              <h3
                className={cn(
                  "text-sm font-semibold tracking-tight",
                  isOverdueGroup && "text-red-600"
                )}
              >
                {dateLabel(date)}
              </h3>
              <span className="text-xs text-muted-foreground">
                {format(date, "EEE, MMM d")}
              </span>
              <Badge variant="secondary">{dayTasks.length}</Badge>
            </div>

            <ul className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border shadow-soft">
              {dayTasks.map((t) => {
                const writer = users.find((u) => u.id === t.writerId);
                const editor = t.editorId
                  ? users.find((u) => u.id === t.editorId)
                  : undefined;
                const overdue =
                  isPast(new Date(t.deadline)) && t.status !== "complete";
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTask?.(t.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/60 transition-colors text-left"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          COLOR_DOT[t.color]
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {t.title}
                        </p>
                        <p
                          className={cn(
                            "text-xs text-muted-foreground mt-0.5",
                            overdue && "text-red-600 font-medium"
                          )}
                        >
                          {format(new Date(t.deadline), "h:mm a")} ·{" "}
                          {writer?.name}
                          {editor && ` → ${editor.name}`}
                        </p>
                      </div>
                      <Badge variant={STATUS_TONE[t.status]}>
                        {STATUS_LABELS[t.status]}
                      </Badge>
                      {editor && (
                        <Avatar className="h-7 w-7 hidden sm:flex">
                          <AvatarFallback className="text-[10px]">
                            {initials(editor.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function dateLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isPast(d)) return "Overdue";
  return format(d, "EEEE");
}
