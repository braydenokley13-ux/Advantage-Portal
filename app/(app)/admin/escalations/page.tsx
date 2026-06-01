"use client";

import { useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck, Pause, Play } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskDrawer } from "@/components/task/task-drawer";
import { useApiClient } from "@/lib/api/provider";
import { useTasks } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import type { SensitiveFlag, SensitiveReason, Task } from "@/lib/types";
import { format } from "date-fns";

const REASON_LABEL: Record<SensitiveReason, string> = {
  student_privacy: "Student privacy",
  politics: "Politics / geopolitics",
  financial_claims: "Financial claims",
  allegations: "Allegations / accusations",
  medical_or_mental_health: "Medical / mental health",
  other: "Other sensitive issue",
};

/**
 * Editorial-escalation queue — distinct from /admin/moderation, which
 * handles user-behavior reports in chat. This page lists every story with
 * a sensitive flag and lets leaders or admins clear or hold the flag in
 * one place.
 */
export default function EscalationsPage() {
  const api = useApiClient();
  const { data: tasksData, refetch: refetchTasks } = useTasks();
  // Users stays on the store as a sync cache for name lookups.
  const { users } = useStore();
  const { user, role } = useRole();
  const [tab, setTab] = useState<"open" | "holding" | "cleared" | "all">("open");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const allowed = role === "leader" || role === "admin";

  const flagged = useMemo(
    () =>
      (tasksData ?? [])
        .filter((t) => t.sensitive)
        .sort(
          (a, b) =>
            new Date(b.sensitive!.raisedAt).getTime() -
            new Date(a.sensitive!.raisedAt).getTime()
        ),
    [tasksData]
  );

  const filtered =
    tab === "all"
      ? flagged
      : flagged.filter((t) => t.sensitive?.status === tab);

  if (!allowed) {
    return (
      <div className="container py-6">
        <PageHeader
          title="Editorial escalations"
          description="Leaders and admins only."
        />
        <Card>
          <CardContent className="px-5 py-6 text-sm text-muted-foreground">
            This queue is reserved for leaders and admins.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Editorial escalations"
        description="Sensitive stories awaiting a leader/admin decision before publication. Distinct from chat moderation."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="open">
            Open
            {flagged.filter((t) => t.sensitive?.status === "open").length >
              0 && (
              <span className="ml-1.5 text-[10px] rounded-full bg-red-100 text-red-700 px-1.5 py-0.5">
                {flagged.filter((t) => t.sensitive?.status === "open").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="holding">Holding</TabsTrigger>
          <TabsTrigger value="cleared">Cleared</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nothing in this bucket.
              </CardContent>
            </Card>
          ) : (
            filtered.map((t) => (
              <EscalationCard
                key={t.id}
                task={t}
                flag={t.sensitive!}
                raisedByName={
                  users.find((u) => u.id === t.sensitive!.raisedById)?.name
                }
                decidedByName={
                  t.sensitive!.decidedById
                    ? users.find((u) => u.id === t.sensitive!.decidedById)?.name
                    : undefined
                }
                onDecide={async (status) => {
                  await api.decideSensitiveFlag({
                    taskId: t.id,
                    decidedById: user.id,
                    status,
                  });
                  refetchTasks();
                }}
                onOpenTask={() => setOpenTaskId(t.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <TaskDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />
    </div>
  );
}

function EscalationCard({
  task,
  flag,
  raisedByName,
  decidedByName,
  onDecide,
  onOpenTask,
}: {
  task: Task;
  flag: SensitiveFlag;
  raisedByName?: string;
  decidedByName?: string;
  onDecide: (status: "cleared" | "holding") => Promise<void>;
  onOpenTask: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: "cleared" | "holding") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDecide(status);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't update that flag. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base truncate flex items-center gap-2">
            <ShieldAlert
              className={`h-4 w-4 shrink-0 ${
                flag.status === "cleared"
                  ? "text-emerald-600"
                  : flag.status === "open"
                    ? "text-red-600"
                    : "text-amber-600"
              }`}
            />
            {task.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {REASON_LABEL[flag.reason]} · raised by{" "}
            {raisedByName ?? "unknown"}{" "}
            {format(new Date(flag.raisedAt), "MMM d")}
            {decidedByName && flag.decidedAt
              ? ` · ${flag.status} by ${decidedByName} ${format(
                  new Date(flag.decidedAt),
                  "MMM d"
                )}`
              : ""}
          </p>
        </div>
        <Badge
          variant={
            flag.status === "open"
              ? "danger"
              : flag.status === "cleared"
                ? "success"
                : "warning"
          }
          className="capitalize"
        >
          {flag.status}
        </Badge>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3">
        <p className="text-sm">{flag.notes}</p>
        {flag.decisionNote && (
          <p className="text-xs italic text-muted-foreground">
            &quot;{flag.decisionNote}&quot;
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpenTask}>
            Open story
          </Button>
          {flag.status !== "cleared" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => decide("cleared")}
            >
              {flag.status === "holding" ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" /> Release &amp; clear
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Clear
                </>
              )}
            </Button>
          )}
          {flag.status !== "holding" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => decide("holding")}
            >
              <Pause className="h-3.5 w-3.5" /> Hold
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
