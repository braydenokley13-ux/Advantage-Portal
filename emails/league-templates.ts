// Branded HTML email templates for The Advantage Writers League.
//
// Every function returns a complete, self-contained HTML document safe to send
// as an email body. The visual language matches the portal's auth emails
// (table-based layout, purple brand gradient) with a gold accent reserved for
// points and awards so league mail feels celebratory and on-brand.
//
// These are pure string builders — no side effects, no client/runtime deps —
// so they can be imported from any server route. All caller-supplied values
// are HTML-escaped; only trusted, code-built markup is interpolated raw.

import {
  AWARD_MEANING,
  AWARD_TYPE_LABEL,
  type LeagueAwardType,
} from "@/lib/league/types";

// ── brand tokens ──────────────────────────────────────────────────────────
const BRAND_BG = "linear-gradient(135deg,#5b5bd6 0%,#7e7af0 100%)";
const BRAND_COLOR = "#5b5bd6";
const GOLD = "#b8860b";
const GOLD_BG = "#fdf6e3";
const INK = "#111827";
const MUTED = "#6b7280";

// ── escaping ────────────────────────────────────────────────────────────────
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

// ── shell ───────────────────────────────────────────────────────────────────
/**
 * Wrap a body fragment in the branded Advantage Journal · Writers League
 * shell: a logo + wordmark header, a white content card, and a paper-trail
 * footer. `preheader` is the hidden inbox-preview line.
 */
function shell(body: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- logo + wordmark -->
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:${BRAND_BG};border-radius:12px;width:48px;height:48px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-size:24px;font-weight:800;line-height:48px;display:block;">A</span>
            </td>
          </tr></table>
          <div style="margin-top:10px;font-size:17px;font-weight:700;color:${INK};letter-spacing:-0.3px;">The Advantage Journal</div>
          <div style="margin-top:2px;font-size:12px;font-weight:600;color:${BRAND_COLOR};text-transform:uppercase;letter-spacing:0.14em;">Writers League</div>
        </td></tr>

        <!-- card -->
        <tr><td style="background:#ffffff;border-radius:14px;padding:36px 40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          ${body}
        </td></tr>

        <!-- footer -->
        <tr><td align="center" style="padding-top:20px;">
          <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
            The Advantage Writers League · A season-long celebration of student journalism.<br/>
            A copy of this message is kept by the editorial board for the league record.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── building blocks ─────────────────────────────────────────────────────────
function heading(text: string): string {
  return `<h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:${INK};line-height:1.3;">${escapeHtml(
    text
  )}</h1>`;
}

function greeting(name: string): string {
  return `<p style="color:${INK};font-size:15px;margin:0 0 16px;">Hi ${escapeHtml(
    name
  )},</p>`;
}

function paragraph(text: string): string {
  return `<p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">${text}</p>`;
}

function signoff(): string {
  return `<p style="color:#374151;font-size:14px;line-height:1.7;margin:24px 0 0;">
    Keep writing,<br/>
    <strong style="color:${INK};">The Advantage Journal editorial board</strong>
  </p>`;
}

/** A gold "points" pill, e.g. +100 points. */
function pointsPill(points: number): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;"><tr>
    <td style="background:${GOLD_BG};border:1px solid #f0e0b6;border-radius:999px;padding:8px 20px;">
      <span style="color:${GOLD};font-size:15px;font-weight:800;letter-spacing:0.02em;">+${points} points</span>
    </td>
  </tr></table>`;
}

/** A standings callout: running total + current rank. */
function standings(totalPoints: number, rank: number): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr>
      <td width="50%" style="background:${GOLD_BG};border:1px solid #f0e0b6;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:${GOLD};line-height:1;">${totalPoints}</div>
        <div style="font-size:11px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Total points</div>
      </td>
      <td style="width:12px;"></td>
      <td width="50%" style="background:#f5f3ff;border:1px solid #e5e0fb;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:${BRAND_COLOR};line-height:1;">#${rank}</div>
        <div style="font-size:11px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Leaderboard rank</div>
      </td>
    </tr>
  </table>`;
}

