/**
 * Typed API surface for the journal platform.
 *
 * Two adapters implement this interface:
 *   - MockAdapter (lib/api/mock-adapter.tsx): delegates to the in-memory store
 *   - HttpAdapter (lib/api/http-adapter.ts): placeholder for a real backend
 *
 * UI components should call methods on this interface (via the future hooks
 * layer), NOT touch the store directly. The active adapter is injected via
 * `ApiClientProvider` (lib/api/provider.tsx).
 */
import type {
  CommentCreateInputZ,
  CommentZ,
  ConversationCreateInputZ,
  ConversationZ,
  MessageCreateInputZ,
  MessageZ,
  ModerationReportCreateInputZ,
  ModerationReportUpdateInputZ,
  ModerationReportZ,
  NotificationCreateInputZ,
  NotificationZ,
  ReviewCreateInputZ,
  ReviewZ,
  RoleZ,
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
}

/**
 * Tag describing which adapter is active. Useful for diagnostics in the UI.
 */
export type ApiAdapterMode = "mock" | "supabase";

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
