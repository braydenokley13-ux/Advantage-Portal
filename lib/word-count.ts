/**
 * Word-count, reading-time, and target-progress helpers for written work.
 *
 * Dependency-free and pure so they can be unit-tested and shared by the
 * submission composer, the inline viewer, and any future analytics surface.
 */

/** Average adult silent reading speed, words per minute. */
export const WORDS_PER_MINUTE = 200;

/** Count whitespace-delimited words. Empty / whitespace-only text is 0. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/** Estimated read time in whole minutes (minimum 1 for any non-empty text). */
export function readingTimeMinutes(
  words: number,
  wpm: number = WORDS_PER_MINUTE
): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.ceil(words / wpm));
}

/** Human label like "1 min read" / "4 min read" / "—" for empty text. */
export function formatReadingTime(words: number): string {
  const minutes = readingTimeMinutes(words);
  if (minutes <= 0) return "—";
  return `${minutes} min read`;
}

export type WordCountProgress = {
  words: number;
  target: number;
  /** 0–100, clamped. */
  pct: number;
  met: boolean;
  /** Signed distance from target (negative = short, positive = over). */
  remaining: number;
};

/**
 * Progress of a draft against its word-count target, or null when the task
 * has no target. `pct` is clamped to 100 for the bar; `remaining` keeps the
 * true signed gap so callers can say "120 to go" or "45 over".
 */
export function wordCountProgress(
  words: number,
  target?: number | null
): WordCountProgress | null {
  if (!target || target <= 0) return null;
  const pct = Math.min(100, Math.max(0, Math.round((words / target) * 100)));
  return {
    words,
    target,
    pct,
    met: words >= target,
    remaining: words - target,
  };
}
