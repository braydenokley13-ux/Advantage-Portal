"use client";

/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Board admin for the Writers League (leaders/admins only).
 *
 * Everything here funnels through the league API routes, so every status
 * change, feature, and award triggers the same point updates and emails the
 * rest of the system relies on — nothing is changed silently. Tabs cover:
 *   • Submissions — change status (dropdown) and feature pieces
 *   • Overdue     — pieces waiting longest on review
 *   • Awards      — record the week's three winners
 *   • Point log   — every point event across all writers
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  ScrollText,
  Star,
} from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/lib/role-context";
import { useRealtimeRefetch } from "@/lib/hooks/use-realtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  AWARD_TYPE_LABEL,
  POINT_EVENT_LABEL,
  SUBMISSION_STATUS_LABEL,
  type LeagueAwardType,
  type LeagueSubmissionStatus,
  type LeaguePointEventType,
} from "@/lib/league/types";

// ── view-model row types ────────────────────────────────────────────────────
type AdminSubmission = {
  id: string;
  articleTitle: string;
  googleDocLink: string;
  submissionDate: string;
  assignedEditor: string;
  status: LeagueSubmissionStatus;
  editorFeedback: string;
  featuredAt: string | null;
  writerId: string;
  writerName: string;
  writerSchool: string;
};

type AdminWriter = { id: string; name: string };

type AdminPointEvent = {
  id: string;
  writerName: string;
  eventType: LeaguePointEventType;
  pointsAwarded: number;
  createdAt: string;
};

const STATUS_TONE: Record<
  LeagueSubmissionStatus,
  "default" | "secondary" | "success" | "warning" | "danger"
> = {
  under_review: "warning",
  approved: "secondary",
  rejected: "danger",
  published: "success",
};

