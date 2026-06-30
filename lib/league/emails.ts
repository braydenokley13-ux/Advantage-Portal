/**
 * Server-side email orchestration for the Writers League.
 *
 * This module is the one place the league's mail rules live:
 *   • Every email to a writer is CC'd to the shared journal inbox, so that
 *     mailbox always holds a complete paper trail (see {@link JOURNAL_EMAIL}).
 *   • Most events also send a separate, richer notification straight to the
 *     journal inbox (running totals, full submission details, etc.).
 *
 * Delivery is best-effort: an unconfigured or failing send is logged and
 * counted but never throws, so a mail hiccup can't undo the database work an
 * API route already committed (points are handled by triggers regardless).
 * Each function returns a {@link SendResult} the caller can surface.
 */
import { JOURNAL_EMAIL } from "./config";
import { AWARD_TYPE_LABEL, type LeagueAwardType } from "./types";
import {
  emailIsConfigured,
  normalizeEmailAddress,
  sendEmail,
} from "@/lib/email/mailer";
import {
  awardSummaryEmail,
  awardWriterEmail,
  featureNotificationEmail,
  featureWriterEmail,
  overdueEditorReminderEmail,
  overdueEscalationEmail,
  publishedNotificationEmail,
  publishedWriterEmail,
  rejectionNotificationEmail,
  rejectionWriterEmail,
  submissionConfirmationEmail,
  submissionNotificationEmail,
} from "@/emails/league-templates";

export type SendResult = {
  /** Messages delivered. */
  sent: number;
  /** Messages that errored or had an invalid recipient. */
  failed: number;
  /** True when email isn't configured, so nothing was attempted. */
  skipped: boolean;
};

type Message = {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
};

/** Current standings passed into the celebratory emails. */
export type Standing = { totalPoints: number; rank: number };

/**
 * Deliver a batch of pre-built messages. Skips entirely when email isn't
 * configured; otherwise sends each one, swallowing and logging failures.
 */
