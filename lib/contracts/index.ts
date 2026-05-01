/**
 * Shared contracts (Zod schemas) for every entity in the journal platform.
 *
 * These mirror the master plan. They are the SINGLE SOURCE OF TRUTH for the
 * shape of API requests and responses once a real backend is wired in. The
 * existing `lib/types.ts` continues to export plain TS types for legacy
 * imports; those types are now equivalent to the Zod-inferred types here.
 *
 * Convention:
 *   <Entity>Schema   – the persisted record
 *   <Entity>Input    – payload accepted by create/update endpoints
 */
import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────────────────────

export const RoleSchema = z.enum(["writer", "editor", "leader", "admin"]);
export type RoleZ = z.infer<typeof RoleSchema>;

export const TaskStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "submitted",
  "complete",
]);
export type TaskStatusZ = z.infer<typeof TaskStatusSchema>;

export const TaskColorSchema = z.enum(["green", "amber", "red"]);
export type TaskColorZ = z.infer<typeof TaskColorSchema>;

export const ReviewDecisionSchema = z.enum([
  "approved",
  "changes_requested",
  "rejected",
]);
export type ReviewDecisionZ = z.infer<typeof ReviewDecisionSchema>;

export const SubmissionTypeSchema = z.enum(["file", "google_doc", "inline"]);
export type SubmissionTypeZ = z.infer<typeof SubmissionTypeSchema>;

export const ConversationKindSchema = z.enum([
  "dm",
  "group",
  "all_team",
  "issue",
  "admins_only",
]);
export type ConversationKindZ = z.infer<typeof ConversationKindSchema>;

export const NotificationKindSchema = z.enum([
  "task_assigned",
  "deadline",
  "submission",
  "comment",
  "review_decision",
  "task_complete",
  "message",
  "announcement",
]);
export type NotificationKindZ = z.infer<typeof NotificationKindSchema>;

const isoDate = z.string().min(1, "ISO date required");

// ────────────────────────────────────────────────────────────────────────────
// User
// ────────────────────────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: RoleSchema,
  avatarUrl: z.string().url().optional(),
  active: z.boolean().optional().default(true),
});
export type UserZ = z.infer<typeof UserSchema>;

export const UserCreateInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: RoleSchema,
});
export type UserCreateInputZ = z.infer<typeof UserCreateInput>;

export const UserUpdateInput = z.object({
  role: RoleSchema.optional(),
  active: z.boolean().optional(),
});
export type UserUpdateInputZ = z.infer<typeof UserUpdateInput>;

// ────────────────────────────────────────────────────────────────────────────
// Task
// ────────────────────────────────────────────────────────────────────────────

export const ExtensionRequestSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  requestedById: z.string(),
  newDeadline: isoDate,
  reason: z.string(),
  status: z.enum(["pending", "approved", "denied"]),
  decidedById: z.string().optional(),
  decidedAt: isoDate.optional(),
  createdAt: isoDate,
});
export type ExtensionRequestZ = z.infer<typeof ExtensionRequestSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  instructions: z.string(),
  writerId: z.string(),
  editorId: z.string().optional(),
  deadline: isoDate,
  status: TaskStatusSchema,
  color: TaskColorSchema,
  currentSubmissionId: z.string().optional(),
  createdAt: isoDate,
  wordCountTarget: z.number().int().positive().optional(),
  citationsRequired: z.boolean().optional(),
  extensionRequest: ExtensionRequestSchema.optional(),
});
export type TaskZ = z.infer<typeof TaskSchema>;

export const TaskCreateInput = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
  writerId: z.string(),
  editorId: z.string().optional(),
  deadline: isoDate,
  color: TaskColorSchema.optional(),
});
export type TaskCreateInputZ = z.infer<typeof TaskCreateInput>;

export const TaskUpdateInput = TaskCreateInput.partial();
export type TaskUpdateInputZ = z.infer<typeof TaskUpdateInput>;

export const TaskStatusInput = z.object({ status: TaskStatusSchema });
export type TaskStatusInputZ = z.infer<typeof TaskStatusInput>;

// ────────────────────────────────────────────────────────────────────────────
// Submission
// ────────────────────────────────────────────────────────────────────────────

export const SubmissionFileMetaSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type SubmissionFileMetaZ = z.infer<typeof SubmissionFileMetaSchema>;

export const SubmissionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  type: SubmissionTypeSchema,
  version: z.number().int().positive(),
  /** inline → markdown body; google_doc → URL; file → filename */
  content: z.string(),
  file: SubmissionFileMetaSchema.optional(),
  createdAt: isoDate,
  isCurrent: z.boolean(),
});
export type SubmissionZ = z.infer<typeof SubmissionSchema>;

export const SubmissionCreateInput = z.object({
  taskId: z.string(),
  authorId: z.string(),
  type: SubmissionTypeSchema,
  content: z.string().min(1),
  file: SubmissionFileMetaSchema.optional(),
});
export type SubmissionCreateInputZ = z.infer<typeof SubmissionCreateInput>;

// ────────────────────────────────────────────────────────────────────────────
// Review
// ────────────────────────────────────────────────────────────────────────────

