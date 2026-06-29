"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Plus, CalendarClock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { AccessDenied, EmptyState, SkeletonCard } from "@/components/ui/states";
import { CompetitionFormDialog } from "@/components/competition/competition-form";
import { useRole } from "@/lib/role-context";
import { useSiteConfig } from "@/lib/site-config";
import { useCompetitions, useRealtimeRefetch } from "@/lib/hooks";
import { featureEnabledFor } from "@/lib/site-config-defaults";
import { canManageCompetitions } from "@/lib/permissions";
import {
  competitionStatusLabel,
  competitionStatusTone,
} from "@/lib/competition";
import { format } from "date-fns";
import type { CompetitionStatus } from "@/lib/types";
import type { CompetitionZ } from "@/lib/contracts";

const ORDER: Record<CompetitionStatus, number> = {
  open: 0,
  judging: 1,
  announced: 2,
  draft: 3,
  archived: 4,
};

const EMPTY: CompetitionZ[] = [];

export default function CompetitionsPage() {
  const { role } = useRole();
  const { config } = useSiteConfig();
  const { data, loading, refetch } = useCompetitions();
  const [creating, setCreating] = useState(false);

  useRealtimeRefetch(["competitions"], refetch);

  const competitions = useMemo(
    () => [...(data ?? EMPTY)].sort((a, b) => ORDER[a.status] - ORDER[b.status]),
    [data]
  );

  if (!featureEnabledFor(config, "competitions", role)) {
    return (
      <AccessDenied
        title="Competitions are turned off"
        description="An admin can re-enable essay competitions in Settings."
      />
    );
  }

  const canManage = canManageCompetitions(role);

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Essay competitions"
        description="Enter open competitions, follow the judging, and see who takes the prize."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New competition
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : competitions.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Trophy}
              title="No competitions yet"
              description={
                canManage
                  ? "Create the first essay competition to get the team writing."
                  : "Check back soon — competitions will show up here when they open."
              }
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> New competition
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((c) => (
            <Link key={c.id} href={`/competitions/${c.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-elevated">
                <CardContent className="p-5 flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-soft">
                      <Trophy className="h-4 w-4" />
                    </div>
                    <Badge variant={competitionStatusTone(c.status)}>
                      {competitionStatusLabel(c.status)}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold leading-tight">{c.title}</p>
                    {c.prompt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {c.prompt}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {c.status === "announced"
                        ? "Closed"
                        : `Due ${format(new Date(c.closesAt), "MMM d")}`}
                    </span>
                    <span className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <CompetitionFormDialog
          key="new"
          open={creating}
          onOpenChange={setCreating}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
