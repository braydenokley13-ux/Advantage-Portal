import { describe, expect, it } from "vitest";
import {
  countWords,
  formatReadingTime,
  readingTimeMinutes,
  wordCountProgress,
} from "./word-count";

describe("countWords", () => {
  it("counts whitespace-delimited words", () => {
    expect(countWords("the quick brown fox")).toBe(4);
  });

  it("collapses irregular whitespace and newlines", () => {
    expect(countWords("  a\n\nb   c\t d  ")).toBe(4);
  });

  it("is zero for empty or whitespace-only text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t ")).toBe(0);
  });
});

describe("readingTimeMinutes", () => {
  it("rounds up to whole minutes", () => {
    expect(readingTimeMinutes(200)).toBe(1);
    expect(readingTimeMinutes(201)).toBe(2);
    expect(readingTimeMinutes(450)).toBe(3);
  });

  it("returns at least 1 minute for any non-empty content", () => {
    expect(readingTimeMinutes(1)).toBe(1);
  });

  it("returns 0 for no words", () => {
    expect(readingTimeMinutes(0)).toBe(0);
  });
});

describe("formatReadingTime", () => {
  it("labels minutes and an em-dash for empty", () => {
    expect(formatReadingTime(0)).toBe("—");
    expect(formatReadingTime(50)).toBe("1 min read");
    expect(formatReadingTime(500)).toBe("3 min read");
  });
});

describe("wordCountProgress", () => {
  it("returns null when there is no target", () => {
    expect(wordCountProgress(100)).toBeNull();
    expect(wordCountProgress(100, 0)).toBeNull();
    expect(wordCountProgress(100, null)).toBeNull();
  });

  it("computes a clamped percentage and signed remaining", () => {
    expect(wordCountProgress(250, 1000)).toEqual({
      words: 250,
      target: 1000,
      pct: 25,
      met: false,
      remaining: -750,
    });
  });

  it("clamps pct at 100 and flags met when over target", () => {
    const p = wordCountProgress(1200, 1000);
    expect(p?.pct).toBe(100);
    expect(p?.met).toBe(true);
    expect(p?.remaining).toBe(200);
  });

  it("treats hitting the target exactly as met", () => {
    const p = wordCountProgress(1000, 1000);
    expect(p?.met).toBe(true);
    expect(p?.remaining).toBe(0);
  });
});
