"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  FileText,
  Users,
  Plus,
  Megaphone,
  Pin,
  TrendingUp,
  RefreshCw,
  Send,
  Eye,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { TaskRow } from "@/components/task/task-row";
import { TaskDrawer } from "@/components/task/task-drawer";
import { TaskFormDialog } from "@/components/task/task-form-dialog";
import { PageHeader } from "@/components/page-header";
import { useRole } from "@/lib/role-context";
import {
  useMessages,
  useNotifications,
  useUsers,
  useVisibleTasks,
} from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { canCreateTask } from "@/lib/permissions";
import { initials } from "@/lib/utils";
import { isPast, isWithinInterval, addDays, format } from "date-fns";
import type { Task } from "@/lib/types";

export default function DashboardPage() {
  const { user, role } = useRole();
  const { data: visibleTasksData } = useVisibleTasks();
  const myTasks = visibleTasksData ?? [];
  const { data: notificationsData } = useNotifications();
  const { data: usersData } = useUsers();
  const { data: messagesData } = useMessages();
  const { tasks: allTasks } = useStore();
  const notifications = notificationsData ?? [];
  const users = usersData ?? [];
  const messages = messagesData ?? [];
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
        {role === "leader" && (
          <LeaderStats users={users} tasks={allTasks} messages={messages} />
        )}
        {role === "admin" && (
          <AdminStats
            users={users}
            tasks={allTasks}
            messages={messages}
            notifications={notifications}
          />
        )}
      </div>

      {/* Role-specific quick-action / contextual rail. */}
      {role === "writer" && (
        <WriterNextActions tasks={myTasks} onOpen={setOpenTaskId} />
      )}
      {role === "editor" && (
        <EditorReviewQueue tasks={myTasks} onOpen={setOpenTaskId} />
      )}
      {role === "leader" && (
        <LeaderOpsPanel tasks={allTasks} users={users} messages={messages} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Upcoming deadlines</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/board">View board</Link>
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
          {role === "writer" && (
            <WriterFeedbackCard
              userId={user.id}
              notifications={notifications}
            />
          )}

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
              {recentMessages.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No messages yet"
                  description="DMs and team chatter will show up here."
                />
              ) : (
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Suppress unused warning while keeping the import for hint cards
          we may surface in a follow-up checkpoint. */}
      <span className="hidden">
        <FileText />
        <Users />
      </span>

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
  if (role === "editor") return "Submissions waiting on your review.";
  if (role === "leader") return "Team-wide overview of every story in flight.";
  return "Full system view.";
}

// ── Writer ─────────────────────────────────────────────────────────────────

function WriterNextActions({
  tasks,
  onOpen,
}: {
  tasks: Task[];
  onOpen: (id: string) => void;
}) {
  const next = useMemo(() => {
    const byStatus = (s: Task["status"]) =>
      tasks.filter((t) => t.status === s);
    return {
      drafts: byStatus("not_started").concat(byStatus("in_progress")),
      submitted: byStatus("submitted"),
    };
  }, [tasks]);

  const continueDraft = next.drafts[0];
  const submitNext = next.drafts.find((t) => t.status === "in_progress");
  const awaitingFeedback = next.submitted[0];

  if (!continueDraft && !awaitingFeedback) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" /> What to do next
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3 px-5 pb-5">
        {continueDraft && (
          <ActionTile
            icon={ClipboardList}
            label="Continue draft"
            sub={continueDraft.title}
            onClick={() => onOpen(continueDraft.id)}
          />
        )}
        {submitNext && (
          <ActionTile
            icon={Send}
            label="Submit draft"
            sub={submitNext.title}
            onClick={() => onOpen(submitNext.id)}
          />
        )}
        {awaitingFeedback && (
          <ActionTile
            icon={Eye}
            label="View feedback"
            sub={awaitingFeedback.title}
            onClick={() => onOpen(awaitingFeedback.id)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ActionTile({
  icon: Icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-card p-3 text-left hover:bg-accent transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{sub}</p>
    </button>
  );
}

function WriterFeedbackCard({
  userId,
  notifications,
}: {
  userId: string;
  notifications: { userId: string; kind: string; title: string; body?: string; id: string }[];
}) {
  const recentFeedback = notifications
    .filter(
      (n) =>
        n.userId === userId &&
        (n.kind === "review_decision" || n.kind === "comment")
    )
    .slice(0, 3);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Editor feedback</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {recentFeedback.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No feedback yet"
            description="Editor decisions and comments land here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {recentFeedback.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="text-sm leading-snug">{n.title}</p>
                {n.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {n.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Editor ─────────────────────────────────────────────────────────────────

function EditorReviewQueue({
  tasks,
  onOpen,
}: {
  tasks: Task[];
  onOpen: (id: string) => void;
}) {
  const submitted = tasks.filter((t) => t.status === "submitted").slice(0, 5);
  if (submitted.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" /> Review queue
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reviews">Open queue</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {submitted.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={onOpen} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Leader ─────────────────────────────────────────────────────────────────

function LeaderStats({
  users,
  tasks,
  messages,
}: {
  users: { role: string; id: string }[];
  tasks: Task[];
  messages: { pinnedAt?: string }[];
}) {
  const overdue = tasks.filter(
    (t) => t.status !== "complete" && isPast(new Date(t.deadline))
  ).length;
  const inFlight = tasks.filter(
    (t) => t.status === "in_progress" || t.status === "submitted"
  ).length;
  const pinned = messages.filter((m) => m.pinnedAt).length;
  const writers = users.filter((u) => u.role === "writer").length;
  const editors = users.filter((u) => u.role === "editor").length;
  return (
    <>
      <StatCard label="In flight" value={inFlight} icon={FileText} />
      <StatCard
        label="Deadline risk"
        value={overdue}
        icon={AlertTriangle}
        tone={overdue > 0 ? "danger" : "neutral"}
        delta={overdue === 0 ? "On track" : "Action needed"}
      />
      <StatCard
        label="Pinned"
        value={pinned}
        icon={Pin}
        tone="warning"
        delta="All-team announcements"
      />
      <StatCard
        label="Team"
        value={writers + editors}
        icon={Users}
        delta={`${writers} writers · ${editors} editors`}
      />
    </>
  );
}

function LeaderOpsPanel({
  tasks,
  users,
  messages,
}: {
  tasks: Task[];
  users: { id: string; name: string; role: string }[];
  messages: { pinnedAt?: string; body: string; createdAt: string; authorId: string }[];
}) {
  const submitted = tasks.filter((t) => t.status === "submitted");
  // Editor backlog: count submitted tasks per editor.
  const backlog = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of submitted) {
      if (!t.editorId) continue;
      map.set(t.editorId, (map.get(t.editorId) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([editorId, count]) => ({
        editor: users.find((u) => u.id === editorId),
        count,
      }))
      .filter((x) => x.editor)
      .sort((a, b) => b.count - a.count);
  }, [submitted, users]);

  // Publication readiness = approved (complete) / total non-not-started.
  const totalActive = tasks.filter((t) => t.status !== "not_started").length;
  const ready = tasks.filter((t) => t.status === "complete").length;
  const readiness =
    totalActive === 0 ? 0 : Math.round((ready / totalActive) * 100);

  const pinned = messages
    .filter((m) => m.pinnedAt)
    .sort(
      (a, b) =>
        new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime()
    )
    .slice(0, 2);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> Publication
            readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-2">
          <p className="text-3xl font-semibold tracking-tight">{readiness}%</p>
          <p className="text-xs text-muted-foreground">
            {ready} of {totalActive} active tasks are approved.
          </p>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${readiness}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" /> Editor
            backlog
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {backlog.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No drafts waiting on a review decision.
            </p>
          ) : (
            <ul className="space-y-2">
              {backlog.map((b) => (
                <li
                  key={b.editor!.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{b.editor!.name}</span>
                  <Badge
                    variant={b.count > 2 ? "warning" : "secondary"}
                    className="tabular-nums"
                  >
                    {b.count} to review
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" /> Pinned
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {pinned.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing pinned. Use Announcements to pin a note.
            </p>
          ) : (
            <ul className="space-y-3">
              {pinned.map((m, i) => (
                <li key={i} className="text-xs leading-snug">
                  <p className="line-clamp-2">{m.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(m.createdAt), "MMM d")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Admin ──────────────────────────────────────────────────────────────────

function AdminStats({
  users,
  tasks,
  messages,
  notifications,
}: {
  users: { role: string }[];
  tasks: Task[];
  messages: { createdAt: string }[];
  notifications: { kind: string; createdAt: string }[];
}) {
  const sevenDaysAgo = addDays(new Date(), -7);
  const submissionsThisWeek = notifications.filter(
    (n) =>
      n.kind === "submission" && new Date(n.createdAt) > sevenDaysAgo
  ).length;
  const overdue = tasks.filter(
    (t) => t.status !== "complete" && isPast(new Date(t.deadline))
  ).length;
  const teamCount = users.length;
  // Mock metric: average review cycle in hours, derived from submissions to
  // last-decision spread. Without a backend, just showcase a number.
  const avgCycle = "1.8d";

  return (
    <>
      <StatCard
        label="Submissions / wk"
        value={submissionsThisWeek}
        icon={Send}
        delta="Last 7 days"
      />
      <StatCard
        label="Overdue"
        value={overdue}
        icon={AlertTriangle}
        tone={overdue > 0 ? "danger" : "neutral"}
      />
      <StatCard
        label="Avg review cycle"
        value={avgCycle}
        icon={Clock}
        delta="Mock metric"
      />
      <StatCard
        label="Roles"
        value={teamCount}
        icon={Users}
        delta={`${users.filter((u) => u.role === "admin").length} admin · ${users.filter((u) => u.role === "leader").length} lead`}
      />
      {/* messages used to keep the prop reachable for future breakdowns */}
      <span className="hidden">{messages.length}</span>
    </>
  );
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
