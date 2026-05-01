"use client";

import { useMemo, useState } from "react";
import {
  Newspaper,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Send,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskDrawer } from "@/components/task/task-drawer";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import {
  STAGE_DEFINITIONS,
  deriveStoryStage,
} from "@/lib/newsroom-stage";
import type { Issue, IssueSlot, Section, Task } from "@/lib/types";
import { format, isPast } from "date-fns";

const ISSUE_TONE: Record<
  Issue["status"],
  "default" | "secondary" | "warning" | "success" | "danger"
> = {
  planning: "secondary",
  production: "warning",
  published: "success",
  archived: "default",
};

export default function IssuesPage() {
  const { issues, issueSlots, tasks, sections, checklists, setIssueStatus } =
    useStore();
  const { role } = useRole();
  const [activeId, setActiveId] = useState<string>(() => {
    // Default to the next non-published issue.
    return (
      issues.find((i) => i.status !== "published")?.id ??
      issues[0]?.id ??
      ""
    );
  });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const active = issues.find((i) => i.id === activeId);
  const canShip = role === "leader" || role === "admin";

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Issues"
        description="Plan editions, track readiness, and ship the publication."
      />

      <div className="grid gap-3 md:grid-cols-3">
        {issues.map((i) => {
          const slots = issueSlots.filter((s) => s.issueId === i.id);
          const ready = slots.filter((s) => {
            const t = tasks.find((x) => x.id === s.taskId);
            if (!t) return false;
            const cl = checklists.find((c) => c.taskId === t.id);
            const stage = deriveStoryStage({ task: t, checklist: cl, issue: i }).stage;
            return stage === "publish_ready" || stage === "published";
          }).length;
          const due = new Date(i.publishDate);
          const overdue = isPast(due) && i.status !== "published";
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => setActiveId(i.id)}
              className={`text-left rounded-lg border p-4 transition-colors ${
                activeId === i.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-accent/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">{i.name}</p>
                </div>
                <Badge variant={ISSUE_TONE[i.status]} className="capitalize">
                  {i.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                <span className={overdue ? "text-red-600 font-medium" : ""}>
                  {format(due, "MMM d, yyyy")}
                </span>
                <span>·</span>
                <span>
                  {ready} / {slots.length} ready
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <IssueDetail
          issue={active}
          slots={issueSlots.filter((s) => s.issueId === active.id)}
          tasks={tasks}
          sections={sections}
          onOpenTask={setOpenTaskId}
          canShip={canShip}
          onShip={() => setIssueStatus(active.id, "published")}
        />
      )}

      <TaskDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />
    </div>
  );
}

function IssueDetail({
  issue,
  slots,
  tasks,
  sections,
  onOpenTask,
  canShip,
  onShip,
}: {
  issue: Issue;
  slots: IssueSlot[];
  tasks: Task[];
  sections: Section[];
  onOpenTask: (id: string) => void;
  canShip: boolean;
  onShip: () => void;
}) {
  const { checklists } = useStore();

  const slotted = useMemo(
    () =>
      slots
        .map((s) => ({
          slot: s,
          task: tasks.find((t) => t.id === s.taskId),
        }))
        .filter((x): x is { slot: IssueSlot; task: Task } => !!x.task),
    [slots, tasks]
  );

  const bySection = useMemo(() => {
    const map = new Map<string, { slot: IssueSlot; task: Task }[]>();
    for (const item of slotted) {
      const k = item.task.sectionId ?? "unsectioned";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(item);
    }
    return map;
  }, [slotted]);

  const stages = slotted.map(({ task }) => {
    const cl = checklists.find((c) => c.taskId === task.id);
    return deriveStoryStage({ task, checklist: cl, issue }).stage;
  });
  const total = slotted.length || 1;
  const ready = stages.filter(
    (s) => s === "publish_ready" || s === "published"
  ).length;
  const blocked = slotted.filter(({ task }) => task.sensitive?.status === "open" || task.sensitive?.status === "holding").length;
  const copyBacklog = stages.filter((s) => s === "copy_edit").length;
  const factBacklog = stages.filter((s) => s === "fact_check").length;
  const readiness = Math.round((ready / total) * 100);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {issue.name}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Publish target {format(new Date(issue.publishDate), "MMM d, yyyy")}
            {issue.notes ? ` · ${issue.notes}` : ""}
          </p>
        </div>
        {canShip && issue.status !== "published" && (
          <Button
            variant="gradient"
            size="sm"
            disabled={ready < 1}
            onClick={onShip}
          >
            <Send className="h-3.5 w-3.5" /> Mark issue published
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ReadinessTile
            label="Publish-ready"
            value={`${ready}/${slotted.length}`}
            sub={`${readiness}% of slate`}
            tone={readiness === 100 ? "success" : "warning"}
          />
          <ReadinessTile
            label="Sensitive blockers"
            value={blocked}
            sub={blocked === 0 ? "All clear" : "Needs leader/admin"}
            tone={blocked > 0 ? "danger" : "neutral"}
            icon={ShieldAlert}
          />
          <ReadinessTile
            label="Copy desk"
            value={copyBacklog}
            sub={copyBacklog === 0 ? "Empty queue" : "Stories awaiting copy"}
            tone={copyBacklog > 2 ? "warning" : "neutral"}
          />
          <ReadinessTile
            label="Fact desk"
            value={factBacklog}
            sub={factBacklog === 0 ? "Empty queue" : "Stories awaiting fact-check"}
            tone={factBacklog > 2 ? "warning" : "neutral"}
          />
        </div>

        <div className="space-y-4">
          {[...bySection.entries()].map(([sectionId, items]) => {
            const sec = sections.find((s) => s.id === sectionId);
            return (
              <div key={sectionId} className="rounded-lg border border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/40">
                  <p className="text-sm font-medium">
                    {sec?.name ?? "Unsectioned"}
                  </p>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <ul className="divide-y divide-border">
                  {items.map(({ slot, task }) => {
                    const cl = checklists.find((c) => c.taskId === task.id);
                    const { stage, reasons } = deriveStoryStage({
                      task,
                      checklist: cl,
                      issue,
                    });
                    return (
                      <li key={slot.id}>
                        <button
                          type="button"
                          onClick={() => onOpenTask(task.id)}
                          className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-accent/40 transition-colors"
                        >
                          <Badge
                            variant={
                              slot.priority === "must_run"
                                ? "danger"
                                : "secondary"
                            }
                            className="shrink-0 mt-0.5"
                          >
                            {slot.priority === "must_run"
                              ? "Must run"
                              : "Nice to run"}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {task.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              Due {format(new Date(task.deadline), "MMM d")}
                              {reasons[0] ? ` · ${reasons[0].message}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant={STAGE_DEFINITIONS[stage].tone}
                            className="shrink-0"
                          >
                            {STAGE_DEFINITIONS[stage].label}
                          </Badge>
                          {task.sensitive && (
                            <ShieldAlert
                              className={`h-4 w-4 shrink-0 ${
                                task.sensitive.status === "cleared"
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }`}
                              aria-label={`Sensitive: ${task.sensitive.status}`}
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {slotted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              No stories slotted into this issue yet. Convert pitches to assign
              stories here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReadinessTile({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: "success" | "warning" | "danger" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200"
      : tone === "danger"
        ? "bg-red-50 border-red-200"
        : tone === "warning"
          ? "bg-amber-50 border-amber-200"
          : "bg-card border-border";
  const I = Icon ?? (tone === "success" ? CheckCircle2 : AlertTriangle);
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <I className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
