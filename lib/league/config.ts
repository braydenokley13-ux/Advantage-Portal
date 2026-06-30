/**
 * Static configuration for The Advantage Writers League.
 *
 * This file is the single place to edit who sits on the editorial board, how
 * many points each event is worth, and the shared inbox every email copies.
 * Nothing here is secret — the values are referenced by both server routes and
 * (where noted) client UI.
 */

/**
 * The shared league inbox. Every email to a writer is CC'd here, and every
 * board notification / escalation is sent here, so this mailbox always holds a
 * full paper trail of the competition.
 */
export const JOURNAL_EMAIL = "theadvantagejournal@gmail.com";

/**
 * The editorial board. New submissions are assigned an editor by rotating
 * through this list (see {@link assignEditorByRotation}); the overdue cron
 * looks an editor's email up here by name to send reminders. Edit this list to
 * change the board — the rotation and reminders pick up the change with no code
 * changes elsewhere.
 */
export type BoardMember = {
  /** Display name stored on the submission as `assigned_editor`. */
  name: string;
  /** Where overdue reminders for this editor's submissions are sent. */
  email: string;
};

export const BOARD_MEMBERS: readonly BoardMember[] = [
  { name: "Brayden Okley", email: "braydenokley13@gmail.com" },
  { name: "Editorial Board", email: JOURNAL_EMAIL },
];

/** Look up a board member's email by the name stored on a submission. */
export function boardMemberEmail(name: string): string | null {
  const match = BOARD_MEMBERS.find(
    (m) => m.name.toLowerCase() === name.trim().toLowerCase()
  );
  return match ? match.email : null;
}

/**
 * Points awarded per event. These mirror the constants baked into the database
 * triggers (migration 0020) and are used by the UI/emails for display. The
 * database remains the source of truth for the actual award.
 */
export const LEAGUE_POINTS = {
  /** A submission reaching the "published" state. */
  published: 100,
  /** Winning a weekly award (Best Argument, Best Use of Data, Editor's Pick). */
  award: 50,
  /** A piece featured on the homepage. */
  feature: 25,
} as const;

/**
 * Overdue-cron thresholds, in whole days since submission, for a piece still
 * sitting in "under review".
 */
export const OVERDUE_THRESHOLDS = {
  /** Reminder to the assigned editor. */
  editorReminder: 5,
  /** First escalation to the league inbox. */
  escalation: 7,
  /** Urgent second escalation to the league inbox. */
  urgent: 10,
} as const;
