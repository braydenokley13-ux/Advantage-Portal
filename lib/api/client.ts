/**
 * Typed API surface for the journal platform.
 *
 * `SupabaseApiClient` (lib/api/supabase-adapter.ts) implements this interface
 * against the configured Supabase project. UI components call these methods
 * via the hooks layer (lib/hooks) or the store, NOT the database directly. The
 * client is injected via `ApiClientProvider` (lib/api/provider.tsx).
 */
import type {
  CommentCreateInputZ,
  CommentZ,
  ConversationCreateInputZ,
  ConversationZ,
  EditorialChecklistZ,
  IssueSlotUpsertInputZ,
  IssueSlotZ,
  IssueUpdateInputZ,
  IssueZ,
  MessageCreateInputZ,
  MessageZ,
  ModerationReportCreateInputZ,
  ModerationReportUpdateInputZ,
  ModerationReportZ,
  NotificationCreateInputZ,
  NotificationZ,
  PitchConvertInputZ,
  PitchCreateInputZ,
  PitchDecideInputZ,
  PitchStatusZ,
  PitchZ,
  ReviewCreateInputZ,
  ReviewZ,
  RoleZ,
  SectionZ,
  SensitiveFlagDecideInputZ,
  SensitiveFlagRaiseInputZ,
  SensitiveFlagZ,
  SubmissionCreateInputZ,
  SubmissionZ,
  TaskCreateInputZ,
  TaskStatusZ,
  TaskUpdateInputZ,
  TaskZ,
  UserZ,
} from "@/lib/contracts";
import type { ExtensionRequest } from "@/lib/types";

export interface ExtensionRequestCreateInput {
  taskId: string;
  requestedById: string;
  newDeadline: string;
  reason: string;
}

export interface ExtensionRequestDecideInput {
  taskId: string;
  decidedById: string;
  approve: boolean;
}

/** All adapter methods are async to match the eventual HTTP shape. */
export interface ApiClient {
  // ── Identity ──────────────────────────────────────────────────────────────
  getCurrentUser(): Promise<UserZ | null>;

  // ── Users ─────────────────────────────────────────────────────────────────
  listUsers(): Promise<UserZ[]>;
  getUser(id: string): Promise<UserZ | null>;
  updateUserRole(id: string, role: RoleZ): Promise<UserZ>;
  setUserActive(id: string, active: boolean): Promise<UserZ>;

  // ── Tasks ─────────────────────────────────────────────────────────────────
  listTasks(): Promise<TaskZ[]>;
  getTask(id: string): Promise<TaskZ | null>;
  createTask(input: TaskCreateInputZ): Promise<TaskZ>;
  updateTask(id: string, patch: TaskUpdateInputZ): Promise<TaskZ>;
  setTaskStatus(id: string, status: TaskStatusZ): Promise<TaskZ>;

  // ── Submissions ───────────────────────────────────────────────────────────
  listSubmissions(taskId?: string): Promise<SubmissionZ[]>;
  createSubmission(input: SubmissionCreateInputZ): Promise<SubmissionZ>;

  // ── Reviews ───────────────────────────────────────────────────────────────
  listReviews(submissionId?: string): Promise<ReviewZ[]>;
  createReview(input: ReviewCreateInputZ): Promise<ReviewZ>;

  // ── Comments ──────────────────────────────────────────────────────────────
  listComments(submissionId?: string): Promise<CommentZ[]>;
  createComment(input: CommentCreateInputZ): Promise<CommentZ>;
  toggleResolveComment(id: string): Promise<CommentZ>;

  // ── Conversations + Messages ──────────────────────────────────────────────
  listConversations(): Promise<ConversationZ[]>;
  createConversation(input: ConversationCreateInputZ): Promise<ConversationZ>;
  listMessages(conversationId?: string): Promise<MessageZ[]>;
  sendMessage(input: MessageCreateInputZ): Promise<MessageZ>;
  togglePinMessage(id: string): Promise<MessageZ>;

