"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Pencil,
  Trophy,
  Gavel,
  PlayCircle,
  Archive,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { AccessDenied, Skeleton } from "@/components/ui/states";
import { CompetitionFormDialog } from "@/components/competition/competition-form";
import { EntryForm } from "@/components/competition/entry-form";
import { JudgePanel } from "@/components/competition/judge-panel";
import { Leaderboard } from "@/components/competition/leaderboard";
import { useRole } from "@/lib/role-context";
import { useApiClient } from "@/lib/api/provider";
import { useSiteConfig } from "@/lib/site-config";
import {
  useCompetition,
  useCompetitionEntries,
  useCompetitionScores,
  useRealtimeRefetch,
  useUsers,
} from "@/lib/hooks";
import { featureEnabledFor } from "@/lib/site-config-defaults";
import {
  canManageCompetitions,
  canJudgeCompetitions,
} from "@/lib/permissions";
import {
  competitionStatusLabel,
  competitionStatusTone,
} from "@/lib/competition";
import {
  emailOnCompetitionOpen,
  emailOnWinnerAnnounced,
} from "@/lib/email/workflow";
import { format } from "date-fns";
import type { CompetitionStatusZ } from "@/lib/contracts";

export default function CompetitionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const { role, user } = useRole();
  const { config } = useSiteConfig();
  const api = useApiClient();

  const { data: competition, loading, refetch } = useCompetition(id);
  const { data: entriesData, refetch: refetchEntries } =
    useCompetitionEntries(id);
  const { data: scoresData, refetch: refetchScores } = useCompetitionScores(id);
  const { data: usersData } = useUsers();

  const entries = entriesData ?? [];
  const scores = scoresData ?? [];
  const users = usersData ?? [];

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  useRealtimeRefetch(["competitions"], refetch);
  useRealtimeRefetch(["competition_entries"], refetchEntries);
  useRealtimeRefetch(["competition_scores"], refetchScores);

  if (!featureEnabledFor(config, "competitions", role)) {
    return (
      <AccessDenied
        title="Competitions are turned off"
        description="An admin can re-enable essay competitions in Settings."
      />
    );
  }

  if (loading) {
    return (
      <div className="container py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!competition) {
    return (
      <AccessDenied
        title="Competition not found"
        description="It may have been removed, or it isn't open yet."
      />
    );
  }

  const canManage = canManageCompetitions(role);
  const canJudge = canJudgeCompetitions(role);
  const myEntry = entries.find((e) => e.authorId === user.id) ?? null;
  const revealAuthors =
    !competition.anonymizedJudging || competition.status === "announced";
  const showEntryForm = competition.status !== "draft";
  const showJudging =
    canJudge &&
    (competition.status === "open" || competition.status === "judging");
  const showLeaderboard =
    competition.status === "announced" || canJudge || canManage;

  function refetchAll() {
    refetch();
    refetchEntries();
    refetchScores();
  }

  async function setStatus(status: CompetitionStatusZ) {
    if (busy || !competition) return;
    setBusy(true);
    try {
      await api.setCompetitionStatus(competition.id, status);
      if (status === "open") emailOnCompetitionOpen(users, competition.title);
      refetchAll();
    } finally {
      setBusy(false);
    }
  }

  async function announce(winnerEntryId: string) {
    if (picking || !competition) return;
    setPicking(winnerEntryId);
    try {
      await api.announceCompetition({
        competitionId: competition.id,
        winnerEntryId,
        decidedById: user.id,
      });
      emailOnWinnerAnnounced(
        entries.map((e) => e.authorId),
        competition.title
      );
      refetchAll();
    } finally {
      setPicking(null);
    }
  }

  const winnerEntry = competition.winnerEntryId
    ? entries.find((e) => e.id === competition.winnerEntryId)
    : null;

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <Link
        href="/competitions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All competitions
      </Link>

      <PageHeader
        title={competition.title}
        description={competition.description || undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={competitionStatusTone(competition.status)}>
              {competitionStatusLabel(competition.status)}
            </Badge>
            {canManage && competition.status !== "archived" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        }
      />

      {/* Manager workflow controls */}
      {canManage && (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">
              Manage:
            </span>
            {competition.status === "draft" && (
              <Button size="sm" disabled={busy} onClick={() => setStatus("open")}>
                <PlayCircle className="h-3.5 w-3.5" /> Open for entries
              </Button>
            )}
            {competition.status === "open" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => setStatus("judging")}
              >
                <Gavel className="h-3.5 w-3.5" /> Start judging
              </Button>
            )}
            {competition.status === "judging" && (
              <span className="text-xs text-muted-foreground">
                Declare a winner from the leaderboard below.
              </span>
            )}
            {competition.status !== "archived" &&
              competition.status !== "draft" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStatus("archived")}
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
              )}
            {busy && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Winner banner */}
      {competition.status === "announced" && winnerEntry && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">
                Winner: {winnerEntry.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {users.find((u) => u.id === winnerEntry.authorId)?.name ??
                  "Unknown"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prompt + rules */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            {competition.status === "announced"
              ? "Entries closed"
              : `Entries due ${format(new Date(competition.closesAt), "EEEE, MMM d, yyyy")}`}
            {typeof competition.wordLimit === "number" && (
              <span>· {competition.wordLimit}-word limit</span>
            )}
          </div>
          {competition.prompt && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Prompt
              </p>
              <p className="text-sm mt-1 whitespace-pre-wrap">
                {competition.prompt}
              </p>
            </div>
          )}
          {competition.rules && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Rules
              </p>
              <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground">
                {competition.rules}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your entry */}
      {showEntryForm && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Your entry</h2>
          <EntryForm
            competition={competition}
            entry={myEntry}
            onSaved={refetchEntries}
          />
        </section>
      )}

      {/* Judging */}
      {showJudging && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Judge entries</h2>
          <JudgePanel
            competition={competition}
            entries={entries}
            scores={scores}
            users={users}
            onScored={refetchScores}
          />
        </section>
      )}

      {/* Leaderboard */}
      {showLeaderboard && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Leaderboard</h2>
          <Leaderboard
            entries={entries}
            scores={scores}
            users={users}
            revealAuthors={revealAuthors}
            onPickWinner={
              canManage && competition.status === "judging"
                ? announce
                : undefined
            }
            picking={picking}
          />
        </section>
      )}

      {editing && (
        <CompetitionFormDialog
          key={competition.id}
          open={editing}
          onOpenChange={setEditing}
          competition={competition}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