export const ReviewSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  reviewerId: z.string(),
  decision: ReviewDecisionSchema,
  notes: z.string().optional(),
  createdAt: isoDate,
});
export type ReviewZ = z.infer<typeof ReviewSchema>;

export const ReviewCreateInput = z.object({
  submissionId: z.string(),
  reviewerId: z.string(),
  decision: ReviewDecisionSchema,
  notes: z.string().optional(),
});
export type ReviewCreateInputZ = z.infer<typeof ReviewCreateInput>;

// ────────────────────────────────────────────────────────────────────────────
// Comment
// ────────────────────────────────────────────────────────────────────────────

export const CommentSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  authorId: z.string(),
  body: z.string(),
  inline: z.boolean(),
  /** 1-indexed when `inline` is true */
  lineNumber: z.number().int().positive().optional(),
  resolved: z.boolean(),
  createdAt: isoDate,
});
export type CommentZ = z.infer<typeof CommentSchema>;

export const CommentCreateInput = z.object({
  submissionId: z.string(),
  authorId: z.string(),
  body: z.string().min(1),
  inline: z.boolean().optional(),
  lineNumber: z.number().int().positive().optional(),
});
export type CommentCreateInputZ = z.infer<typeof CommentCreateInput>;

// ────────────────────────────────────────────────────────────────────────────
// Conversation + Message
// ────────────────────────────────────────────────────────────────────────────

export const ConversationSchema = z.object({
  id: z.string(),
  kind: ConversationKindSchema,
  title: z.string(),
  memberIds: z.array(z.string()),
  lastMessageAt: isoDate.optional(),
});
export type ConversationZ = z.infer<typeof ConversationSchema>;

export const ConversationCreateInput = z.object({
  kind: ConversationKindSchema,
  title: z.string().min(1),
  memberIds: z.array(z.string()).min(1),
});
export type ConversationCreateInputZ = z.infer<typeof ConversationCreateInput>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: isoDate,
  pinnedAt: isoDate.optional(),
  hiddenAt: isoDate.optional(),
});
export type MessageZ = z.infer<typeof MessageSchema>;

export const MessageCreateInput = z.object({
  conversationId: z.string(),
  authorId: z.string(),
  body: z.string().min(1),
});
export type MessageCreateInputZ = z.infer<typeof MessageCreateInput>;

// ────────────────────────────────────────────────────────────────────────────
// Notification
// ────────────────────────────────────────────────────────────────────────────

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: NotificationKindSchema,
  title: z.string(),
  body: z.string().optional(),
  read: z.boolean(),
  createdAt: isoDate,
});
export type NotificationZ = z.infer<typeof NotificationSchema>;

export const NotificationCreateInput = z.object({
  userId: z.string(),
  kind: NotificationKindSchema,
  title: z.string().min(1),
  body: z.string().optional(),
});
export type NotificationCreateInputZ = z.infer<typeof NotificationCreateInput>;

// ────────────────────────────────────────────────────────────────────────────
// Aggregate exports
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Moderation reports (teen-safety)
// ────────────────────────────────────────────────────────────────────────────

export const ModerationStatusSchema = z.enum([
  "open",
  "in_review",
  "resolved",
  "dismissed",
]);
export type ModerationStatusZ = z.infer<typeof ModerationStatusSchema>;

export const ModerationSeveritySchema = z.enum(["low", "medium", "high"]);
export type ModerationSeverityZ = z.infer<typeof ModerationSeveritySchema>;

export const ModerationReasonSchema = z.enum([
  "inappropriate_language",
  "bullying_or_harassment",
  "personal_information",
  "off_topic_or_spam",
  "other",
]);
export type ModerationReasonZ = z.infer<typeof ModerationReasonSchema>;

export const ModerationReportSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  conversationId: z.string(),
  reportedUserId: z.string(),
  reporterId: z.string(),
  reason: ModerationReasonSchema,
  reporterNote: z.string().optional(),
  status: ModerationStatusSchema,
  severity: ModerationSeveritySchema,
  resolvedById: z.string().optional(),
  resolvedAt: isoDate.optional(),
  internalNote: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type ModerationReportZ = z.infer<typeof ModerationReportSchema>;

export const ModerationReportCreateInput = z.object({
  messageId: z.string(),
  reporterId: z.string(),
  reason: ModerationReasonSchema.default("other"),
  reporterNote: z.string().optional(),
  severity: ModerationSeveritySchema.optional(),
});
export type ModerationReportCreateInputZ = z.infer<
  typeof ModerationReportCreateInput
>;

export const ModerationReportUpdateInput = z.object({
  status: ModerationStatusSchema.optional(),
  severity: ModerationSeveritySchema.optional(),
  internalNote: z.string().optional(),
  resolvedById: z.string().optional(),
});
export type ModerationReportUpdateInputZ = z.infer<
  typeof ModerationReportUpdateInput
>;

export const Schemas = {
  User: UserSchema,
  Task: TaskSchema,
  Submission: SubmissionSchema,
  Review: ReviewSchema,
  Comment: CommentSchema,
  Conversation: ConversationSchema,
  Message: MessageSchema,
  Notification: NotificationSchema,
  ModerationReport: ModerationReportSchema,
} as const;