/** A bordered key/value detail table. Values are escaped; links are rendered. */
function detailTable(rows: Array<{ label: string; value: string }>): string {
  const body = rows
    .map(
      (r, i) => `<tr>
        <td style="padding:11px 14px;border-top:${
          i === 0 ? "none" : "1px solid #eef0f3"
        };font-size:12px;color:${MUTED};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:38%;vertical-align:top;">${escapeHtml(
          r.label
        )}</td>
        <td style="padding:11px 14px;border-top:${
          i === 0 ? "none" : "1px solid #eef0f3"
        };font-size:14px;color:${INK};">${r.value}</td>
      </tr>`
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #eef0f3;border-radius:10px;border-collapse:separate;overflow:hidden;">${body}</table>`;
}

/** A tinted callout box (e.g. an editor's feedback note). */
function callout(title: string, body: string, tone: "info" | "warn" = "info"): string {
  const bg = tone === "warn" ? "#fef2f2" : "#f5f3ff";
  const border = tone === "warn" ? "#fecaca" : "#e5e0fb";
  const color = tone === "warn" ? "#b91c1c" : BRAND_COLOR;
  return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:16px 18px;margin:0 0 20px;">
    <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">${escapeHtml(
      title
    )}</div>
    <div style="font-size:14px;color:#374151;line-height:1.6;">${body}</div>
  </div>`;
}

function safeLink(url: string): string {
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" style="color:${BRAND_COLOR};word-break:break-all;">${escapeHtml(
    url
  )}</a>`;
}

// ── shared prop types ───────────────────────────────────────────────────────
type Standing = { totalPoints: number; rank: number };

// ═════════════════════════════════════════════════════════════════════════════
// Submission flow
// ═════════════════════════════════════════════════════════════════════════════

/** To the writer: confirms a submission was received and routed to an editor. */
export function submissionConfirmationEmail(props: {
  writerName: string;
  articleTitle: string;
  assignedEditor: string;
}): string {
  return shell(
    `${heading("Your submission is in! 🎉")}
     ${greeting(props.writerName)}
     ${paragraph(
       `Thanks for submitting <strong style="color:${INK};">${escapeHtml(
         props.articleTitle
       )}</strong> to the Advantage Writers League. It's now in the review queue.`
     )}
     ${detailTable([
       { label: "Article", value: escapeHtml(props.articleTitle) },
       { label: "Assigned editor", value: escapeHtml(props.assignedEditor) },
       { label: "Status", value: "Under review" },
     ])}
     ${paragraph(
       `<strong style="color:${INK};">What happens next:</strong> ${escapeHtml(
         props.assignedEditor
       )} will read your piece and decide whether it's ready to publish. If it's published, you'll earn <strong style="color:${GOLD};">100 league points</strong> and go live on the leaderboard. If it needs work, you'll get warm, specific feedback so you can try again — every writer's first published piece activates them in the league.`
     )}
     ${paragraph(
       "We'll email you the moment there's a decision. Good luck!"
     )}
     ${signoff()}`,
    `We received "${props.articleTitle}" — it's under review with ${props.assignedEditor}.`
  );
}

/** To the journal inbox: a new submission landed; full routing details. */
export function submissionNotificationEmail(props: {
  writerName: string;
  school: string;
  grade: string;
  articleTitle: string;
  googleDocLink: string;
  assignedEditor: string;
  submittedAt: string;
}): string {
  return shell(
    `${heading("New league submission")}
     ${paragraph(
       `A new piece was submitted to the Writers League and assigned for review.`
     )}
     ${detailTable([
       { label: "Writer", value: escapeHtml(props.writerName) },
       { label: "School", value: escapeHtml(props.school || "—") },
       { label: "Grade", value: escapeHtml(props.grade || "—") },
       { label: "Article", value: escapeHtml(props.articleTitle) },
       { label: "Google Doc", value: safeLink(props.googleDocLink) },
       { label: "Assigned editor", value: escapeHtml(props.assignedEditor) },
       { label: "Submitted", value: escapeHtml(props.submittedAt) },
     ])}
     ${paragraph(
       `Open the league admin to move this through review when the editor has read it.`
     )}`,
    `${props.writerName} submitted "${props.articleTitle}" — assigned to ${props.assignedEditor}.`
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Published
// ═════════════════════════════════════════════════════════════════════════════

/** To the writer: their piece was published — celebratory, with standings. */
export function publishedWriterEmail(props: {
  writerName: string;
  articleTitle: string;
  standing: Standing;
}): string {
  return shell(
    `${heading("You're published! 🎉")}
     ${greeting(props.writerName)}
     ${pointsPill(100)}
     ${paragraph(
       `Congratulations — <strong style="color:${INK};">${escapeHtml(
         props.articleTitle
       )}</strong> has been <strong style="color:${INK};">published</strong> in The Advantage Journal. That's <strong style="color:${GOLD};">100 league points</strong> added to your season total.`
     )}
     ${standings(props.standing.totalPoints, props.standing.rank)}
     ${paragraph(
       `Your work is now live on the public leaderboard for everyone to see. This is exactly the kind of journalism the league exists to spotlight — thank you for it.`
     )}
     ${signoff()}`,
    `"${props.articleTitle}" is published — +100 points. You're #${props.standing.rank} on the leaderboard.`
  );
}

