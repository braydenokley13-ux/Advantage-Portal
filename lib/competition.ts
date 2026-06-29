/**
 * Essay-competition domain helpers — judging rubric, leaderboard math, and
 * status display. Framework-agnostic so pages, components, and tests can share
 * it. Entries are scored against a fixed three-criterion rubric (each 1–5); an
 * entry's standing is the average of its judges' totals.
 */
import type {
  Competition,
  CompetitionEntry,
  CompetitionScore,
  CompetitionStatus,
  EntryStatus,
} from "./types";

export const COMPETITION_RUBRIC = [
  { key: "originality", label: "Originality", max: 5 },
  { key: "writing", label: "Writing & style", max: 5 },
  { key: "argument", label: "Argument & evidence", max: 5 },
] as const;

export const RUBRIC_MAX = COMPETITION_RUBRIC.reduce((sum, c) => sum + c.max, 0);

/** Sum a rubric map into a single total, ignoring unknown keys. */
export function rubricTotal(rubric: Record<string, number> | undefined): number {
  if (!rubric) return 0;
  return COMPETITION_RUBRIC.reduce((sum, c) => sum + (rubric[c.key] ?? 0), 0);
}

export type LeaderboardRow = {
  entry: CompetitionEntry;
  /** Average total score across the judges who scored this entry. */
  averageScore: number;
  judgeCount: number;
  rank: number;
};

/** Rank non-withdrawn entries by average judge score (desc), then judge count. */
export function computeLeaderboard(
  entries: CompetitionEntry[],
  scores: CompetitionScore[]
): LeaderboardRow[] {
  const byEntry = new Map<string, CompetitionScore[]>();
  for (const s of scores) {
    const arr = byEntry.get(s.entryId) ?? [];
    arr.push(s);
    byEntry.set(s.entryId, arr);
  }
  return entries
    .filter((e) => e.status !== "withdrawn")
    .map((entry) => {
      const es = byEntry.get(entry.id) ?? [];
      const judgeCount = es.length;
      const averageScore =
        judgeCount > 0
          ? es.reduce((sum, s) => sum + s.score, 0) / judgeCount
          : 0;
      return { entry, averageScore, judgeCount };
    })
    .sort(
      (a, b) =>
        b.averageScore - a.averageScore || b.judgeCount - a.judgeCount
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

const STATUS_LABEL: Record<CompetitionStatus, string> = {
  draft: "Draft",
  open: "Open for entries",
  judging: "Judging",
  announced: "Winner announced",
  archived: "Archived",
};

export function competitionStatusLabel(status: CompetitionStatus): string {
  return STATUS_LABEL[status];
}

const STATUS_TONE: Record<
  CompetitionStatus,
  "default" | "secondary" | "warning" | "success"
> = {
  draft: "secondary",
  open: "success",
  judging: "warning",
  announced: "default",
  archived: "secondary",
};

export function competitionStatusTone(status: CompetitionStatus) {
  return STATUS_TONE[status];
}

const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  winner: "Winner",
  not_selected: "Not selected",
  withdrawn: "Withdrawn",
};

export function entryStatusLabel(status: EntryStatus): string {
  return ENTRY_STATUS_LABEL[status];
}

/** True while a competition is open and the entry deadline hasn't passed. */
export function isOpenForEntries(competition: {
  status: CompetitionStatus;
  closesAt: string;
}): boolean {
  return (
    competition.status === "open" &&
    new Date(competition.closesAt).getTime() > Date.now()
  );
}

/** Whether author identity should be hidden from judges right now. */
export function judgingIsBlind(competition: Competition): boolean {
  return competition.anonymizedJudging && competition.status !== "announced";
}
