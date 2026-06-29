"use client";

import { Trophy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  computeLeaderboard,
  entryStatusLabel,
  RUBRIC_MAX,
} from "@/lib/competition";
import { cn } from "@/lib/utils";
import type {
  CompetitionEntryZ,
  CompetitionScoreZ,
  UserZ,
} from "@/lib/contracts";

const MEDAL = ["🥇", "🥈", "🥉"];

export function Leaderboard({
  entries,
  scores,
  users,
  revealAuthors,
  onPickWinner,
  picking,
}: {
  entries: CompetitionEntryZ[];
  scores: CompetitionScoreZ[];
  users: UserZ[];
  revealAuthors: boolean;
  /** Managers only — declare this entry the winner. */
  onPickWinner?: (entryId: string) => void;
  /** entryId currently being announced (shows a spinner). */
  picking?: string | null;
}) {
  const rows = computeLeaderboard(entries, scores);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No entries yet"
        description="Scores and rankings appear here as entries come in and judges weigh in."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 w-12 font-medium">#</th>
            <th className="text-left px-3 py-2 font-medium">Entry</th>
            <th className="text-left px-3 py-2 font-medium">Avg score</th>
            <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">
              Judges
            </th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            {onPickWinner && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const author = users.find((u) => u.id === row.entry.authorId);
            const isWinner = row.entry.status === "winner";
            return (
              <tr
                key={row.entry.id}
                className={cn(isWinner && "bg-amber-50/60")}
              >
                <td className="px-3 py-3 font-medium">
                  {MEDAL[row.rank - 1] ?? row.rank}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium line-clamp-1">{row.entry.title}</p>
                  {revealAuthors && (
                    <p className="text-[11px] text-muted-foreground">
                      {author?.name ?? "Unknown"}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {row.judgeCount > 0
                    ? `${row.averageScore.toFixed(1)} / ${RUBRIC_MAX}`
                    : "—"}
                </td>
                <td className="px-3 py-3 hidden sm:table-cell text-muted-foreground">
                  {row.judgeCount}
                </td>
                <td className="px-3 py-3">
                  <Badge variant={isWinner ? "success" : "secondary"}>
                    {entryStatusLabel(row.entry.status)}
                  </Badge>
                </td>
                {onPickWinner && (
                  <td className="px-3 py-3 text-right">
                    {!isWinner && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!picking}
                        onClick={() => onPickWinner(row.entry.id)}
                      >
                        {picking === row.entry.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Declare winner"
                        )}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
