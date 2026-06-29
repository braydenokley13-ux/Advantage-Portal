/**
 * Pure scanner for the overdue-submission cron.
 *
 * Given the submissions still sitting in "under review" and the current time,
 * it returns exactly the reminder/escalation actions that should fire now —
 * already de-duplicated so the same nudge never goes out twice in one day. The
 * cron route (app/api/cron/league-overdue) is a thin shell around this: it
 * loads rows, calls {@link scanOverdueSubmissions}, sends an email per action,
 * and stamps the matching `*_sent_at` column.
 *
 * Tiers (mirroring OVERDUE_THRESHOLDS):
 *   • reminder  — > 5 days → the assigned editor (they can still act)
 *   • escalation — > 7 and < 10 days → the league inbox
 *   • urgent    — ≥ 10 days → the league inbox, marked urgent
 *
 * The two inbox tiers are mutually exclusive (urgent supersedes escalation) so
 * the league inbox never receives two escalation emails for one piece on the
 * same day. The editor reminder is independent — a different recipient — and
 * keeps nudging daily until the review is done.
 */
import { OVERDUE_THRESHOLDS } from "./config";

export type OverdueTier = "reminder" | "escalation" | "urgent";

/** Minimal submission shape the scanner needs (snake_case from Supabase). */
export interface OverdueSubmissionInput {
  id: string;
  article_title: string;
  assigned_editor: string;
  submission_date: string;
  reminder_sent_at: string | null;
  escalation_sent_at: string | null;
  urgent_escalation_sent_at: string | null;
  /** Writer's display name, joined in by the cron for email copy. */
  writer_name: string;
}

export interface OverdueAction {
  submissionId: string;
  tier: OverdueTier;
  /** Whole days elapsed since submission, for "X days overdue" copy. */
  daysOverdue: number;
  articleTitle: string;
  assignedEditor: string;
  writerName: string;
  /** Which timestamp column the cron should stamp after a successful send. */
  sentColumn:
    | "reminder_sent_at"
    | "escalation_sent_at"
    | "urgent_escalation_sent_at";
}

const DAY_MS = 86_400_000;

/** Fractional days elapsed since a submission timestamp. */
export function daysSinceSubmission(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

/** True when an ISO timestamp falls on the same UTC calendar day as `now`. */
function sentToday(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const a = new Date(iso);
  return (
    a.getUTCFullYear() === now.getUTCFullYear() &&
    a.getUTCMonth() === now.getUTCMonth() &&
    a.getUTCDate() === now.getUTCDate()
  );
}

/**
 * Compute the overdue actions to fire for a batch of under-review submissions.
 * Pure: pass `now` to make it deterministic in tests.
 */
export function scanOverdueSubmissions(
  submissions: OverdueSubmissionInput[],
  now: Date = new Date()
): OverdueAction[] {
  const actions: OverdueAction[] = [];

  for (const s of submissions) {
    const elapsed = daysSinceSubmission(s.submission_date, now);
    const daysOverdue = Math.floor(elapsed);

    const base = {
      submissionId: s.id,
      daysOverdue,
      articleTitle: s.article_title,
      assignedEditor: s.assigned_editor,
      writerName: s.writer_name,
    };

    // Editor reminder — independent recipient, fires daily past 5 days.
    if (
      elapsed > OVERDUE_THRESHOLDS.editorReminder &&
      !sentToday(s.reminder_sent_at, now)
    ) {
      actions.push({ ...base, tier: "reminder", sentColumn: "reminder_sent_at" });
    }

    // League-inbox escalation — urgent supersedes the normal escalation so the
    // inbox only ever gets one of the two per piece per day.
    if (elapsed >= OVERDUE_THRESHOLDS.urgent) {
      if (!sentToday(s.urgent_escalation_sent_at, now)) {
        actions.push({
          ...base,
          tier: "urgent",
          sentColumn: "urgent_escalation_sent_at",
        });
      }
    } else if (elapsed > OVERDUE_THRESHOLDS.escalation) {
      if (!sentToday(s.escalation_sent_at, now)) {
        actions.push({
          ...base,
          tier: "escalation",
          sentColumn: "escalation_sent_at",
        });
      }
    }
  }

  return actions;
}
