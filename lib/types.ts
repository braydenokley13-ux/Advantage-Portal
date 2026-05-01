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
}

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
  | "announcement";

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
