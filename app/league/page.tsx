"use client";

/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Public Writers League leaderboard.
 *
 * Reads the `league_leaderboard` view (safe columns only) and the active season
 * straight from Supabase with the anon key, and subscribes to realtime point
 * movements so totals re-rank live — no refresh needed. Each row expands to
 * reveal that writer's full point-event history pulled from `point_events`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Calendar,
  ChevronDown,
  FileText,
  Loader2,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRealtimeRefetch } from "@/lib/hooks/use-realtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  POINT_EVENT_LABEL,
  mapLeaderboardRow,
  mapPointEvent,
  mapSeason,
  type LeaderboardRow,
  type PointEvent,
  type Season,
} from "@/lib/league/types";

export default function LeaguePage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, PointEvent[]>>({});

  // Load the active season + the full leaderboard. Re-run on realtime change.
  const load = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) {
      setError("The league leaderboard is not available right now.");
      setLoading(false);
      return;
    }
    const [seasonRes, boardRes] = await Promise.all([
      sb
        .from("seasons")
        .select("id, name, start_date, end_date, is_active")
        .eq("is_active", true)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("league_leaderboard")
        .select(
          "writer_id, name, school, total_points, published_count, award_count, feature_count, rank"
        )
        .order("rank", { ascending: true }),
    ]);

    if (boardRes.error) {
      setError("Couldn't load the leaderboard. Please try again shortly.");
      setLoading(false);
      return;
    }

    setSeason(seasonRes.data ? mapSeason(seasonRes.data) : null);
    setRows((boardRes.data ?? []).map(mapLeaderboardRow));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates: any point movement re-pulls the (re-ranked) board.
  useRealtimeRefetch(
    ["league_points", "point_events", "weekly_awards", "seasons"],
    () => {
      void load();
    }
  );

  // Lazily fetch a writer's point history the first time their row expands.
  const toggleRow = useCallback(
    async (writerId: string) => {
      if (expanded === writerId) {
        setExpanded(null);
        return;
      }
      setExpanded(writerId);
      if (history[writerId]) return;
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      const { data } = await sb
        .from("point_events")
        .select("id, writer_id, event_type, points_awarded, created_at")
        .eq("writer_id", writerId)
        .order("created_at", { ascending: false });
      setHistory((prev) => ({
        ...prev,
        [writerId]: (data ?? []).map(mapPointEvent),
      }));
    },
    [expanded, history]
  );

  const daysRemaining = useMemo(() => {
    if (!season) return null;
    return Math.max(0, differenceInCalendarDays(new Date(season.endDate), new Date()));
  }, [season]);

  return (
    <div className="container py-8 md:py-12">
      {/* Season header */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient px-6 py-8 text-white md:px-10 md:py-10">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Trophy className="h-4 w-4" />
            The Advantage Writers League
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {season ? season.name : "Live Leaderboard"}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/90">
            {season && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {daysRemaining === 0
                  ? "Final day of the season"
                  : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              {rows.length} ranked writer{rows.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Updates live
            </span>
          </div>
          {season && (
            <p className="mt-1 text-xs text-white/70">
              {format(new Date(season.startDate), "MMM d, yyyy")} —{" "}
              {format(new Date(season.endDate), "MMM d, yyyy")}
            </p>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="mt-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the leaderboard…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {error}
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Trophy className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">No ranked writers yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Writers join the leaderboard when their first piece is published.
                Be the first — submit your work to get started.
              </p>
              <Button asChild className="mt-5" variant="gradient">
                <Link href="/league/submit">Submit your work</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <LeaderboardRowItem
                  key={row.writerId}
                  row={row}
                  expanded={expanded === row.writerId}
                  history={history[row.writerId]}
                  onToggle={() => toggleRow(row.writerId)}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Points: 100 for a published piece · 50 for a weekly award · 25 for a
        homepage feature.
      </p>
    </div>
  );
}

/** Rank → medal tint for the top three. */
function rankTone(rank: number): string {
  if (rank === 1) return "bg-amber-100 text-amber-700 border-amber-200";
  if (rank === 2) return "bg-slate-100 text-slate-600 border-slate-200";
  if (rank === 3) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-secondary text-muted-foreground border-transparent";
}

function LeaderboardRowItem({
  row,
  expanded,
  history,
  onToggle,
}: {
  row: LeaderboardRow;
  expanded: boolean;
  history?: PointEvent[];
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50 md:px-5"
      >
        {/* Rank */}
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
            rankTone(row.rank)
          )}
        >
          {row.rank}
        </span>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{row.name}</p>
          {row.school && (
            <p className="truncate text-xs text-muted-foreground">{row.school}</p>
          )}
        </div>

        {/* Stats */}
        <div className="hidden items-center gap-4 sm:flex">
          <Stat icon={FileText} value={row.publishedCount} label="published" />
          <Stat icon={Award} value={row.awardCount} label="awards" />
        </div>

        {/* Points */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <div className="text-base font-bold tracking-tight">
              {row.totalPoints}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              points
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-secondary/30 px-4 py-4 md:px-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Star className="h-3.5 w-3.5" /> Point history
          </div>
          {!history ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : history.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">
              No point events yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {history.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-medium">
                      {POINT_EVENT_LABEL[event.eventType]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {format(new Date(event.createdAt), "MMM d, yyyy")}
                    </span>
                  </span>
                  <span className="font-semibold text-emerald-600">
                    +{event.pointsAwarded}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}
