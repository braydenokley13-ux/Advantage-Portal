"use client";

import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import type { Task, TaskStatus, TaskColor } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/kanban-rules";

export type CalendarFilters = {
  writerId: string | "all";
  editorId: string | "all";
  status: TaskStatus | "all";
  color: TaskColor | "all";
};

export const DEFAULT_FILTERS: CalendarFilters = {
  writerId: "all",
  editorId: "all",
  status: "all",
  color: "all",
};

const TASK_STATUSES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "complete",
];
const TASK_COLORS: TaskColor[] = ["green", "amber", "red"];

export function applyFilters(tasks: Task[], f: CalendarFilters): Task[] {
  return tasks.filter((t) => {
    if (f.writerId !== "all" && t.writerId !== f.writerId) return false;
    if (f.editorId !== "all" && t.editorId !== f.editorId) return false;
    if (f.status !== "all" && t.status !== f.status) return false;
    if (f.color !== "all" && t.color !== f.color) return false;
    return true;
  });
}

export function FilterBar({
  filters,
  onChange,
  showWriter = true,
  showEditor = true,
}: {
  filters: CalendarFilters;
  onChange: (next: CalendarFilters) => void;
  showWriter?: boolean;
  showEditor?: boolean;
}) {
  const { users } = useStore();
  const writers = users.filter((u) => u.role === "writer");
  const editors = users.filter((u) => u.role === "editor");

  return (
    <div className="flex flex-wrap items-end gap-3">
      {showWriter && (
        <div className="space-y-1">
          <Label>Writer</Label>
          <Select
            value={filters.writerId}
            onChange={(e) =>
              onChange({ ...filters, writerId: e.target.value })
            }
            className="h-8 text-xs min-w-[10rem]"
          >
            <option value="all">All writers</option>
            {writers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {showEditor && (
        <div className="space-y-1">
          <Label>Editor</Label>
          <Select
            value={filters.editorId}
            onChange={(e) =>
              onChange({ ...filters, editorId: e.target.value })
            }
            className="h-8 text-xs min-w-[10rem]"
          >
            <option value="all">All editors</option>
            {editors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label>Status</Label>
        <Select
          value={filters.status}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "all" || TASK_STATUSES.includes(value as TaskStatus)) {
              onChange({ ...filters, status: value as CalendarFilters["status"] });
            }
          }}
          className="h-8 text-xs min-w-[10rem]"
        >
          <option value="all">Any status</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Color</Label>
        <Select
          value={filters.color}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "all" || TASK_COLORS.includes(value as TaskColor)) {
              onChange({ ...filters, color: value as CalendarFilters["color"] });
            }
          }}
          className="h-8 text-xs min-w-[8rem]"
        >
          <option value="all">Any color</option>
          {TASK_COLORS.map((color) => (
            <option key={color} value={color}>
              {color[0].toUpperCase() + color.slice(1)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
