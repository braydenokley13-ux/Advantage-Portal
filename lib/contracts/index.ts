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

// AssignmentBrief is referenced by Task via the optional `brief` field.
export const AssignmentBriefSchema = z.object({
  angle: z.string().optional(),
  mustAnswer: z.array(z.string()).optional(),
  requiredSources: z.array(z.string()).optional(),
  quoteRequirements: z.string().optional(),
  visualNeeds: z.string().optional(),
  publishingNotes: z.string().optional(),
});
export type AssignmentBriefZ = z.infer<typeof AssignmentBriefSchema>;

export const SensitiveStatusSchema = z.enum(["open", "cleared", "holding"]);
export type SensitiveStatusZ = z.infer<typeof SensitiveStatusSchema>;

export const SensitiveReasonSchema = z.enum([
  "student_privacy",
  "politics",
  "financial_claims",
  "allegations",
  "medical_or_mental_health",
  "other",
]);
export type SensitiveReasonZ = z.infer<typeof SensitiveReasonSchema>;

export const SensitiveFlagSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  reason: SensitiveReasonSchema,
  notes: z.string(),
  status: SensitiveStatusSchema,
  raisedById: z.string(),
  raisedAt: isoDate,
  decidedById: z.string().optional(),
  decidedAt: isoDate.optional(),
  decisionNote: z.string().optional(),
});
export type SensitiveFlagZ = z.infer<typeof SensitiveFlagSchema>;

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
  // ── Newsroom fields (additive, all optional). ──────────────────────────
  sectionId: z.string().optional(),
  pitchId: z.string().optional(),
  issueId: z.string().optional(),
  copyEditorId: z.string().optional(),
  factCheckerId: z.string().optional(),
  slug: z.string().optional(),
  brief: AssignmentBriefSchema.optional(),
  wordCountActual: z.number().int().nonnegative().optional(),
  sensitive: SensitiveFlagSchema.optional(),
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

// ────────────────────────────────────────────────────────────────────────────
// Newsroom workflow — sections, pitches, issues, slots, checklists, flags
// ────────────────────────────────────────────────────────────────────────────

export const SectionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  accent: z.string(),
});
export type SectionZ = z.infer<typeof SectionSchema>;

export const PitchStatusSchema = z.enum([
  "submitted",
  "accepted",
  "declined",
  "converted",
]);
export type PitchStatusZ = z.infer<typeof PitchStatusSchema>;

export const PitchSchema = z.object({
  id: z.string(),
  proposedHeadline: z.string(),
  sectionId: z.string().optional(),
  angle: z.string(),
  whyNow: z.string(),
  proposedSources: z.array(z.string()),
  expectedWordCount: z.number().int().positive().optional(),
  deadlinePref: isoDate.optional(),
  writerNote: z.string().optional(),
  writerId: z.string(),
  status: PitchStatusSchema,
  editorNote: z.string().optional(),
  decidedById: z.string().optional(),
  decidedAt: isoDate.optional(),
  taskId: z.string().optional(),
  createdAt: isoDate,
});
export type PitchZ = z.infer<typeof PitchSchema>;

export const PitchCreateInput = z.object({
  proposedHeadline: z.string().min(1),
  sectionId: z.string().optional(),
  angle: z.string().min(1),
  whyNow: z.string().min(1),
  proposedSources: z.array(z.string()).default([]),
  expectedWordCount: z.number().int().positive().optional(),
  deadlinePref: isoDate.optional(),
  writerNote: z.string().optional(),
  writerId: z.string(),
});
export type PitchCreateInputZ = z.infer<typeof PitchCreateInput>;

export const PitchDecideInput = z.object({
  pitchId: z.string(),
  decidedById: z.string(),
  accept: z.boolean(),
  note: z.string().optional(),
});
export type PitchDecideInputZ = z.infer<typeof PitchDecideInput>;

export const PitchConvertInput = z.object({
  pitchId: z.string(),
  editorId: z.string().optional(),
  deadline: isoDate,
  leaderId: z.string(),
  issueId: z.string().optional(),
});
export type PitchConvertInputZ = z.infer<typeof PitchConvertInput>;

export const IssueStatusSchema = z.enum([
  "planning",
  "production",
  "published",
  "archived",
]);
export type IssueStatusZ = z.infer<typeof IssueStatusSchema>;