/** To the journal inbox: a writer was just published, with their standings. */
export function publishedNotificationEmail(props: {
  writerName: string;
  articleTitle: string;
  standing: Standing;
}): string {
  return shell(
    `${heading("A writer was just published")}
     ${paragraph(
       `<strong style="color:${INK};">${escapeHtml(
         props.writerName
       )}</strong> was just published for <strong style="color:${INK};">${escapeHtml(
         props.articleTitle
       )}</strong> and awarded 100 points.`
     )}
     ${standings(props.standing.totalPoints, props.standing.rank)}
     ${paragraph(
       `Their running total is now <strong>${props.standing.totalPoints}</strong> points, currently <strong>#${props.standing.rank}</strong> on the league leaderboard.`
     )}`,
    `${props.writerName} published — now ${props.standing.totalPoints} pts, #${props.standing.rank}.`
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Rejected
// ═════════════════════════════════════════════════════════════════════════════

/** To the writer: a warm, encouraging rejection that includes editor feedback. */
export function rejectionWriterEmail(props: {
  writerName: string;
  articleTitle: string;
  assignedEditor: string;
  feedback?: string;
}): string {
  const feedbackBlock = props.feedback?.trim()
    ? callout(
        `Feedback from ${props.assignedEditor}`,
        escapeHtml(props.feedback.trim()).replace(/\n/g, "<br/>")
      )
    : "";
  return shell(
    `${heading("A note on your submission")}
     ${greeting(props.writerName)}
     ${paragraph(
       `Thank you for submitting <strong style="color:${INK};">${escapeHtml(
         props.articleTitle
       )}</strong> to the Writers League. After a careful read, ${escapeHtml(
         props.assignedEditor
       )} has decided this piece isn't quite ready to publish yet — but please don't let that discourage you.`
     )}
     ${feedbackBlock}
     ${paragraph(
       `Every strong journalist has had pieces sent back; revision is where the best writing actually happens. We'd genuinely love to see this idea again — polished, sharpened, and resubmitted. Your spot in the league is waiting.`
     )}
     ${signoff()}`,
    `A warm note about "${props.articleTitle}" — and an invitation to revise and resubmit.`
  );
}

/** To the journal inbox: a submission was rejected. */
export function rejectionNotificationEmail(props: {
  writerName: string;
  articleTitle: string;
  assignedEditor: string;
}): string {
  return shell(
    `${heading("Submission rejected")}
     ${paragraph(
       `<strong style="color:${INK};">${escapeHtml(
         props.writerName
       )}</strong>'s piece <strong style="color:${INK};">${escapeHtml(
         props.articleTitle
       )}</strong> was rejected by ${escapeHtml(
         props.assignedEditor
       )}. The writer has been sent an encouraging note inviting a resubmission.`
     )}`,
    `${props.writerName}'s "${props.articleTitle}" was rejected by ${props.assignedEditor}.`
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Weekly awards
// ═════════════════════════════════════════════════════════════════════════════

/** To the winning writer: which award they won and what it means for ranking. */
export function awardWriterEmail(props: {
  writerName: string;
  awardType: LeagueAwardType;
  standing: Standing;
}): string {
  const label = AWARD_TYPE_LABEL[props.awardType];
  const meaning = AWARD_MEANING[props.awardType];
  return shell(
    `${heading(`You won ${label}! 🏆`)}
     ${greeting(props.writerName)}
     ${pointsPill(50)}
     ${paragraph(
       `This week's <strong style="color:${INK};">${escapeHtml(
         label
       )}</strong> goes to you. It's ${escapeHtml(
         meaning
       )}, and it adds <strong style="color:${GOLD};">50 league points</strong> to your season total.`
     )}
     ${standings(props.standing.totalPoints, props.standing.rank)}
     ${paragraph(
       `Awards like this are how writers climb the leaderboard between published pieces — you're now sitting at <strong>#${props.standing.rank}</strong>. Beautifully done.`
     )}
     ${signoff()}`,
    `You won ${label} — +50 points, now #${props.standing.rank} on the leaderboard.`
  );
}