  // ── Notifications ─────────────────────────────────────────────────────────
  listNotifications(userId?: string): Promise<NotificationZ[]>;
  pushNotification(input: NotificationCreateInputZ): Promise<NotificationZ>;
  markNotificationRead(id: string, read?: boolean): Promise<NotificationZ>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // ── Extension requests ────────────────────────────────────────────────────
  requestExtension(input: ExtensionRequestCreateInput): Promise<ExtensionRequest>;
  decideExtension(input: ExtensionRequestDecideInput): Promise<void>;

  // ── Moderation reports ────────────────────────────────────────────────────
  listModerationReports(filter?: {
    status?: ModerationReportZ["status"];
  }): Promise<ModerationReportZ[]>;
  createModerationReport(
    input: ModerationReportCreateInputZ
  ): Promise<ModerationReportZ>;
  updateModerationReport(
    id: string,
    patch: ModerationReportUpdateInputZ
  ): Promise<ModerationReportZ>;
  bulkUpdateModerationReports(
    ids: string[],
    patch: ModerationReportUpdateInputZ
  ): Promise<ModerationReportZ[]>;
  hideMessage(messageId: string): Promise<MessageZ>;

  // ── Newsroom: sections ────────────────────────────────────────────────────
  listSections(): Promise<SectionZ[]>;

  // ── Newsroom: pitches ─────────────────────────────────────────────────────
  listPitches(filter?: {
    writerId?: string;
    status?: PitchStatusZ;
  }): Promise<PitchZ[]>;
  createPitch(input: PitchCreateInputZ): Promise<PitchZ>;
  decidePitch(input: PitchDecideInputZ): Promise<PitchZ>;
  /** Convert an accepted pitch into a Task assignment. Returns the new Task. */
  convertPitch(input: PitchConvertInputZ): Promise<TaskZ>;

  // ── Newsroom: issues ──────────────────────────────────────────────────────
  listIssues(): Promise<IssueZ[]>;
  getIssue(id: string): Promise<IssueZ | null>;
  updateIssue(id: string, patch: IssueUpdateInputZ): Promise<IssueZ>;
  /**
   * Mark an issue published. Promotes every slotted task that isn't already
   * complete to status="complete" so the derived stage helper renders it as
   * `published`.
   */
  publishIssue(id: string): Promise<IssueZ>;

  // ── Newsroom: issue slots ─────────────────────────────────────────────────
  listIssueSlots(issueId?: string): Promise<IssueSlotZ[]>;
  upsertIssueSlot(input: IssueSlotUpsertInputZ): Promise<IssueSlotZ>;
  removeIssueSlot(id: string): Promise<void>;

  // ── Newsroom: editorial checklists ────────────────────────────────────────
  /** Returns null if no checklist exists yet — call `updateChecklistItem`
   *  to lazily seed one. */
  getEditorialChecklist(taskId: string): Promise<EditorialChecklistZ | null>;
  /** Bulk read for surfaces that need many checklists at once (issue
   *  readiness derivation). Optionally filter by a list of task ids. */
  listChecklists(taskIds?: string[]): Promise<EditorialChecklistZ[]>;
  updateChecklistItem(input: {
    taskId: string;
    key: string;
    by: string;
    checked?: boolean;
  }): Promise<EditorialChecklistZ>;

  // ── Newsroom: sensitive flags ─────────────────────────────────────────────
  listSensitiveFlags(filter?: {
    status?: SensitiveFlagZ["status"];
    taskId?: string;
  }): Promise<SensitiveFlagZ[]>;
  raiseSensitiveFlag(input: SensitiveFlagRaiseInputZ): Promise<SensitiveFlagZ>;
  decideSensitiveFlag(input: SensitiveFlagDecideInputZ): Promise<SensitiveFlagZ>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public cause?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}
