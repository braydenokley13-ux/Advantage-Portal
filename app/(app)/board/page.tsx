"use client";

import { Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { KanbanBoard } from "@/components/kanban/board";
import { useRole } from "@/lib/role-context";

export default function BoardPage() {
  const { role } = useRole();
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
          (role === "leader" || role === "admin") && (
            <Button variant="gradient">
              <Plus className="h-4 w-4" /> New task
            </Button>
          )
        }
      />

      {role === "writer" && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 text-primary" />
          <p>
            Submission and review are gated. To move a task to{" "}
            <span className="font-medium text-foreground">Submitted</span>,
            submit your work. Only an editor's review can move it to{" "}
            <span className="font-medium text-foreground">Complete</span>.
          </p>
        </div>
      )}

      <KanbanBoard />
    </div>
  );
}
