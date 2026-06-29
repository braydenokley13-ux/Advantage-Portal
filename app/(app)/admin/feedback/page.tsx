"use client";

import { useMemo, useState } from "react";
import {
  MessageSquarePlus,
  Inbox,
  CheckCircle2,
  Star,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
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
import { AccessDenied } from "@/components/ui/states";
import { useRole } from "@/lib/role-context";
import { useApiClient } from "@/lib/api/provider";
import { useFeedback, useRealtimeRefetch, useUsers } from "@/lib/hooks";
import { useSiteConfig } from "@/lib/site-config";
import { canTriageFeedback } from "@/lib/permissions";
import type { FeedbackStatusZ, FeedbackZ, UserZ } from "@/lib/contracts";
import { initials, cn } from "@/lib/utils";
import { formatDistanceToNowStrict, format } from "date-fns";

type Tab = FeedbackStatusZ | "all";

const STATUS_TONE: Record<
  FeedbackStatusZ,
  "default" | "secondary" | "warning" | "success" | "danger"
> = {
  open: "warning",
  triaged: "default",
  planned: "default",
  resolved: "success",
  declined: "secondary",
  archived: "secondary",
};

const TABS: { v: Tab; label: string }[] = [
  { v: "open", label: "Open" },
  { v: "triaged", label: "Triaged" },
  { v: "planned", label: "Planned" },
  { v: "resolved", label: "Resolved" },
  { v: "declined", label: "Declined" },
  { v: "archived", label: "Archived" },
  { v: "all", label: "All" },
];

const EMPTY_FEEDBACK: FeedbackZ[] = [];
const EMPTY_USERS: UserZ[] = [];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function FeedbackQueuePage() {
  const { role } = useRole();
  const { config } = useSiteConfig();
  const { data: usersData } = useUsers();
  const users = usersData ?? EMPTY_USERS;

  const [tab, setTab] = useState<Tab>("open");
  const filterStatus = tab === "all" ? undefined : tab;
  const { data: listData, refetch } = useFeedback(
    filterStatus ? { status: filterStatus } : undefined
  );
  const list = listData ?? EMPTY_FEEDBACK;

  const { data: allData, refetch: refetchAll } = useFeedback();
  const all = allData ?? EMPTY_FEEDBACK;

  const [openId, setOpenId] = useState<string | null>(null);

  useRealtimeRefetch(["feedback"], () => {
    refetch();
    refetchAll();
  });

  const categoryLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of config.feedbackCategories) map.set(c.value, c.label);
    return (value: string) => map.get(value) ?? value.replace(/_/g, " ");
  }, [config.feedbackCategories]);

  const stats = useMemo(() => {
    const open = all.filter((f) => f.status === "open").length;
    const now = new Date().getTime();
    const thisWeek = all.filter(
      (f) => now - new Date(f.createdAt).getTime() < WEEK_MS
    ).length;
    const resolved = all.filter((f) => f.status === "resolved").length;
    const rated = all.filter((f) => typeof f.rating === "number");
    const avg =
      rated.length > 0
        ? (
            rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length
          ).toFixed(1)
        : "—";
    return { open, thisWeek, resolved, avg };
  }, [all]);

  if (!canTriageFeedback(role)) {
    return (
      <AccessDenied
        title="Feedback access required"
        description="Only leaders and admins can review the feedback queue."
      />
    );
  }

  const selected = list.find((f) => f.id === openId) ?? null;

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Feedback"
        description="Everything the team sends about the Advantage — bugs, ideas, and notes on our coverage."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Open"
          value={stats.open}
          icon={Inbox}
          tone={stats.open > 0 ? "warning" : "neutral"}
        />
        <StatCard label="This week" value={stats.thisWeek} icon={Sparkles} />
        <StatCard
          label="Resolved"
          value={stats.resolved}
          icon={CheckCircle2}
          tone="positive"
        />
        <StatCard label="Avg rating" value={stats.avg} icon={Star} />
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {TABS.map((t) => {
          const count =
            t.v === "all"
              ? all.length
              : all.filter((f) => f.status === t.v).length;
          const active = tab === t.v;
          return (
            <button
              key={t.v}
              type="button"
              onClick={() => setTab(t.v)}
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
      </div>

      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <MessageSquarePlus className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No feedback here</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tab === "open"
                ? "Inbox zero — nothing waiting on triage."
                : "Nothing matches this filter."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Feedback</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                  From
                </th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                  Category
                </th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((f) => {
                const author = users.find((u) => u.id === f.authorId);
                return (
                  <tr
                    key={f.id}
                    className="hover:bg-accent/40 cursor-pointer"
                    onClick={() => setOpenId(f.id)}
                  >
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium line-clamp-1">
                        {f.subject}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {f.message}
                      </p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px]">
                            {initials(author?.name ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">
                          {author?.name ?? "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {categoryLabel(f.category)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={STATUS_TONE[f.status]}>
                        {f.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-[11px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(f.createdAt), {
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

      <FeedbackDetailDialog
        key={selected?.id ?? "none"}
        feedback={selected}
        users={users}
        categoryLabel={categoryLabel}
        onClose={() => {
          setOpenId(null);
          refetch();
          refetchAll();
        }}
      />
    </div>
  );
}

function FeedbackDetailDialog({
  feedback,
  users,
  categoryLabel,
  onClose,
}: {
  feedback: FeedbackZ | null;
  users: UserZ[];
  categoryLabel: (value: string) => string;
  onClose: () => void;
}) {
  const { user } = useRole();
  const api = useApiClient();
  const [note, setNote] = useState(feedback?.adminNote ?? "");
  const [assignee, setAssignee] = useState(feedback?.assignedToId ?? "");
  const [busy, setBusy] = useState(false);

  // "Derive from props" reset when the dialog opens for a different item.
  const [lastId, setLastId] = useState(feedback?.id);
  if (feedback?.id !== lastId) {
    setLastId(feedback?.id);
    setNote(feedback?.adminNote ?? "");
    setAssignee(feedback?.assignedToId ?? "");
  }

  if (!feedback) return null;
  const author = users.find((u) => u.id === feedback.authorId);
  const staff = users.filter(
    (u) => u.role === "leader" || u.role === "admin"
  );

  async function apply(status?: FeedbackStatusZ) {
    setBusy(true);
    try {
      await api.updateFeedback(feedback!.id, {
        status,
        assignedToId: assignee || undefined,
        adminNote: note.trim() || undefined,
        resolvedById: status ? user.id : undefined,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const STATUS_ACTIONS: { status: FeedbackStatusZ; label: string }[] = [
    { status: "triaged", label: "Triaged" },
    { status: "planned", label: "Planned" },
    { status: "resolved", label: "Resolved" },
    { status: "declined", label: "Declined" },
    { status: "archived", label: "Archive" },
  ];

  return (
    <Dialog open={!!feedback} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{feedback.subject}</DialogTitle>
          <DialogDescription className="text-xs">
            {categoryLabel(feedback.category)} ·{" "}
            {format(new Date(feedback.createdAt), "MMM d, h:mm a")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-sm leading-snug whitespace-pre-wrap">
              {feedback.message}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="From" value={author?.name ?? "Unknown"} />
            <Field
              label="Rating"
              value={
                typeof feedback.rating === "number"
                  ? `${feedback.rating} / 5`
                  : "—"
              }
            />
            {feedback.targetLabel && (
              <Field label="About" value={feedback.targetLabel} />
            )}
            <Field label="Status" value={feedback.status} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Assign to
            </label>
            <Select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Internal note
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes for the team — what we're doing about this."
              className="min-h-[70px]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_ACTIONS.map((a) => (
              <Button
                key={a.status}
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => apply(a.status)}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : a.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => apply()}
            >
              Save note
            </Button>
          </div>
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
