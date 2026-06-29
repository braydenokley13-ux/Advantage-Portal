export type Role = "writer" | "editor" | "leader" | "admin";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "complete";

export type TaskColor = "green" | "amber" | "red";

export type ReviewDecision =
  | "approved"
  | "changes_requested"
  | "rejected";

export type SubmissionType = "file" | "google_doc" | "inline";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  active?: boolean;
}

export interface Task {
  id: string;
  title: string;
  instructions: string;
  writerId: string;
  editorId?: string;
  deadline: string;
  status: TaskStatus;
  color: TaskColor;
  currentSubmissionId?: string;
  createdAt: string;
  /** Optional editorial scaffolding for teen writers. */
  wordCountTarget?: number;
  /** Editor sets this when the piece needs sourcing (research/finance pieces).
   *  Soft requirement — does not block submission. */
  citationsRequired?: boolean;
  /** Active extension request, if any. */
  extensionRequest?: ExtensionRequest;

  // ── Newsroom fields (all optional, additive on existing tasks). ─────────
  /** Section this story runs in (News, Opinion, Business, …). */
  sectionId?: string;
  /** Pitch this story originated from. */
  pitchId?: string;
  /** Issue/edition this story is slotted for. */
  issueId?: string;
  /** Copy desk lead for this story (often a different editor). */
  copyEditorId?: string;
  /** Fact-checker for this story. */
  factCheckerId?: string;
  /** Public URL slug suggestion for the publication. */
  slug?: string;
  /** Assignment brief — angle, must-answer questions, etc. */
  brief?: AssignmentBrief;
  /** Logged actual word count once a draft is submitted. */
  wordCountActual?: number;
  /** Sensitive-story editorial escalation. Undefined = no flag raised. */
  sensitive?: SensitiveFlag;
}

/** A newspaper section the story runs under. */
export interface Section {
  id: string;
  /** URL/slug for routing on the public site. */
  slug: string;
  /** Display name (News, Opinion, Markets & Finance, …). */
  name: string;
  description: string;
  /** Tailwind-friendly accent class fragment, e.g. "amber" / "emerald". */
  accent: string;
}

export type PitchStatus = "submitted" | "accepted" | "declined" | "converted";

/** A writer's pitch awaiting editorial decision. */
export interface Pitch {
  id: string;
  proposedHeadline: string;
  sectionId?: string;
  /** Thesis / angle — the "what is this story actually about?". */
  angle: string;
  /** "Why now?" — peg, timeliness. */
  whyNow: string;
  /** Sources the writer plans to use (one per line in UI). */
  proposedSources: string[];
  expectedWordCount?: number;
  /** Writer's preferred deadline (ISO). Editor may override on conversion. */
  deadlinePref?: string;
  /** Free-form note from the writer. */
  writerNote?: string;
  writerId: string;
  status: PitchStatus;
  /** Editor's note on accept/decline. */
  editorNote?: string;
  decidedById?: string;
  decidedAt?: string;
  /** Task created from this pitch when converted to an assignment. */
  taskId?: string;
  createdAt: string;
}

export type IssueStatus = "planning" | "production" | "published" | "archived";

/** A scheduled edition of the publication. */
export interface Issue {
  id: string;
  /** Issue number (e.g. 42). */
  number: number;
  /** Display name ("Issue #42 — Spring Forward"). */
  name: string;
  /** Target publish date (ISO). */
  publishDate: string;
  status: IssueStatus;
  /** Editor-in-chief / leader notes for the issue. */
  notes?: string;
}

export type IssueSlotPriority = "must_run" | "nice_to_run";

/** A story slotted into an issue's run sheet. */
export interface IssueSlot {
  id: string;
  issueId: string;
  taskId: string;
  priority: IssueSlotPriority;
}

/** Assignment brief carried on a Task — answers "what is this piece?". */
export interface AssignmentBrief {
  /** Story angle (one sentence — what the piece argues / shows). */
  angle?: string;
  /** Questions the piece must answer. */
  mustAnswer?: string[];
  /** Sources the writer should consult (links, named contacts). */
  requiredSources?: string[];
  /** Quote requirements ("at least 2 named on-the-record quotes…"). */
  quoteRequirements?: string;
  /** Visual / design asks (photos, charts, pull quotes). */
  visualNeeds?: string;
  /** Any publishing notes (run date, embargo, layout slot). */
  publishingNotes?: string;
}

export type ChecklistGroup = "general" | "business" | "sensitive";