export default function AdminLeaguePage() {
  const { role } = useRole();
  const allowed = role === "leader" || role === "admin";

  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [writers, setWriters] = useState<AdminWriter[]>([]);
  const [events, setEvents] = useState<AdminPointEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) {
      setLoading(false);
      return;
    }
    const [subsRes, writersRes, eventsRes] = await Promise.all([
      sb
        .from("league_submissions")
        .select(
          "id, article_title, google_doc_link, submission_date, assigned_editor, status, editor_feedback, featured_at, writer_id, writers(name, school)"
        )
        .order("submission_date", { ascending: false }),
      sb.from("writers").select("id, name").order("name", { ascending: true }),
      sb
        .from("point_events")
        .select("id, event_type, points_awarded, created_at, writers(name)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    type SubRow = {
      id: string;
      article_title: string;
      google_doc_link: string;
      submission_date: string;
      assigned_editor: string;
      status: LeagueSubmissionStatus;
      editor_feedback: string | null;
      featured_at: string | null;
      writer_id: string;
      writers: { name: string; school: string } | null;
    };
    type EventRow = {
      id: string;
      event_type: LeaguePointEventType;
      points_awarded: number;
      created_at: string;
      writers: { name: string } | null;
    };

    // supabase-js types to-one embeds as arrays, but PostgREST returns a single
    // object for a foreign-key embed — cast through `unknown` to the real shape.
    setSubmissions(
      ((subsRes.data ?? []) as unknown as SubRow[]).map((r) => ({
        id: r.id,
        articleTitle: r.article_title,
        googleDocLink: r.google_doc_link,
        submissionDate: r.submission_date,
        assignedEditor: r.assigned_editor,
        status: r.status,
        editorFeedback: r.editor_feedback ?? "",
        featuredAt: r.featured_at,
        writerId: r.writer_id,
        writerName: r.writers?.name ?? "Unknown writer",
        writerSchool: r.writers?.school ?? "",
      }))
    );
    setWriters((writersRes.data ?? []) as AdminWriter[]);
    setEvents(
      ((eventsRes.data ?? []) as unknown as EventRow[]).map((r) => ({
        id: r.id,
        writerName: r.writers?.name ?? "Unknown writer",
        eventType: r.event_type,
        pointsAwarded: r.points_awarded,
        createdAt: r.created_at,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  // Re-pull when points move (publish/award/feature land here in real time).
  useRealtimeRefetch(["league_points", "point_events", "weekly_awards"], () => {
    if (allowed) void load();
  });

  const overdue = useMemo(
    () =>
      submissions
        .filter((s) => s.status === "under_review")
        .map((s) => ({
          ...s,
          daysWaiting: Math.max(
            0,
            differenceInCalendarDays(new Date(), new Date(s.submissionDate))
          ),
        }))
        .sort((a, b) => b.daysWaiting - a.daysWaiting),
    [submissions]
  );

  if (!allowed) {
    return (
      <div className="container max-w-md py-12">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Board access required</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only league board members (leaders and admins) can manage
              submissions, awards, and features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6 md:py-8">
      <PageHeader
        title="Writers League — Board"
        description="Move submissions through review, feature standout pieces, and record weekly awards. Every action sends the writer an email and updates the leaderboard automatically."
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading league data…
        </div>
      ) : (
        <Tabs defaultValue="submissions">
          <TabsList>
            <TabsTrigger value="submissions">
              Submissions
              <span className="ml-1.5 rounded-full bg-background/60 px-1.5 text-[10px]">
                {submissions.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue
              {overdue.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">
                  {overdue.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="awards">Awards</TabsTrigger>
            <TabsTrigger value="log">Point log</TabsTrigger>
          </TabsList>

          {/* ── Submissions ─────────────────────────────────────────────── */}
          <TabsContent value="submissions" className="mt-4 space-y-3">
            {submissions.length === 0 ? (
              <EmptyCard icon={FileText} text="No submissions yet." />
            ) : (
              submissions.map((s) => (
                <SubmissionCard key={s.id} submission={s} onChanged={load} />
              ))
            )}
          </TabsContent>

          {/* ── Overdue ─────────────────────────────────────────────────── */}
          <TabsContent value="overdue" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Pieces still under review, longest-waiting first. The 8am cron
              emails the editor at 5 days and escalates to the journal at 7 and
              10 days.
            </p>
            {overdue.length === 0 ? (
              <EmptyCard icon={Clock} text="Nothing is overdue. Queue is clear!" />
            ) : (
              overdue.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {s.articleTitle}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.writerName} · editor {s.assignedEditor} · submitted{" "}
                        {format(new Date(s.submissionDate), "MMM d")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        s.daysWaiting >= 10
                          ? "danger"
                          : s.daysWaiting >= 7
                            ? "warning"
                            : "secondary"
                      }
                      className="shrink-0"
                    >
                      {s.daysWaiting} day{s.daysWaiting === 1 ? "" : "s"} waiting
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── Awards ──────────────────────────────────────────────────── */}
          <TabsContent value="awards" className="mt-4">
            <AwardsForm writers={writers} onAwarded={load} />
          </TabsContent>

          {/* ── Point log ───────────────────────────────────────────────── */}
          <TabsContent value="log" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScrollText className="h-4 w-4 text-muted-foreground" /> Point
                  events — full audit trail
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {events.length === 0 ? (
                  <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No points awarded yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {events.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{e.writerName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {POINT_EVENT_LABEL[e.eventType]}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-semibold text-emerald-600">
                            +{e.pointsAwarded}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(e.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── submission card ─────────────────────────────────────────────────────────
function SubmissionCard({
  submission,
  onChanged,
}: {
  submission: AdminSubmission;
  onChanged: () => Promise<void> | void;
}) {
  const [feedback, setFeedback] = useState(submission.editorFeedback);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function changeStatus(status: LeagueSubmissionStatus) {
    if (busy || status === submission.status) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/league/submissions/${submission.id}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, feedback: feedback.trim() || undefined }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Couldn't update the status.");
        return;
      }
      setNotice(`Status set to ${SUBMISSION_STATUS_LABEL[status]}.`);
      await onChanged();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function feature() {
    if (busy || submission.featuredAt) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/league/submissions/${submission.id}/feature`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Couldn't feature the piece.");
        return;
      }
      setNotice("Featured on the homepage (+25 points).");
      await onChanged();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">
                {submission.articleTitle}
              </p>
              {submission.featuredAt && (
                <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {submission.writerName}
              {submission.writerSchool ? ` · ${submission.writerSchool}` : ""} ·
              editor {submission.assignedEditor} ·{" "}
              {format(new Date(submission.submissionDate), "MMM d, yyyy")}
            </p>
          </div>
          <Badge variant={STATUS_TONE[submission.status]} className="shrink-0">
            {SUBMISSION_STATUS_LABEL[submission.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={`status-${submission.id}`}>Status</Label>
            <Select
              id={`status-${submission.id}`}
              className="w-44"
              value={submission.status}
              disabled={busy}
              onChange={(e) =>
                changeStatus(e.target.value as LeagueSubmissionStatus)
              }
            >
              {(
                Object.keys(SUBMISSION_STATUS_LABEL) as LeagueSubmissionStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {SUBMISSION_STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={feature}
            disabled={busy || !!submission.featuredAt}
          >
            <Star className="h-3.5 w-3.5" />
            {submission.featuredAt ? "Featured" : "Feature on homepage"}
          </Button>

          <Button variant="ghost" size="sm" asChild>
            <a
              href={submission.googleDocLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open doc
            </a>
          </Button>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`feedback-${submission.id}`}>
            Editor feedback{" "}
            <span className="font-normal text-muted-foreground">
              (sent to the writer on rejection)
            </span>
          </Label>
          <Textarea
            id={`feedback-${submission.id}`}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What worked, what to sharpen, and an invitation to resubmit…"
            className="min-h-[64px]"
            disabled={busy}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {notice && <p className="text-xs text-emerald-600">{notice}</p>}
      </CardContent>
    </Card>
  );
}

// ── awards form ─────────────────────────────────────────────────────────────
const AWARD_TYPES = Object.keys(AWARD_TYPE_LABEL) as LeagueAwardType[];

function AwardsForm({
  writers,
  onAwarded,
}: {
  writers: AdminWriter[];
  onAwarded: () => Promise<void> | void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [weekOf, setWeekOf] = useState(today);
  // One selectable winner slot per award type.
  const [picks, setPicks] = useState<Record<LeagueAwardType, string>>({
    best_argument: "",
    best_use_of_data: "",
    editors_pick: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function setPick(type: LeagueAwardType, writerId: string) {
    setPicks((prev) => ({ ...prev, [type]: writerId }));
  }

  async function submit() {
    const winners = AWARD_TYPES.filter((t) => picks[t]).map((t) => ({
      awardType: t,
      writerId: picks[t],
    }));
    if (winners.length === 0) {
      setError("Pick at least one winner.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/league/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOf, winners }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Couldn't record the awards.");
        return;
      }
      setNotice(`Recorded ${json.awarded} award(s). Winners have been emailed.`);
      setPicks({ best_argument: "", best_use_of_data: "", editors_pick: "" });
      await onAwarded();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-4 w-4 text-muted-foreground" /> Record weekly
          awards
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Each award adds 50 points and emails the winner. Leave a category blank
          to skip it.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-[200px] space-y-1">
          <Label htmlFor="weekOf">Week of</Label>
          <Input
            id="weekOf"
            type="date"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
            disabled={busy}
          />
        </div>

        {AWARD_TYPES.map((type) => (
          <div key={type} className="space-y-1">
            <Label htmlFor={`award-${type}`}>{AWARD_TYPE_LABEL[type]}</Label>
            <Select
              id={`award-${type}`}
              value={picks[type]}
              disabled={busy}
              onChange={(e) => setPick(type, e.target.value)}
            >
              <option value="">— No winner this week —</option>
              {writers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        ))}

        {error && <p className="text-xs text-red-600">{error}</p>}
        {notice && <p className="text-xs text-emerald-600">{notice}</p>}

        <Button variant="gradient" onClick={submit} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Recording…
            </>
          ) : (
            "Record awards & notify winners"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── tiny empty-state card ───────────────────────────────────────────────────
function EmptyCard({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
