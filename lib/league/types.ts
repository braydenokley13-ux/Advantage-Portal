/**
 * TypeScript models for The Advantage Writers League.
 *
 * The application layer uses camelCase; Postgres uses snake_case. Each model
 * has a matching `*Row` type (the raw Supabase row) and a `map*` helper that
 * translates a row into the app model, mirroring the convention used by
 * `lib/api/supabase-adapter.ts`.
 */

// ── unions (mirror the Postgres enums in migration 0020) ────────────────────
export type LeagueSubmissionStatus =
  | "under_review"
  | "approved"
  | "rejected"
  | "published";

export type LeaguePointEventType = "published" | "award" | "feature";

export type LeagueAwardType =
  | "best_argument"
  | "best_use_of_data"
  | "editors_pick";

// ── app models ──────────────────────────────────────────────────────────────
export interface Writer {
  id: string;
  name: string;
  email: string;
  school: string;
  grade: string;
  signupDate: string;
  isActive: boolean;
}

export interface LeagueSubmission {
  id: string;
  writerId: string;
  articleTitle: string;
  googleDocLink: string;
  submissionDate: string;
  assignedEditor: string;
  status: LeagueSubmissionStatus;
  reviewedDate?: string;
  editorFeedback?: string;
  featuredAt?: string;
  reminderSentAt?: string;
  escalationSentAt?: string;
  urgentEscalationSentAt?: string;
  seasonId?: string;
}

export interface LeaguePoints {
  writerId: string;
  totalPoints: number;
  publishedCount: number;
  awardCount: number;
  featureCount: number;
}

export interface PointEvent {
  id: string;
  writerId: string;
  eventType: LeaguePointEventType;
  pointsAwarded: number;
  createdAt: string;
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface WeeklyAward {
  id: string;
  writerId: string;
  awardType: LeagueAwardType;
  weekOf: string;
  pointsAwarded: number;
}

/** One row of the public `league_leaderboard` view. */
export interface LeaderboardRow {
  writerId: string;
  name: string;
  school: string;
  totalPoints: number;
  publishedCount: number;
  awardCount: number;
  rank: number;
}

// ── human-readable labels ───────────────────────────────────────────────────
export const SUBMISSION_STATUS_LABEL: Record<LeagueSubmissionStatus, string> = {
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

export const AWARD_TYPE_LABEL: Record<LeagueAwardType, string> = {
  best_argument: "Best Argument",
  best_use_of_data: "Best Use of Data",
  editors_pick: "Editor's Pick",
};

/** One-line explanation of each award, used in the writer's congratulations email. */
export const AWARD_MEANING: Record<LeagueAwardType, string> = {
  best_argument:
    "awarded for the most compelling, tightly reasoned case made in writing this week",
  best_use_of_data:
    "awarded for the sharpest use of evidence and data to carry a story",
  editors_pick:
    "hand-picked by the editorial board as a standout piece of the week",
};

export const POINT_EVENT_LABEL: Record<LeaguePointEventType, string> = {
  published: "Piece published",
  award: "Weekly award",
  feature: "Featured on homepage",
};

// ── row types (raw Supabase shapes) ─────────────────────────────────────────
export type WriterRow = {
  id: string;
  name: string;
  email: string;
  school: string;
  grade: string;
  signup_date: string;
  is_active: boolean;
};

export type LeagueSubmissionRow = {
  id: string;
  writer_id: string;
  article_title: string;
  google_doc_link: string;
  submission_date: string;
  assigned_editor: string;
  status: LeagueSubmissionStatus;
  reviewed_date: string | null;
  editor_feedback: string | null;
  featured_at: string | null;
  reminder_sent_at: string | null;
  escalation_sent_at: string | null;
  urgent_escalation_sent_at: string | null;
  season_id: string | null;
};

export type LeaguePointsRow = {
  writer_id: string;
  total_points: number;
  published_count: number;
  award_count: number;
  feature_count: number;
};

export type PointEventRow = {
  id: string;
  writer_id: string;
  event_type: LeaguePointEventType;
  points_awarded: number;
  created_at: string;
};

export type SeasonRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export type WeeklyAwardRow = {
  id: string;
  writer_id: string;
  award_type: LeagueAwardType;
  week_of: string;
  points_awarded: number;
};

export type LeaderboardViewRow = {
  writer_id: string;
  name: string;
  school: string;
  total_points: number;
  published_count: number;
  award_count: number;
  feature_count: number;
  rank: number;
};

// ── row → app mappers ───────────────────────────────────────────────────────
export function mapWriter(row: WriterRow): Writer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    school: row.school,
    grade: row.grade,
    signupDate: row.signup_date,
    isActive: row.is_active,
  };
}

export function mapSubmission(row: LeagueSubmissionRow): LeagueSubmission {
  return {
    id: row.id,
    writerId: row.writer_id,
    articleTitle: row.article_title,
    googleDocLink: row.google_doc_link,
    submissionDate: row.submission_date,
    assignedEditor: row.assigned_editor,
    status: row.status,
    reviewedDate: row.reviewed_date ?? undefined,
    editorFeedback: row.editor_feedback ?? undefined,
    featuredAt: row.featured_at ?? undefined,
    reminderSentAt: row.reminder_sent_at ?? undefined,
    escalationSentAt: row.escalation_sent_at ?? undefined,
    urgentEscalationSentAt: row.urgent_escalation_sent_at ?? undefined,
    seasonId: row.season_id ?? undefined,
  };
}

export function mapPoints(row: LeaguePointsRow): LeaguePoints {
  return {
    writerId: row.writer_id,
    totalPoints: row.total_points,
    publishedCount: row.published_count,
    awardCount: row.award_count,
    featureCount: row.feature_count,
  };
}

export function mapPointEvent(row: PointEventRow): PointEvent {
  return {
    id: row.id,
    writerId: row.writer_id,
    eventType: row.event_type,
    pointsAwarded: row.points_awarded,
    createdAt: row.created_at,
  };
}

export function mapSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
  };
}

export function mapWeeklyAward(row: WeeklyAwardRow): WeeklyAward {
  return {
    id: row.id,
    writerId: row.writer_id,
    awardType: row.award_type,
    weekOf: row.week_of,
    pointsAwarded: row.points_awarded,
  };
}

export function mapLeaderboardRow(row: LeaderboardViewRow): LeaderboardRow {
  return {
    writerId: row.writer_id,
    name: row.name,
    school: row.school,
    totalPoints: row.total_points,
    publishedCount: row.published_count,
    awardCount: row.award_count,
    rank: row.rank,
  };
}
