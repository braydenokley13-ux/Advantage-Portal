"use client";

import { useMemo, useState } from "react";
import {
  Inbox,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { TaskRow } from "@/components/task/task-row";
import { TaskDrawer } from "@/components/task/task-drawer";
import { StatCard } from "@/components/dashboard/stat-card";
import { useRole } from "@/lib/role-context";
import { useStore } from "@/lib/store";
import { useVisibleTasks } from "@/lib/hooks";
import type { Task } from "@/lib/types";
import { isPast } from "date-fns";

/**
 * Editor "Reviews" queue — surfaces work waiting on a review decision,
 * resubmissions after changes were requested, and items overdue for review.
 *
 * Other roles fall through to a friendly empty state.
 */
export default function ReviewsPage() {
  const { role } = useRole();
  const { data } = useVisibleTasks();
  const { reviews } = useStore();
  const tasks = data ?? [];
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const reviewedTaskIds = new Set(
      reviews.map((r) => {
        // Submission -> Task mapping isn't trivial without joining, but the
        // existence of any review on this task's submission is enough to
        // mark it as "resubmitted" once it returns to submitted.
        return r.submissionId;
      })
    );
    const needsDecision = tasks.filter((t) => t.status === "submitted");
    const resubmitted = needsDecision.filter(
      (t) => t.currentSubmissionId && reviewedTaskIds.has(t.currentSubmissionId)
    );
    const overdue = needsDecision.filter((t) =>
      isPast(new Date(t.deadline))
    );
    const inFlight = tasks.filter((t) => t.status === "in_progress");
    const reviewed = tasks.filter((t) => t.status === "complete");
    return { needsDecision, resubmitted, overdue, inFlight, reviewed };
  }, [tasks, reviews]);

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Reviews"
        description={
          role === "editor"
            ? "Submissions waiting on your decision. Approve, request changes, or return with notes."
            : "Editorial review queue."
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Needs decision"
          value={groups.needsDecision.length}
          icon={Inbox}
          tone="warning"
        />
        <StatCard
          label="Resubmitted"
          value={groups.resubmitted.length}
          icon={RefreshCw}
        />
        <StatCard
          label="Overdue"
          value={groups.overdue.length}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Reviewed"
          value={groups.reviewed.length}
          icon={CheckCircle2}
          tone="positive"
        />
      </div>

      <Section
        title="Needs decision"
        description="Open the task and use the Review tab to render a decision."
        icon={Inbox}
        items={groups.needsDecision}
        onOpen={setOpenTaskId}
        empty="Inbox zero. You're caught up."
        badgeTone="warning"
      />

      <Section
        title="Resubmitted after changes"
        description="Writers responded to a previous round of feedback. Re-check the highlighted areas."
        icon={RefreshCw}
        items={groups.resubmitted}
        onOpen={setOpenTaskId}
        empty="No resubmissions yet."
      />

      <Section
        title="In progress"
        description="Drafts in flight that haven't reached you yet."
        icon={ClipboardList}
        items={groups.inFlight}
        onOpen={setOpenTaskId}
        empty="No drafts currently in progress."
      />

      {tasks.length === 0 && role !== "editor" && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            This page is tuned for editors. Try the Board for a full team view.
          </CardContent>
        </Card>
      )}

      <TaskDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />
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
