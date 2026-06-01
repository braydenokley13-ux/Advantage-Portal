"use client";

/* eslint-disable react-hooks/set-state-in-effect */

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
  const [wordCountTarget, setWordCountTarget] = useState<string>("");
  const [citationsRequired, setCitationsRequired] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form only when the dialog opens or the target task changes.
  // NOTE: depend on the stable `users` array, NOT the inline-filtered
  // `writers` — `writers` is a fresh array every render, which previously
  // re-ran this effect on every keystroke and wiped what the user typed.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && task) {
      setTitle(task.title);
      setInstructions(task.instructions);
      setWriterId(task.writerId);
      setEditorId(task.editorId ?? "");
      setDeadline(format(new Date(task.deadline), "yyyy-MM-dd"));
      setColor(task.color);
      setWordCountTarget(
        task.wordCountTarget ? String(task.wordCountTarget) : ""
      );
      setCitationsRequired(task.citationsRequired ?? false);
    } else {
      const firstWriter = users.find(
        (u) => u.role === "writer" && u.active !== false
      );
      setTitle("");
      setInstructions("");
      setWriterId(firstWriter?.id ?? "");
      setEditorId("");
      const inAWeek = new Date();
      inAWeek.setDate(inAWeek.getDate() + 7);
      setDeadline(format(inAWeek, "yyyy-MM-dd"));
      setColor("green");
      setWordCountTarget("");
      setCitationsRequired(false);
    }
    setError(null);
  }, [open, mode, task, users]);

  const todayIso = format(new Date(), "yyyy-MM-dd");

  const valid =
    title.trim().length > 0 &&
    instructions.trim().length > 0 &&
    writerId.length > 0 &&
    deadline.length > 0 &&
    // Reject deadlines in the past at the form level. Existing tasks
    // being edited keep their original min so a stale (already-past)
    // deadline doesn't block other field edits.
    (mode === "edit" || deadline >= todayIso);

  async function submit() {
    if (!valid || !allowed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const iso = new Date(`${deadline}T17:00:00`).toISOString();
      const wc = wordCountTarget.trim()
        ? Math.max(1, Math.floor(Number(wordCountTarget)))
        : undefined;
      if (mode === "create") {
        await createTask({
          title: title.trim(),
          instructions: instructions.trim(),
          writerId,
          editorId: editorId || undefined,
          deadline: iso,
          color,
          wordCountTarget: wc,
          citationsRequired: citationsRequired || undefined,
        });
      } else if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          instructions: instructions.trim(),
          writerId,
          editorId: editorId || undefined,
          deadline: iso,
          color,
          wordCountTarget: wc,
          citationsRequired: citationsRequired || undefined,
        });
      }
      onOpenChange(false);
    } catch (e) {
      // Surface the failure instead of closing the dialog as if it saved —
      // otherwise the writer's edits silently vanish on a network/RLS error.
      setError(
        e instanceof Error
          ? e.message
          : mode === "create"
            ? "Couldn't create that task. Please try again."
            : "Couldn't save your changes. Please try again."
      );
    } finally {
      setBusy(false);
    }
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
            <Label htmlFor="task-title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quarterly market outlook"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-instructions">
              Instructions <span className="text-red-500">*</span>
            </Label>
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
              <Label>
                Writer <span className="text-red-500">*</span>
              </Label>
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
              <Label htmlFor="task-deadline">
                Deadline <span className="text-red-500">*</span>
              </Label>
              <Input
                id="task-deadline"
                type="date"
                min={mode === "edit" ? undefined : todayIso}
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

            <div className="space-y-1.5">
              <Label htmlFor="task-words">
                Word count target{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="task-words"
                type="number"
                min={1}
                step={50}
                value={wordCountTarget}
                onChange={(e) => setWordCountTarget(e.target.value)}
                placeholder="e.g. 1500"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Citations</Label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground select-none rounded-md border border-border bg-card px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-foreground"
                  checked={citationsRequired}
                  onChange={(e) => setCitationsRequired(e.target.checked)}
                />
                Require citations (sourcing-heavy piece)
              </label>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
            Citations are an editor&apos;s call — flagging this just shows a
            reminder on the task and lets the editor weigh sourcing during
            review. It does not block submission.
          </p>
        </div>

        {error && (
          <p className="px-5 -mt-1 pb-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="gradient"
            disabled={!valid || busy}
            onClick={submit}
          >
            {busy
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create task"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