export const IssueSchema = z.object({
  id: z.string(),
  number: z.number().int().nonnegative(),
  name: z.string(),
  publishDate: isoDate,
  status: IssueStatusSchema,
  notes: z.string().optional(),
});
export type IssueZ = z.infer<typeof IssueSchema>;

export const IssueUpdateInput = z.object({
  number: z.number().int().nonnegative().optional(),
  name: z.string().min(1).optional(),
  publishDate: isoDate.optional(),
  status: IssueStatusSchema.optional(),
  notes: z.string().optional(),
});
export type IssueUpdateInputZ = z.infer<typeof IssueUpdateInput>;

export const IssueSlotPrioritySchema = z.enum(["must_run", "nice_to_run"]);
export type IssueSlotPriorityZ = z.infer<typeof IssueSlotPrioritySchema>;

export const IssueSlotSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  taskId: z.string(),
  priority: IssueSlotPrioritySchema,
});
export type IssueSlotZ = z.infer<typeof IssueSlotSchema>;

export const IssueSlotUpsertInput = z.object({
  issueId: z.string(),
  taskId: z.string(),
  priority: IssueSlotPrioritySchema.optional(),
});
export type IssueSlotUpsertInputZ = z.infer<typeof IssueSlotUpsertInput>;

export const ChecklistGroupSchema = z.enum(["general", "business", "sensitive"]);
export type ChecklistGroupZ = z.infer<typeof ChecklistGroupSchema>;

export const ChecklistItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: ChecklistGroupSchema,
  required: z.boolean(),
  checked: z.boolean(),
  checkedById: z.string().optional(),
  checkedAt: isoDate.optional(),
});
export type ChecklistItemZ = z.infer<typeof ChecklistItemSchema>;

export const EditorialChecklistSchema = z.object({
  taskId: z.string(),
  items: z.array(ChecklistItemSchema),
  updatedAt: isoDate,
});
export type EditorialChecklistZ = z.infer<typeof EditorialChecklistSchema>;

export const SensitiveFlagRaiseInput = z.object({
  taskId: z.string(),
  raisedById: z.string(),
  reason: SensitiveReasonSchema,
  notes: z.string().min(1),
});
export type SensitiveFlagRaiseInputZ = z.infer<typeof SensitiveFlagRaiseInput>;

export const SensitiveFlagDecideInput = z.object({
  taskId: z.string(),
  decidedById: z.string(),
  status: z.enum(["cleared", "holding"]),
  note: z.string().optional(),
});
export type SensitiveFlagDecideInputZ = z.infer<typeof SensitiveFlagDecideInput>;

// ────────────────────────────────────────────────────────────────────────────
// Site configuration (branding, feature toggles, workflow overrides)
//
// Stored as a single JSON patch in `public.app_settings`; every field is
// optional because only changed values are persisted. The app deep-merges this
// over DEFAULT_SITE_CONFIG (lib/site-config-defaults.ts) at read time.
// ────────────────────────────────────────────────────────────────────────────

export const FeatureToggleSchema = z
  .object({ enabled: z.boolean(), roles: z.array(RoleSchema) })
  .partial();

export const StatusOverrideSchema = z
  .object({
    label: z.string(),
    description: z.string(),
    badgeTone: z.enum(["default", "secondary", "warning", "success"]),
    nextAction: z
      .object({ writer: z.string(), editor: z.string(), leader: z.string() })
      .partial(),
  })
  .partial();

export const ChecklistTemplateItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: ChecklistGroupSchema,
  required: z.boolean(),
});

export const FeedbackCategoryConfigSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const SiteConfigPatchSchema = z
  .object({
    brand: z
      .object({
        name: z.string(),
        tagline: z.string(),
        accentFrom: z.string(),
        accentTo: z.string(),
      })
      .partial(),
    features: z.record(z.string(), FeatureToggleSchema),
    statuses: z.record(z.string(), StatusOverrideSchema),
    checklistTemplate: z.record(
      z.string(),
      z.array(ChecklistTemplateItemSchema)
    ),
    notificationDefaults: z.record(z.string(), z.boolean()),
    feedbackCategories: z.array(FeedbackCategoryConfigSchema),
  })
  .partial();
export type SiteConfigPatchZ = z.infer<typeof SiteConfigPatchSchema>;

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
  Section: SectionSchema,
  Pitch: PitchSchema,
  Issue: IssueSchema,
  IssueSlot: IssueSlotSchema,
  EditorialChecklist: EditorialChecklistSchema,
  SensitiveFlag: SensitiveFlagSchema,
} as const;