/** To the journal inbox: the full weekly awards summary with all winners. */
export function awardSummaryEmail(props: {
  weekOf: string;
  winners: Array<{
    awardType: LeagueAwardType;
    writerName: string;
    totalPoints: number;
  }>;
}): string {
  const rows = props.winners
    .map((w) => ({
      label: AWARD_TYPE_LABEL[w.awardType],
      value: `${escapeHtml(w.writerName)} — <strong style="color:${GOLD};">${w.totalPoints}</strong> pts`,
    }))
    .map((r) => ({ label: r.label, value: r.value }));

  return shell(
    `${heading("Weekly awards summary")}
     ${paragraph(
       `The weekly awards for the week of <strong style="color:${INK};">${escapeHtml(
         props.weekOf
       )}</strong> have been recorded. Each winner earned 50 points; their new season totals are below.`
     )}
     ${
       rows.length > 0
         ? detailTable(rows)
         : paragraph("No awards were recorded for this week.")
     }`,
    `Weekly awards recorded for ${props.weekOf} — ${props.winners.length} winner(s).`
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Featured on homepage
// ═════════════════════════════════════════════════════════════════════════════

/** To the writer: their piece was featured on the homepage. */
export function featureWriterEmail(props: {
  writerName: string;
  articleTitle: string;
  standing: Standing;
}): string {
  return shell(
    `${heading("You're featured on the homepage! ⭐")}
     ${greeting(props.writerName)}
     ${pointsPill(25)}
     ${paragraph(
       `Your piece <strong style="color:${INK};">${escapeHtml(
         props.articleTitle
       )}</strong> has been featured on The Advantage Journal homepage — front and center for every reader. That's <strong style="color:${GOLD};">25 league points</strong> for you.`
     )}
     ${standings(props.standing.totalPoints, props.standing.rank)}
     ${paragraph(
       `Being chosen for the homepage means the board sees your work as some of the best we're publishing. Congratulations.`
     )}
     ${signoff()}`,
    `"${props.articleTitle}" is featured on the homepage — +25 points.`
  );
}

/** To the journal inbox: a piece was featured. */
export function featureNotificationEmail(props: {
  writerName: string;
  articleTitle: string;
  standing: Standing;
}): string {
  return shell(
    `${heading("A piece was featured on the homepage")}
     ${paragraph(
       `<strong style="color:${INK};">${escapeHtml(
         props.writerName
       )}</strong>'s piece <strong style="color:${INK};">${escapeHtml(
         props.articleTitle
       )}</strong> was featured on the homepage and awarded 25 points.`
     )}
     ${standings(props.standing.totalPoints, props.standing.rank)}`,
    `${props.writerName}'s "${props.articleTitle}" was featured — +25 points.`
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Overdue system
// ═════════════════════════════════════════════════════════════════════════════

/** To the assigned editor: a piece has been waiting on their review. */
export function overdueEditorReminderEmail(props: {
  editorName: string;
  writerName: string;
  articleTitle: string;
  daysWaiting: number;
  googleDocLink: string;
}): string {
  return shell(
    `${heading("A submission is waiting on you")}
     ${greeting(props.editorName)}
     ${paragraph(
       `Just a friendly nudge — a league submission assigned to you has been under review for <strong style="color:${INK};">${props.daysWaiting} days</strong>. The writer is waiting to hear back.`
     )}
     ${detailTable([
       { label: "Writer", value: escapeHtml(props.writerName) },
       { label: "Article", value: escapeHtml(props.articleTitle) },
       { label: "Days waiting", value: String(props.daysWaiting) },
       { label: "Google Doc", value: safeLink(props.googleDocLink) },
     ])}
     ${paragraph(
       `When you've read it, set the status in the league admin to publish, approve, or send it back with feedback. Thanks for keeping the queue moving!`
     )}`,
    `Reminder: "${props.articleTitle}" has been waiting ${props.daysWaiting} days for your review.`
  );
}

/** To the journal inbox: a submission is overdue (or urgently overdue). */
export function overdueEscalationEmail(props: {
  writerName: string;
  articleTitle: string;
  assignedEditor: string;
  daysOverdue: number;
  urgent: boolean;
}): string {
  const title = props.urgent
    ? "Urgent: submission overdue 10+ days"
    : "Submission overdue";
  return shell(
    `${heading(title)}
     ${
       props.urgent
         ? callout(
             "Action needed",
             `This piece has sat in review for <strong>${props.daysOverdue} days</strong> with no decision. It needs a board member to step in.`,
             "warn"
           )
         : paragraph(
             `A league submission has been under review longer than expected and may need attention.`
           )
     }
     ${detailTable([
       { label: "Writer", value: escapeHtml(props.writerName) },
       { label: "Article", value: escapeHtml(props.articleTitle) },
       { label: "Assigned editor", value: escapeHtml(props.assignedEditor) },
       { label: "Days overdue", value: String(props.daysOverdue) },
     ])}
     ${paragraph(
       `Reassign or review this piece from the league admin so the writer gets a timely decision.`
     )}`,
    `${props.urgent ? "URGENT — " : ""}"${props.articleTitle}" is ${props.daysOverdue} days overdue (editor: ${props.assignedEditor}).`
  );
}
