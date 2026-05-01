"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { canCreateTask, canEditTask } from "@/lib/permissions";
import type { Task, TaskColor } from "@/lib/types";
import { format } from "date-fns";

type Mode = "create" | "edit";

const COLORS: { value: TaskColor; label: string; dot: string }[] = [
  { value: "green", label: "Green — on track", dot: "bg-emerald-500" },
  { value: "amber", label: "Amber — watch", dot: "bg-amber-500" },
  { value: "red", label: "Red — urgent", dot: "bg-red-500" },
];

export function TaskFormDialog({
  mode,
  task,
  open,
  onOpenChange,
}: {
  mode: Mode;
  task?: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { role } = useRole();
  const { users, createTask, updateTask } = useStore();

  const allowed =
    mode === "create" ? canCreateTask(role) : canEditTask(role);

  const writers = users.filter((u) => u.role === "writer" && u.active !== false);
  const editors = users.filter((u) => u.role === "editor" && u.active !== false);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [writerId, setWriterId] = useState<string>("");
  const [editorId, setEditorId] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [color, setColor] = useState<TaskColor>("green");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && task) {
      setTitle(task.title);
      setInstructions(task.instructions);
      setWriterId(task.writerId);
      setEditorId(task.editorId ?? "");
      setDeadline(format(new Date(task.deadline), "yyyy-MM-dd"));
      setColor(task.color);
    } else {
      setTitle("");
      setInstructions("");
      setWriterId(writers[0]?.id ?? "");
      setEditorId("");
      const inAWeek = new Date();
      inAWeek.setDate(inAWeek.getDate() + 7);
      setDeadline(format(inAWeek, "yyyy-MM-dd"));
      setColor("green");
    }
  }, [open, mode, task, writers]);

  const valid =
    title.trim().length > 0 &&
    instructions.trim().length > 0 &&
    writerId.length > 0 &&
    deadline.length > 0;

  function submit() {
    if (!valid || !allowed) return;
    const iso = new Date(`${deadline}T17:00:00`).toISOString();
    if (mode === "create") {
      createTask({
        title: title.trim(),
        instructions: instructions.trim(),
        writerId,
        editorId: editorId || undefined,
        deadline: iso,
        color,
      });
    } else if (task) {
      updateTask(task.id, {
        title: title.trim(),
        instructions: instructions.trim(),
        writerId,
        editorId: editorId || undefined,
        deadline: iso,
        color,
      });
    }
    onOpenChange(false);
  }

  if (!allowed) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New task" : "Edit task"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Assign a writer and an optional editor. Tasks start in Not Started."
              : "Update task details. Status and submissions are unchanged."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto scroll-thin">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quarterly market outlook"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-instructions">Instructions</Label>
            <Textarea
              id="task-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Brief: word count, sources, voice, key beats…"
              className="min-h-[120px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Writer</Label>
              <Select
                value={writerId}
                onChange={(e) => setWriterId(e.target.value)}
              >
                <option value="" disabled>
                  Select a writer
                </option>
                {writers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Editor <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
              >
                <option value="">No editor</option>
                {editors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-deadline">Deadline</Label>
              <Input
                id="task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority color</Label>
              <Select
                value={color}
                onChange={(e) => setColor(e.target.value as TaskColor)}
              >
                {COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="gradient" disabled={!valid} onClick={submit}>
            {mode === "create" ? "Create task" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
