"use client";

import { useState } from "react";
import { Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { KanbanBoard } from "@/components/kanban/board";
import { TaskFormDialog } from "@/components/task/task-form-dialog";
import { useRole } from "@/lib/role-context";
import { canCreateTask } from "@/lib/permissions";

export default function BoardPage() {
  const { role } = useRole();
  const [creating, setCreating] = useState(false);
  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Board"
        description={
          role === "writer"
            ? "Your tasks. Drag between Not Started and In Progress; submit work to advance."
            : role === "editor"
              ? "Tasks assigned to you. Open submitted work to leave a review decision."
              : "Every task across the team. Drag freely to manage flow."
        }
        actions={
          canCreateTask(role) && (
            <Button variant="gradient" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New task
            </Button>
          )
        }
      />

      {role === "writer" && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 text-primary" />
          <p>
            Drag a card to <span className="font-medium text-foreground">In Progress</span>{" "}
            while you write. When it&apos;s ready, click{" "}
            <span className="font-medium text-foreground">“Submit work”</span> on
            the card (or open it and use the Submission tab) to move it to{" "}
            <span className="font-medium text-foreground">Submitted</span> —
            drag-to-submit is disabled on purpose. Only an editor&apos;s review
            moves it to <span className="font-medium text-foreground">Complete</span>.
          </p>
        </div>
      )}

      <KanbanBoard />

      <TaskFormDialog mode="create" open={creating} onOpenChange={setCreating} />
    </div>
  );
}
