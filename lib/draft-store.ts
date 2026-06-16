/**
 * Local autosave for the inline submission composer.
 *
 * A writer's in-progress draft is persisted to localStorage, keyed by task, so
 * an accidental reload or navigation never loses their work. It is intentionally
 * best-effort: every access is guarded for SSR and wrapped so a disabled or
 * full localStorage can never throw into the submit flow. The draft is cleared
 * the moment a submission succeeds.
 */
const DRAFT_PREFIX = "advantage:draft:submission:";

/** Stable localStorage key for a task's inline draft. */
export function submissionDraftKey(taskId: string): string {
  return `${DRAFT_PREFIX}${taskId}`;
}

/** Read a saved draft, or "" when none exists / storage is unavailable. */
export function loadSubmissionDraft(taskId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(submissionDraftKey(taskId)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Persist a draft. Saving empty / whitespace-only text removes the key instead
 * of storing a useless blank, so a cleared field doesn't resurrect on reload.
 */
export function saveSubmissionDraft(taskId: string, text: string): void {
  if (typeof window === "undefined") return;
  try {
    if (text.trim().length === 0) {
      window.localStorage.removeItem(submissionDraftKey(taskId));
    } else {
      window.localStorage.setItem(submissionDraftKey(taskId), text);
    }
  } catch {
    /* storage disabled or over quota — autosave is best-effort */
  }
}

/** Drop a task's saved draft (e.g. after a successful submit). */
export function clearSubmissionDraft(taskId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(submissionDraftKey(taskId));
  } catch {
    /* ignore */
  }
}
