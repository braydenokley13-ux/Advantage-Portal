"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FilterBar,
  DEFAULT_FILTERS,
  applyFilters,
  type CalendarFilters,
} from "@/components/calendar/filter-bar";
import { MonthView } from "@/components/calendar/month-view";
import { AgendaView } from "@/components/calendar/agenda-view";
import { TaskDrawer } from "@/components/task/task-drawer";
import { useVisibleTasks } from "@/lib/hooks";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

type View = "month" | "agenda";
const EMPTY_TASKS: Task[] = [];

export default function CalendarPage() {
  const { role } = useRole();
  const { data: baseTasksData } = useVisibleTasks();
  const baseTasks = baseTasksData ?? EMPTY_TASKS;
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyFilters(baseTasks, filters),
    [baseTasks, filters]
  );

  const isMaster = role === "leader" || role === "admin";

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Calendar"
        description={
          isMaster
            ? "Master calendar — every deadline across the team."
            : role === "editor"
              ? "Deadlines for tasks you're reviewing."
              : "Your deadlines."
        }
        actions={
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            <ToggleButton
              active={view === "month"}
              onClick={() => setView("month")}
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Month"
            />
            <ToggleButton
              active={view === "agenda"}
              onClick={() => setView("agenda")}
              icon={<ListChecks className="h-3.5 w-3.5" />}
              label="Agenda"
            />
          </div>
        }
      />

      <Card className="p-4">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          showWriter={isMaster}
          showEditor={isMaster || role === "writer"}
        />
      </Card>

      {view === "month" ? (
        <MonthView
          tasks={filtered}
          cursor={cursor}
          onCursorChange={setCursor}
          onSelectTask={(id) => setOpenTaskId(id)}
        />
      ) : (
        <AgendaView
          tasks={filtered}
          onSelectTask={(id) => setOpenTaskId(id)}
        />
      )}

      <TaskDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      size="sm"
      variant="ghost"
      className={cn(
        "h-8 px-3",
        active && "bg-secondary text-foreground shadow-soft"
      )}
    >
      {icon}
      {label}
    </Button>
  );
}
