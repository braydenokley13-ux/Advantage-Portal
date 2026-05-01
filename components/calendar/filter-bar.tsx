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
              onChange({ ...filters, writerId: e.target.value as any })
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
              onChange({ ...filters, editorId: e.target.value as any })
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
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as any })
          }
          className="h-8 text-xs min-w-[10rem]"
        >
          <option value="all">Any status</option>
          {(["not_started", "in_progress", "submitted", "complete"] as TaskStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            )
          )}
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Color</Label>
        <Select
          value={filters.color}
          onChange={(e) =>
            onChange({ ...filters, color: e.target.value as any })
          }
          className="h-8 text-xs min-w-[8rem]"
        >
          <option value="all">Any color</option>
          <option value="green">Green</option>
          <option value="amber">Amber</option>
          <option value="red">Red</option>
        </Select>
      </div>
    </div>
  );
}