async function deliver(messages: Message[]): Promise<SendResult> {
  if (!emailIsConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }
  let sent = 0;
  let failed = 0;
  for (const message of messages) {
    const to = normalizeEmailAddress(message.to);
    if (!to) {
      failed += 1;
      continue;
    }
    try {
      await sendEmail({
        to,
        cc: message.cc,
        subject: message.subject,
        html: message.html,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error("[league-email] Send failed:", err);
    }
  }
  return { sent, failed, skipped: false };
}

// ── submission received ─────────────────────────────────────────────────────
/** Confirmation to the writer (CC journal) + full notification to the journal. */
export async function emailSubmissionReceived(args: {
  writerName: string;
  writerEmail: string;
  school: string;
  grade: string;
  articleTitle: string;
  googleDocLink: string;
  assignedEditor: string;
  submittedAt: string;
}): Promise<SendResult> {
  return deliver([
    {
      to: args.writerEmail,
      cc: [JOURNAL_EMAIL],
      subject: `Your Writers League submission: “${args.articleTitle}”`,
      html: submissionConfirmationEmail({
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        assignedEditor: args.assignedEditor,
      }),
    },
    {
      to: JOURNAL_EMAIL,
      subject: `New league submission from ${args.writerName}: “${args.articleTitle}”`,
      html: submissionNotificationEmail({
        writerName: args.writerName,
        school: args.school,
        grade: args.grade,
        articleTitle: args.articleTitle,
        googleDocLink: args.googleDocLink,
        assignedEditor: args.assignedEditor,
        submittedAt: args.submittedAt,
      }),
    },
  ]);
}

// ── published ───────────────────────────────────────────────────────────────
/** Congrats to the writer (CC journal) + standings notification to the journal. */
export async function emailPublished(args: {
  writerName: string;
  writerEmail: string;
  articleTitle: string;
  standing: Standing;
}): Promise<SendResult> {
  return deliver([
    {
      to: args.writerEmail,
      cc: [JOURNAL_EMAIL],
      subject: `🎉 You're published! “${args.articleTitle}” — +100 league points`,
      html: publishedWriterEmail({
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        standing: args.standing,
      }),
    },
    {
      to: JOURNAL_EMAIL,
      subject: `Published: ${args.writerName} — “${args.articleTitle}” (now #${args.standing.rank})`,
      html: publishedNotificationEmail({
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        standing: args.standing,
      }),
    },
  ]);
}

// ── rejected ────────────────────────────────────────────────────────────────
/** Warm note to the writer (CC journal) + notification to the journal. */
export async function emailRejected(args: {
  writerName: string;
  writerEmail: string;
  articleTitle: string;
  assignedEditor: string;
  feedback?: string;
}): Promise<SendResult> {
  return deliver([
    {
      to: args.writerEmail,
      cc: [JOURNAL_EMAIL],
      subject: `A note on your Writers League submission: “${args.articleTitle}”`,
      html: rejectionWriterEmail({
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        assignedEditor: args.assignedEditor,
        feedback: args.feedback,
      }),
    },
    {
      to: JOURNAL_EMAIL,
      subject: `Rejected: ${args.writerName} — “${args.articleTitle}”`,
      html: rejectionNotificationEmail({
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        assignedEditor: args.assignedEditor,
      }),
    },
  ]);
}

// ── weekly awards ───────────────────────────────────────────────────────────
/**
 * One congratulations email per winner (CC journal) plus a single summary to
 * the journal inbox listing every winner and their new totals.
 */
export async function emailWeeklyAwards(args: {
  weekOf: string;
  winners: Array<{
    writerName: string;
    writerEmail: string;
    awardType: LeagueAwardType;
    standing: Standing;
  }>;
}): Promise<SendResult> {
  const messages: Message[] = args.winners.map((w) => ({
    to: w.writerEmail,
    cc: [JOURNAL_EMAIL],
    subject: `🏆 You won ${AWARD_TYPE_LABEL[w.awardType]}! +50 league points`,
    html: awardWriterEmail({
      writerName: w.writerName,
      awardType: w.awardType,
      standing: w.standing,
    }),
  }));

  messages.push({
    to: JOURNAL_EMAIL,
    subject: `Weekly awards — week of ${args.weekOf}`,
    html: awardSummaryEmail({
      weekOf: args.weekOf,
      winners: args.winners.map((w) => ({
        awardType: w.awardType,
        writerName: w.writerName,
        totalPoints: w.standing.totalPoints,
      })),
    }),
  });

  return deliver(messages);
}

// ── featured ────────────────────────────────────────────────────────────────
/** Congrats to the writer (CC journal) + notification to the journal. */
export async function emailFeatured(args: {
  writerName: string;
  writerEmail: string;
  articleTitle: string;
  standing: Standing;
}): Promise<SendResult> {
  return deliver([
    {
      to: args.writerEmail,
      cc: [JOURNAL_EMAIL],
      subject: `⭐ You're featured on the homepage! “${args.articleTitle}” — +25 points`,
      html: featureWriterEmail({
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        standing: args.standing,
      }),
    },
    {
      to: JOURNAL_EMAIL,
      subject: `Featured: ${args.writerName} — “${args.articleTitle}”`,
      html: featureNotificationEmail({
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        standing: args.standing,
      }),
    },
  ]);
}

// ── overdue cron emails ─────────────────────────────────────────────────────
/** Reminder to the assigned editor (CC journal for the paper trail). */
export async function emailOverdueEditorReminder(args: {
  editorName: string;
  editorEmail: string;
  writerName: string;
  articleTitle: string;
  daysWaiting: number;
  googleDocLink: string;
}): Promise<SendResult> {
  return deliver([
    {
      to: args.editorEmail,
      cc: [JOURNAL_EMAIL],
      subject: `Reminder: “${args.articleTitle}” is waiting on your review`,
      html: overdueEditorReminderEmail({
        editorName: args.editorName,
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        daysWaiting: args.daysWaiting,
        googleDocLink: args.googleDocLink,
      }),
    },
  ]);
}

/** Escalation (normal or urgent) to the journal inbox. */
export async function emailOverdueEscalation(args: {
  writerName: string;
  articleTitle: string;
  assignedEditor: string;
  daysOverdue: number;
  urgent: boolean;
}): Promise<SendResult> {
  return deliver([
    {
      to: JOURNAL_EMAIL,
      subject: `${args.urgent ? "URGENT — " : ""}Overdue: “${args.articleTitle}” (${args.daysOverdue} days)`,
      html: overdueEscalationEmail({
        writerName: args.writerName,
        articleTitle: args.articleTitle,
        assignedEditor: args.assignedEditor,
        daysOverdue: args.daysOverdue,
        urgent: args.urgent,
      }),
    },
  ]);
}
