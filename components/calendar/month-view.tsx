"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isTaskOverdue } from "@/lib/status";
import type { Task } from "@/lib/types";

const COLOR_CHIP: Record<Task["color"], string> = {
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-800 border-amber-500/30",
  red: "bg-red-500/15 text-red-700 border-red-500/30",
};

export function MonthView({
  tasks,
  cursor,
  onCursorChange,
  onSelectTask,
}: {
  tasks: Task[];
  cursor: Date;
  onCursorChange: (d: Date) => void;
  onSelectTask?: (id: string) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const tasksByDay = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = format(new Date(t.deadline), "yyyy-MM-dd");
    const arr = tasksByDay.get(key) ?? [];
    arr.push(t);
    tasksByDay.set(key, arr);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          {format(cursor, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCursorChange(new Date())}
          >
            Today
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onCursorChange(subMonths(cursor, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onCursorChange(addMonths(cursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-soft">
        <div className="grid grid-cols-7 border-b border-border bg-secondary/40">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const today = isSameDay(day, new Date());

            return (
              <div
                key={key}
                className={cn(
                  "min-h-[7rem] border-b border-r border-border p-2 flex flex-col gap-1",
                  (idx + 1) % 7 === 0 && "border-r-0",
                  !inMonth && "bg-secondary/30",
                  today && "bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs",
                      today && "bg-foreground text-background font-semibold",
                      !inMonth && !today && "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayTasks.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {dayTasks.slice(0, 3).map((t) => {
                    const overdue = isTaskOverdue(t);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTask?.(t.id)}
                        className={cn(
                          "text-left rounded-md border px-1.5 py-0.5 text-[11px] truncate transition-colors hover:opacity-90",
                          COLOR_CHIP[t.color],
                          overdue && "ring-1 ring-red-400/60"
                        )}
                      >
                        {t.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