/** A single checklist item. Identity is stable (key) so toggles persist. */
export interface ChecklistItem {
  key: string;
  label: string;
  group: ChecklistGroup;
  /** True when the responsible editor has confirmed this item. */
  checked: boolean;
  checkedById?: string;
  checkedAt?: string;
  /** Whether this item must be checked for publish-ready. */
  required: boolean;
}

/** Per-task editorial checklist. Items are pre-seeded by group. */
export interface EditorialChecklist {
  taskId: string;
  items: ChecklistItem[];
  /** Convenience: bumped whenever any item toggles. */
  updatedAt: string;
}

export type SensitiveReason =
  | "student_privacy"
  | "politics"
  | "financial_claims"
  | "allegations"
  | "medical_or_mental_health"
  | "other";

/**
 * Editorial escalation on a story (NOT chat moderation). Raised by anyone
 * with story access; cleared or held by leader/admin before publication.
 */
export interface SensitiveFlag {
  id: string;
  taskId: string;
  reason: SensitiveReason;
  notes: string;
  /**
   * `open` — pending leader/admin review. `cleared` — okay to publish.
   * `holding` — story is blocked until the issue is resolved.
   */
  status: "open" | "cleared" | "holding";
  raisedById: string;
  raisedAt: string;
  decidedById?: string;
  decidedAt?: string;
  decisionNote?: string;
}

/** Derived publication stage (see lib/newsroom-stage.ts). */
export type StoryStage =
  | "pitch"
  | "drafting"
  | "section_edit"
  | "copy_edit"
  | "fact_check"
  | "final_approval"
  | "publish_ready"
  | "published"
  | "archived";

export interface ExtensionRequest {
  id: string;
  taskId: string;
  requestedById: string;
  /** New ISO deadline being requested. */
  newDeadline: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  decidedById?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface SubmissionFileMeta {
  filename: string;
  mimeType: string;
  /** Bytes. */
  sizeBytes: number;
}

export interface Submission {
  id: string;
  taskId: string;
  type: SubmissionType;
  version: number;
  /** For inline: markdown body. For file: filename. For google_doc: URL. */
  content: string;
  /** Populated for `file` submissions. */
  file?: SubmissionFileMeta;
  createdAt: string;
  isCurrent: boolean;
}

export interface Review {
  id: string;
  submissionId: string;
  reviewerId: string;
  decision: ReviewDecision;
  notes?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  submissionId: string;
  authorId: string;
  body: string;
  inline: boolean;
  /** 1-indexed line number when `inline` is true; undefined for general comments. */
  lineNumber?: number;
  resolved: boolean;
  createdAt: string;
}

export type ConversationKind =
  | "dm"
  | "group"
  | "all_team"
  | "issue"
  | "admins_only";

export interface Conversation {
  id: string;
  kind: ConversationKind;
  title: string;
  memberIds: string[];
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
  pinnedAt?: string;
  /** When set, the message is hidden by a moderator. The body should not
   *  render to non-admins; admins see it with a "hidden" indicator. */
  hiddenAt?: string;
}

export type NotificationKind =
  | "task_assigned"
  | "deadline"
  | "submission"
  | "comment"
  | "review_decision"
  | "task_complete"
  | "message"
  | "announcement"
  | "feedback"
  | "competition";

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}

export type ModerationStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "dismissed";

export type ModerationSeverity = "low" | "medium" | "high";

export type ModerationReason =
  | "inappropriate_language"
  | "bullying_or_harassment"
  | "personal_information"
  | "off_topic_or_spam"
  | "other";

export interface ModerationReport {
  id: string;
  messageId: string;
  conversationId: string;
  reportedUserId: string;
  reporterId: string;
  reason: ModerationReason;
  reporterNote?: string;
  status: ModerationStatus;
  severity: ModerationSeverity;
  resolvedById?: string;
  resolvedAt?: string;
  internalNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackCategory =
  | "portal_bug"
  | "feature_idea"
  | "story_or_content"
  | "competition"
  | "general"
  | "other";

export type FeedbackStatus =
  | "open"
  | "triaged"
  | "planned"
  | "resolved"
  | "declined"
  | "archived";

/** Free-form feedback on anything in the Advantage; triaged by leaders/admins. */
export interface Feedback {
  id: string;
  authorId: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  /** Optional 1–5 sentiment. */
  rating?: number;
  /** Optional pointer to what the feedback is about (a story, a page, …). */
  targetKind?: string;
  targetId?: string;
  targetLabel?: string;
  status: FeedbackStatus;
  assignedToId?: string;
  adminNote?: string;
  resolvedById?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
