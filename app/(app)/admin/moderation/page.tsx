"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Inbox,
  Flag,
  Trash2,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { useRole } from "@/lib/role-context";
import { useApiClient } from "@/lib/api/provider";
import { useStore } from "@/lib/store";
import { useModerationReports } from "@/lib/hooks";
import { canModerate } from "@/lib/permissions";
import type {
  ModerationReportZ,
  ModerationStatusZ,
} from "@/lib/contracts";
import type { ModerationReason } from "@/lib/types";
import { initials, cn } from "@/lib/utils";
import { formatDistanceToNowStrict, format, isToday } from "date-fns";

type Tab = "open" | "in_review" | "resolved" | "dismissed" | "all";

const REASON_LABEL: Record<ModerationReason, string> = {
  inappropriate_language: "Inappropriate language",
  bullying_or_harassment: "Bullying / harassment",
  personal_information: "Personal info shared",
  off_topic_or_spam: "Off-topic / spam",
  other: "Other",
};

const STATUS_TONE: Record<
  ModerationStatusZ,
  "default" | "secondary" | "warning" | "success" | "danger"
> = {
  open: "warning",
  in_review: "default",
  resolved: "success",
  dismissed: "secondary",
};

export default function ModerationPage() {
  const { role, user } = useRole();
  const api = useApiClient();
  const { users, messages } = useStore();
  const [tab, setTab] = useState<Tab>("open");
  const filterStatus = tab === "all" ? undefined : tab;
  const { data: reportsData, refetch } = useModerationReports(
    filterStatus ? { status: filterStatus } : undefined
  );
  const reports = reportsData ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  // Always read all reports for stat cards (independent of tab filter).
  const { data: allReportsData } = useModerationReports();
  const allReports = allReportsData ?? [];

  const stats = useMemo(() => {
    const open = allReports.filter((r) => r.status === "open").length;
    const high = allReports.filter(
      (r) => r.severity === "high" && r.status !== "resolved" && r.status !== "dismissed"
    ).length;
    const resolvedToday = allReports.filter(
      (r) => r.resolvedAt && isToday(new Date(r.resolvedAt))
    ).length;
    // Repeat-reported users.
    const counts = new Map<string, number>();
    for (const r of allReports) {
      counts.set(r.reportedUserId, (counts.get(r.reportedUserId) ?? 0) + 1);
    }
    const repeatOffenders = [...counts.values()].filter((n) => n > 1).length;
    return { open, high, resolvedToday, repeatOffenders };
  }, [allReports]);

  if (!canModerate(role)) {
    return (
      <div className="container py-12 max-w-md">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Moderation access required</p>
            <p className="text-xs text-muted-foreground mt-1">
              Only leaders and admins can review reported messages. If you
              think this is a mistake, ask an admin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedReport = reports.find((r) => r.id === openReportId);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(reports.map((r) => r.id)));
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function bulk(status: ModerationStatusZ) {
    if (selectedIds.size === 0) return;
    await api.bulkUpdateModerationReports([...selectedIds], {
      status,
      resolvedById: user.id,
    });
    clearSelection();
    refetch();
  }

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Moderation"
        description="Review reported messages. Be fair, be kind, and act quickly when teen-safety is at stake."
      />

      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <div className="mt-0.5 h-8 w-8 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="text-foreground font-medium">
              How to use this queue
            </p>
            <p className="mt-0.5">
              Reports come from per-message Report buttons in chats. Open a
              report to read context, then mark it{" "}
              <span className="font-medium">In review</span>,{" "}
              <span className="font-medium">Resolved</span>, or{" "}
              <span className="font-medium">Dismissed</span>. If a message
              clearly violates teen-safety standards, hide it. Always leave
              an internal note before resolving.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Open reports"
          value={stats.open}
          icon={Inbox}
          tone={stats.open > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="High priority"
          value={stats.high}
          icon={AlertTriangle}
          tone={stats.high > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Resolved today"
          value={stats.resolvedToday}
          icon={CheckCircle2}
          tone="positive"
        />
        <StatCard
          label="Repeat reported"
          value={stats.repeatOffenders}
          icon={Flag}
          delta="Users with > 1 report"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {(
          [
            { v: "open", label: "Open" },
            { v: "in_review", label: "In review" },
            { v: "resolved", label: "Resolved" },
            { v: "dismissed", label: "Dismissed" },
            { v: "all", label: "All" },
          ] as { v: Tab; label: string }[]
        ).map((t) => {
          const count =
            t.v === "all"
              ? allReports.length
              : allReports.filter((r) => r.status === t.v).length;
          const active = tab === t.v;
          return (
            <button
              key={t.v}
              type="button"
              onClick={() => {
                setTab(t.v);
                clearSelection();
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card hover:bg-accent border-border"
              )}
            >
              {t.label}
              {count > 0 && (
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className="h-4 px-1.5 text-[9px]"
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}

        {selectedIds.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button size="sm" variant="outline" onClick={() => bulk("in_review")}>
              Mark in review
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("resolved")}>
              Resolve
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("dismissed")}>
              Dismiss
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        {reports.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <ShieldAlert className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No reports here</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tab === "open"
                ? "Inbox zero. Nothing waiting on triage."
                : "Nothing matches this filter."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all visible"
                    checked={
                      reports.length > 0 &&
                      reports.every((r) => selectedIds.has(r.id))
                    }
                    onChange={(e) =>
                      e.target.checked ? selectAllVisible() : clearSelection()
                    }
                  />
                </th>
                <th className="text-left px-3 py-2 font-medium">Message</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                  Reporter
                </th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                  Reason
                </th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Severity</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((r) => {
                const message = messages.find((m) => m.id === r.messageId);
                const reporter = users.find((u) => u.id === r.reporterId);
                const reported = users.find((u) => u.id === r.reportedUserId);
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-accent/40 cursor-pointer"
                    onClick={() => setOpenReportId(r.id)}
                  >
                    <td
                      className="px-3 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelected(r.id)}
                        aria-label="Select report"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs line-clamp-1">
                        {message?.body ?? "(message removed)"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        from {reported?.name ?? "Unknown"}
                      </p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px]">
                            {initials(reporter?.name ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">
                          {reporter?.name ?? "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {REASON_LABEL[r.reason]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={STATUS_TONE[r.status]}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          r.severity === "high"
                            ? "danger"
                            : r.severity === "low"
                              ? "secondary"
                              : "warning"
                        }
                      >
                        {r.severity}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-[11px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(r.createdAt), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <ReportDetailDialog
        report={selectedReport ?? null}
        onClose={() => {
          setOpenReportId(null);
          refetch();
        }}
      />
    </div>
  );
}

function ReportDetailDialog({
  report,
  onClose,
}: {
  report: ModerationReportZ | null;
  onClose: () => void;
}) {
  const { user } = useRole();
  const api = useApiClient();
  const { users, messages, hideMessage: storeHide } = useStore();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset note when the dialog opens for a different report. `useMemo`
  // was previously misused here as a side-effect channel; `useEffect` is
  // the right tool (runs after commit, not during render).
  useEffect(() => {
    setNote(report?.internalNote ?? "");
  }, [report?.id, report?.internalNote]);

  if (!report) return null;
  const message = messages.find((m) => m.id === report.messageId);
  const reporter = users.find((u) => u.id === report.reporterId);
  const reported = users.find((u) => u.id === report.reportedUserId);

  async function decide(status: ModerationStatusZ) {
    setBusy(true);
    try {
      await api.updateModerationReport(report!.id, {
        status,
        internalNote: note.trim() || undefined,
        resolvedById: user.id,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function toggleHide() {
    if (!message) return;
    setBusy(true);
    try {
      await api.hideMessage(message.id);
      // ensure mock store reflects too if running mock
      storeHide(message.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!report} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report detail</DialogTitle>
          <DialogDescription className="text-xs">
            Created {format(new Date(report.createdAt), "MMM d, h:mm a")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Reported message
            </p>
            <p className="text-sm leading-snug">
              {message?.body ?? "(message removed)"}
            </p>
            <p className="text-xs text-muted-foreground">
              From {reported?.name ?? "Unknown"} ·{" "}
              {message?.hiddenAt ? "hidden by moderator" : "visible to chat"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reporter" value={reporter?.name ?? "Unknown"} />
            <Field label="Reason" value={REASON_LABEL[report.reason]} />
            <Field
              label="Status"
              value={report.status.replace("_", " ")}
            />
            <Field label="Severity" value={report.severity} />
          </div>

          {report.reporterNote && (
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Reporter's note
              </p>
              <p className="text-sm mt-1 whitespace-pre-wrap">
                {report.reporterNote}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-amber-900/70 font-medium">
              Safety guidance
            </p>
            <ul className="text-xs text-amber-900/90 leading-relaxed list-disc pl-4 mt-1 space-y-0.5">
              <li>If a teen's safety is at risk, hide the message immediately.</li>
              <li>Address bullying/harassment early; don't wait for repeats.</li>
              <li>Personal info should be hidden, then resolve with a note.</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Internal note (audit trail)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why are you taking this action? Future moderators will read this."
              className="min-h-[80px]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => decide("in_review")}
            >
              <Eye className="h-3.5 w-3.5" /> Mark in review
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => decide("resolved")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => decide("dismissed")}
            >
              <XCircle className="h-3.5 w-3.5" /> Dismiss
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !message}
              onClick={toggleHide}
            >
              {message?.hiddenAt ? (
                <>
                  <Eye className="h-3.5 w-3.5" /> Unhide message
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Hide message
                </>
              )}
            </Button>
          </div>

          {report.resolvedAt && (
            <p className="text-[11px] text-muted-foreground border-t border-border pt-3 flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Last decision recorded{" "}
              {formatDistanceToNowStrict(new Date(report.resolvedAt), {
                addSuffix: true,
              })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium mt-0.5 capitalize">{value}</p>
    </div>
  );
}
