"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Inbox,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { TaskRow } from "@/components/task/task-row";
import { TaskDrawer } from "@/components/task/task-drawer";
import { StatCard } from "@/components/dashboard/stat-card";
import { useRole } from "@/lib/role-context";
import { useVisibleTasks } from "@/lib/hooks";
import type { Task } from "@/lib/types";
import { addDays, isPast, isWithinInterval } from "date-fns";

/**
 * Writer-focused "My Tasks" page. Shown to writers via the sidebar nav.
 * Other roles also land here gracefully if they navigate manually — they see
 * an empty state via the visibility filter rather than an error.
 */
export default function MyTasksPage() {
  const { user, role } = useRole();
  const { data } = useVisibleTasks();
  const tasks = data ?? [];
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const now = new Date();
    return {
      needsAction: tasks.filter(
        (t) => t.status === "not_started" || t.status === "in_progress"
      ),
      awaitingFeedback: tasks.filter((t) => t.status === "submitted"),
      completed: tasks.filter((t) => t.status === "complete"),
      overdue: tasks.filter(
        (t) => t.status !== "complete" && isPast(new Date(t.deadline))
      ),
      dueSoon: tasks.filter(
        (t) =>
          t.status !== "complete" &&
          isWithinInterval(new Date(t.deadline), {
            start: now,
            end: addDays(now, 7),
          })
      ),
    };
  }, [tasks]);

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="My Tasks"
        description={
          role === "writer"
            ? "Everything assigned to you, grouped by what needs your attention next."
            : "Tasks visible to you. Writers see this view by default."
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Needs your work"
          value={groups.needsAction.length}
          icon={ClipboardList}
        />
        <StatCard
          label="Awaiting feedback"
          value={groups.awaitingFeedback.length}
          icon={Inbox}
          tone="warning"
        />
        <StatCard
          label="Due in 7 days"
          value={groups.dueSoon.length}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Overdue"
          value={groups.overdue.length}
          icon={AlertTriangle}
          tone="danger"
        />
      </div>

      <Section
        title="Needs your work"
        description="Drafts in progress or not yet started. Open a task to keep working or submit."
        icon={Send}
        items={groups.needsAction}
        onOpen={setOpenTaskId}
        empty="No active assignments. Nice work."
      />

      <Section
        title="Awaiting editor feedback"
        description="You submitted these. Editors will approve or request changes."
        icon={Inbox}
        items={groups.awaitingFeedback}
        onOpen={setOpenTaskId}
        empty="Nothing waiting on review."
        badgeTone="warning"
      />

      <Section
        title="Completed"
        description="Approved or wrapped up."
        icon={CheckCircle2}
        items={groups.completed}
        onOpen={setOpenTaskId}
        empty="No completed tasks yet."
        badgeTone="success"
      />

      {tasks.length === 0 && role !== "writer" && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            This view is tuned for writers. As a {role}, the Board and
            Reviews pages are likely more useful — check the sidebar.
          </CardContent>
        </Card>
      )}

      <TaskDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />

      {/* User binding kept for parity with other writer-only views; reserved
          for future "only my tasks" filter switches. */}
      <input type="hidden" value={user.id} readOnly />
    </div>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  items,
  onOpen,
  empty,
  badgeTone = "secondary",
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Task[];
  onOpen: (id: string) => void;
  empty: string;
  badgeTone?: "default" | "secondary" | "warning" | "success";
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <Badge variant={badgeTone}>{items.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            {empty}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((t) => (
              <TaskRow key={t.id} task={t} onOpen={onOpen} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
