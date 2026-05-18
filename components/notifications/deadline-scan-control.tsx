"use client";

import { useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCheck,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import type { DeadlineReminder } from "@/lib/deadline-reminders";

export function DeadlineScanControl() {
  const { runDeadlineScan, resetDeadlineReminders, tasks } = useStore();
  const [last, setLast] = useState<{
    count: number;
    fired: DeadlineReminder[];
    at: Date;
  } | null>(null);

  function scan() {
    const fired = runDeadlineScan();
    setLast({ count: fired.length, fired, at: new Date() });
  }

  function reset() {
    resetDeadlineReminders();
    setLast(null);
  }

  const upcoming = tasks.filter(
    (t) => t.status !== "complete"
  ).length;

  return (
    <Card className="p-4 border-dashed bg-gradient-to-br from-purple-50/60 via-card to-card">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Deadline reminder simulator</p>
              <Badge variant="outline" className="h-5 text-[10px]">
                Demo
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
              Scans open tasks for 7-day, 3-day, 1-day, and overdue thresholds
              and fires deduped notifications through the existing store.
              {upcoming > 0 && (
                <>
                  {" "}
                  <span className="text-foreground font-medium">
                    {upcoming}
                  </span>{" "}
                  open {upcoming === 1 ? "task" : "tasks"}.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button variant="gradient" size="sm" onClick={scan}>
            <Zap className="h-3.5 w-3.5" /> Run scan
          </Button>
        </div>
      </div>

      {last && (
        <div className="mt-3 rounded-md border border-border bg-card p-2.5">
          {last.count === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
              No new reminders. Already issued or no thresholds matched.
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5" />
              <div className="text-xs">
                Fired{" "}
                <span className="font-semibold">{last.count}</span>{" "}
                {last.count === 1 ? "reminder" : "reminders"}:
                <ul className="mt-1 space-y-0.5 max-h-40 overflow-auto">
                  {last.fired.map((r) => (
                    <li
                      key={r.key}
                      className="text-muted-foreground truncate"
                    >
                      <span className="text-foreground">{kindLabel(r.kind)}</span>{" "}
                      · {r.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function kindLabel(kind: DeadlineReminder["kind"]) {
  switch (kind) {
    case "7d":
      return "7-day";
    case "3d":
      return "3-day";
    case "1d":
      return "1-day";
    case "missed":
      return "Overdue";
  }
}
