import { describe, expect, it } from "vitest";
import {
  computeLeaderboard,
  rubricTotal,
  RUBRIC_MAX,
  isOpenForEntries,
  judgingIsBlind,
} from "./competition";
import type {
  Competition,
  CompetitionEntry,
  CompetitionScore,
} from "./types";

function entry(id: string, authorId: string, over: Partial<CompetitionEntry> = {}): CompetitionEntry {
  return {
    id,
    competitionId: "c1",
    authorId,
    title: `Entry ${id}`,
    type: "inline",
    content: "…",
    status: "submitted",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function score(entryId: string, judgeId: string, total: number): CompetitionScore {
  return {
    id: `${entryId}-${judgeId}`,
    entryId,
    judgeId,
    score: total,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("rubricTotal", () => {
  it("sums known rubric keys and ignores unknown ones", () => {
    expect(
      rubricTotal({ originality: 5, writing: 4, argument: 3, bogus: 9 })
    ).toBe(12);
  });
  it("treats missing keys as zero", () => {
    expect(rubricTotal({ originality: 2 })).toBe(2);
    expect(rubricTotal(undefined)).toBe(0);
  });
  it("RUBRIC_MAX reflects the three 1-5 criteria", () => {
    expect(RUBRIC_MAX).toBe(15);
  });
});

describe("computeLeaderboard", () => {
  it("ranks entries by average judge score, descending", () => {
    const entries = [entry("a", "u1"), entry("b", "u2"), entry("c", "u3")];
    const scores = [
      score("a", "j1", 10),
      score("a", "j2", 12), // avg 11
      score("b", "j1", 14), // avg 14
      // c has no scores → avg 0
    ];
    const board = computeLeaderboard(entries, scores);
    expect(board.map((r) => r.entry.id)).toEqual(["b", "a", "c"]);
    expect(board[0].averageScore).toBe(14);
    expect(board[1].averageScore).toBe(11);
    expect(board[1].judgeCount).toBe(2);
    expect(board[0].rank).toBe(1);
  });

  it("excludes withdrawn entries", () => {
    const entries = [entry("a", "u1"), entry("b", "u2", { status: "withdrawn" })];
    const board = computeLeaderboard(entries, [score("b", "j1", 15)]);
    expect(board.map((r) => r.entry.id)).toEqual(["a"]);
  });
});

describe("isOpenForEntries / judgingIsBlind", () => {
  const base: Competition = {
    id: "c1",
    title: "Prize",
    prompt: "",
    description: "",
    rules: "",
    opensAt: "2026-01-01T00:00:00.000Z",
    closesAt: "2999-01-01T00:00:00.000Z",
    status: "open",
    anonymizedJudging: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("is open only when status=open and the deadline is in the future", () => {
    expect(isOpenForEntries(base)).toBe(true);
    expect(isOpenForEntries({ ...base, status: "judging" })).toBe(false);
    expect(
      isOpenForEntries({ ...base, closesAt: "2000-01-01T00:00:00.000Z" })
    ).toBe(false);
  });

  it("blinds judging until the winner is announced", () => {
    expect(judgingIsBlind(base)).toBe(true);
    expect(judgingIsBlind({ ...base, status: "announced" })).toBe(false);
    expect(judgingIsBlind({ ...base, anonymizedJudging: false })).toBe(false);
  });
});
