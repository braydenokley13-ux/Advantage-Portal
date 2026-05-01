"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  FileText,
  Users,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatCard } from "@/components/dashboard/stat-card";
import { TaskRow } from "@/components/task/task-row";
import { TaskDrawer } from "@/components/task/task-drawer";
import { TaskFormDialog } from "@/components/task/task-form-dialog";
import { PageHeader } from "@/components/page-header";
import { useRole } from "@/lib/role-context";
import { useStore } from "@/lib/store";
import { canCreateTask } from "@/lib/permissions";
import { visibleTasks } from "@/lib/visibility";
import { initials } from "@/lib/utils";
import { isPast, isWithinInterval, addDays, format } from "date-fns";

export default function DashboardPage() {
  const { user, role } = useRole();
  const { tasks, notifications, messages, users } = useStore();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const myTasks = useMemo(
    () => visibleTasks({ tasks, role, userId: user.id }),
    [tasks, role, user.id]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const inSevenDays = addDays(now, 7);
    return {
      total: myTasks.length,
      inProgress: myTasks.filter((t) => t.status === "in_progress").length,
      submitted: myTasks.filter((t) => t.status === "submitted").length,
      complete: myTasks.filter((t) => t.status === "complete").length,
      dueSoon: myTasks.filter(
        (t) =>
          t.status !== "complete" &&
          isWithinInterval(new Date(t.deadline), {
            start: now,
            end: inSevenDays,
          })
      ).length,
      overdue: myTasks.filter(
        (t) => t.status !== "complete" && isPast(new Date(t.deadline))
      ).length,
    };
  }, [myTasks]);

  const upcoming = useMemo(
    () =>
      [...myTasks]
        .filter((t) => t.status !== "complete")
        .sort(
          (a, b) =>
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        )
        .slice(0, 5),
    [myTasks]
  );

  const writerCount = users.filter((u) => u.role === "writer").length;
  const editorCount = users.filter((u) => u.role === "editor").length;

  const myNotifications = notifications
    .filter((n) => n.userId === user.id)
    .slice(0, 4);
  const recentMessages = messages.slice(-4).reverse();

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}.`}
        description={dashboardSubtitle(role)}
        actions={
          canCreateTask(role) && (
            <Button variant="gradient" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New task
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {role === "writer" && (
          <>
            <StatCard label="My tasks" value={stats.total} icon={ClipboardList} />
            <StatCard label="In progress" value={stats.inProgress} icon={Clock} />
            <StatCard
              label="Due in 7 days"
              value={stats.dueSoon}
              icon={AlertTriangle}
              tone="warning"
            />
            <StatCard
              label="Completed"
              value={stats.complete}
              icon={CheckCircle2}
              tone="positive"
            />
          </>
        )}
        {role === "editor" && (
          <>
            <StatCard
              label="Awaiting review"
              value={stats.submitted}
              icon={Inbox}
              tone="warning"
            />
            <StatCard
              label="Active assignments"
              value={stats.total - stats.complete}
              icon={ClipboardList}
            />
            <StatCard
              label="Overdue"
              value={stats.overdue}
              icon={AlertTriangle}
              tone="danger"
            />
            <StatCard
              label="Reviewed"
              value={stats.complete}
              icon={CheckCircle2}
              tone="positive"
            />
          </>
        )}
        {(role === "leader" || role === "admin") && (
          <>
            <StatCard label="Tasks" value={stats.total} icon={ClipboardList} />
            <StatCard
              label="In flight"
              value={stats.inProgress + stats.submitted}
              icon={FileText}
            />
            <StatCard
              label="Overdue"
              value={stats.overdue}
              icon={AlertTriangle}
              tone="danger"
            />
            <StatCard
              label="Team"
              value={writerCount + editorCount}
              icon={Users}
              delta={`${writerCount} writers · ${editorCount} editors`}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Upcoming deadlines</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <a href="/board">View board</a>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing due soon"
                description="You're all caught up. Time for a coffee."
              />
            ) : (
              <div className="divide-y divide-border">
                {upcoming.map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={setOpenTaskId} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {myNotifications.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No notifications"
                  description="We'll ping you when something changes."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {myNotifications.map((n) => (
                    <li key={n.id} className="px-4 py-3 flex gap-3">
                      <span
                        className={
                          n.read
                            ? "mt-1.5 h-2 w-2 rounded-full bg-muted"
                            : "mt-1.5 h-2 w-2 rounded-full bg-primary"
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-sm leading-snug">{n.title}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">
                          {n.kind.replace("_", " ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent messages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {recentMessages.map((m) => {
                  const author = users.find((u) => u.id === m.authorId);
                  return (
                    <li key={m.id} className="px-4 py-3 flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px]">
                          {initials(author?.name ?? "??")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {author?.name}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(m.createdAt), "MMM d")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />
      <TaskFormDialog
        mode="create"
        open={creating}
        onOpenChange={setCreating}
      />
    </div>
  );
}

function dashboardSubtitle(role: string) {
  if (role === "writer") return "Your assignments, deadlines, and feedback.";
  if (role === "editor") return "Submissions awaiting your review.";
  if (role === "leader") return "Team-wide overview of every story in flight.";
  return "Full system view.";
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="px-4 py-10 flex flex-col items-center text-center">
      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}
