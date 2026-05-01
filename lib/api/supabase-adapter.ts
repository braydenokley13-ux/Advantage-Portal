/**
 * SupabaseAdapter — implements the typed `ApiClient` against a Supabase
 * project. Field naming bridges the snake_case Postgres columns and the
 * camelCase application contracts.
 *
 * Implementation status (per checkpoint 4 priority list):
 *   1. tasks                — fully implemented
 *   2. extension_requests   — fully implemented
 *   3. messages / convos    — fully implemented (read + send + pin + hide)
 *   4. moderation_reports   — fully implemented (list/create/update/bulk)
 *   5. notifications        — fully implemented (list / mark / push)
 *
 *   submissions / reviews / comments are best-effort: list works against
 *   the schema, create paths throw a clear "Not implemented in Supabase
 *   adapter yet" error so component callers can surface it. The mock
 *   path exercises the full UI flow today; this is the scoped follow-up.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, type ApiClient } from "./client";
import type {
  CommentZ,
  ConversationZ,
  MessageZ,
  ModerationReportZ,
  NotificationZ,
  ReviewZ,
  SubmissionZ,
  TaskZ,
  UserZ,
} from "@/lib/contracts";
import type { ExtensionRequest } from "@/lib/types";

// ── row → contract translators ───────────────────────────────────────────
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserZ["role"];
  avatar_url: string | null;
  active: boolean;
};

function rowToUser(r: UserRow): UserZ {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    avatarUrl: r.avatar_url ?? undefined,
    active: r.active,
  };
}

type TaskRow = {
  id: string;
  title: string;
  instructions: string;
  writer_id: string;
  editor_id: string | null;
  deadline: string;
  status: TaskZ["status"];
  color: TaskZ["color"];
  current_submission_id: string | null;
  word_count_target: number | null;
  citations_required: boolean;
  created_at: string;
};

type ExtensionRow = {
  id: string;
  task_id: string;
  requested_by_id: string;
  new_deadline: string;
  reason: string;
  status: ExtensionRequest["status"];
  decided_by_id: string | null;
  decided_at: string | null;
  created_at: string;
};

function rowToExtension(r: ExtensionRow): ExtensionRequest {
  return {
    id: r.id,
    taskId: r.task_id,
    requestedById: r.requested_by_id,
    newDeadline: r.new_deadline,
    reason: r.reason,
    status: r.status,
    decidedById: r.decided_by_id ?? undefined,
    decidedAt: r.decided_at ?? undefined,
    createdAt: r.created_at,
  };
}

function rowToTask(r: TaskRow, ext?: ExtensionRow | null): TaskZ {
  return {
    id: r.id,
    title: r.title,
    instructions: r.instructions,
    writerId: r.writer_id,
    editorId: r.editor_id ?? undefined,
    deadline: r.deadline,
    status: r.status,
    color: r.color,
    currentSubmissionId: r.current_submission_id ?? undefined,
    createdAt: r.created_at,
    wordCountTarget: r.word_count_target ?? undefined,
    citationsRequired: r.citations_required || undefined,
    extensionRequest: ext ? rowToExtension(ext) : undefined,
  };
}

type SubmissionRow = {
  id: string;
  task_id: string;
  type: SubmissionZ["type"];
  version: number;
  content: string;
  file_filename: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  is_current: boolean;
  created_at: string;
};

function rowToSubmission(r: SubmissionRow): SubmissionZ {
  return {
    id: r.id,
    taskId: r.task_id,
    type: r.type,
    version: r.version,
    content: r.content,
    file: r.file_filename
      ? {
          filename: r.file_filename,
          mimeType: r.file_mime_type ?? "application/octet-stream",
          sizeBytes: r.file_size_bytes ?? 0,
        }
      : undefined,
    isCurrent: r.is_current,
    createdAt: r.created_at,
  };
}

type ReviewRow = {
  id: string;
  submission_id: string;
  reviewer_id: string;
  decision: ReviewZ["decision"];
  notes: string | null;
  created_at: string;
};

function rowToReview(r: ReviewRow): ReviewZ {
  return {
    id: r.id,
    submissionId: r.submission_id,
    reviewerId: r.reviewer_id,
    decision: r.decision,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

type CommentRow = {
  id: string;
  submission_id: string;
  author_id: string;
  body: string;
  inline: boolean;
  line_number: number | null;
  resolved: boolean;
  created_at: string;
};

function rowToComment(r: CommentRow): CommentZ {
  return {
    id: r.id,
    submissionId: r.submission_id,
    authorId: r.author_id,
    body: r.body,
    inline: r.inline,
    lineNumber: r.line_number ?? undefined,
    resolved: r.resolved,
    createdAt: r.created_at,
  };
}

type ConversationRow = {
  id: string;
  kind: ConversationZ["kind"];
  title: string;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  pinned_at: string | null;
  hidden_at: string | null;
  created_at: string;
};

function rowToMessage(r: MessageRow): MessageZ {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    authorId: r.author_id,
    body: r.body,
    pinnedAt: r.pinned_at ?? undefined,
    hiddenAt: r.hidden_at ?? undefined,
    createdAt: r.created_at,
  };
}

type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationZ["kind"];
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

function rowToNotification(r: NotificationRow): NotificationZ {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    title: r.title,
    body: r.body ?? undefined,
    read: r.read,
    createdAt: r.created_at,
  };
}

type ModerationRow = {
  id: string;
  message_id: string;
  conversation_id: string;
  reported_user_id: string;
  reporter_id: string;
  reason: ModerationReportZ["reason"];
  reporter_note: string | null;
  status: ModerationReportZ["status"];
  severity: ModerationReportZ["severity"];
  resolved_by_id: string | null;
  resolved_at: string | null;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
};

function rowToReport(r: ModerationRow): ModerationReportZ {
  return {
    id: r.id,
    messageId: r.message_id,
    conversationId: r.conversation_id,
    reportedUserId: r.reported_user_id,
    reporterId: r.reporter_id,
    reason: r.reason,
    reporterNote: r.reporter_note ?? undefined,
    status: r.status,
    severity: r.severity,
    resolvedById: r.resolved_by_id ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    internalNote: r.internal_note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── adapter ───────────────────────────────────────────────────────────────
export class SupabaseApiClient implements ApiClient {
  constructor(
    private readonly sb: SupabaseClient,
    private readonly currentUserId: string | null
  ) {}

  private err(method: string, cause: unknown): never {
    throw new ApiError(
      `SupabaseApiClient.${method} failed: ${
        (cause as { message?: string })?.message ?? "unknown error"
      }`,
      500,
      cause
    );
  }

  private notSupported(method: string): never {
    throw new ApiError(
      `SupabaseApiClient.${method} not implemented yet — switch NEXT_PUBLIC_DATA_MODE to "mock" or finish the migration.`,
      501
    );
  }

  // ── Identity / users ────────────────────────────────────────────────────
  async getCurrentUser(): Promise<UserZ | null> {
    if (!this.currentUserId) return null;
    const { data, error } = await this.sb
      .from("users")
      .select("id, name, email, role, avatar_url, active")
      .eq("id", this.currentUserId)
      .maybeSingle();
    if (error) this.err("getCurrentUser", error);
    return data ? rowToUser(data as UserRow) : null;
  }

  async listUsers(): Promise<UserZ[]> {
    const { data, error } = await this.sb
      .from("users")
      .select("id, name, email, role, avatar_url, active")
      .order("name");
    if (error) this.err("listUsers", error);
    return (data ?? []).map((r) => rowToUser(r as UserRow));
  }

  async getUser(id: string): Promise<UserZ | null> {
    const { data, error } = await this.sb
      .from("users")
      .select("id, name, email, role, avatar_url, active")
      .eq("id", id)
      .maybeSingle();
    if (error) this.err("getUser", error);
    return data ? rowToUser(data as UserRow) : null;
  }

  async updateUserRole(id: string, role: UserZ["role"]): Promise<UserZ> {
    const { data, error } = await this.sb
      .from("users")
      .update({ role })
      .eq("id", id)
      .select("id, name, email, role, avatar_url, active")
      .single();
    if (error) this.err("updateUserRole", error);
    return rowToUser(data as UserRow);
  }

  async setUserActive(id: string, active: boolean): Promise<UserZ> {
    const { data, error } = await this.sb
      .from("users")
      .update({ active })
      .eq("id", id)
      .select("id, name, email, role, avatar_url, active")
      .single();
    if (error) this.err("setUserActive", error);
    return rowToUser(data as UserRow);
  }

  // ── Tasks ───────────────────────────────────────────────────────────────
  private async loadPendingExtensions(
    taskIds: string[]
  ): Promise<Map<string, ExtensionRow>> {
    if (taskIds.length === 0) return new Map();
    const { data, error } = await this.sb
      .from("extension_requests")
      .select(
        "id, task_id, requested_by_id, new_deadline, reason, status, decided_by_id, decided_at, created_at"
      )
      .in("task_id", taskIds)
      .order("created_at", { ascending: false });
    if (error) this.err("loadPendingExtensions", error);
    const out = new Map<string, ExtensionRow>();
    // Surface the most recent extension per task — matches mock semantics.
    for (const row of (data ?? []) as ExtensionRow[]) {
      if (!out.has(row.task_id)) out.set(row.task_id, row);
    }
    return out;
  }

  async listTasks(): Promise<TaskZ[]> {
    const { data, error } = await this.sb
      .from("tasks")
      .select(
        "id, title, instructions, writer_id, editor_id, deadline, status, color, current_submission_id, word_count_target, citations_required, created_at"
      )
      .order("deadline");
    if (error) this.err("listTasks", error);
    const rows = (data ?? []) as TaskRow[];
    const exts = await this.loadPendingExtensions(rows.map((r) => r.id));
    return rows.map((r) => rowToTask(r, exts.get(r.id) ?? null));
  }

  async getTask(id: string): Promise<TaskZ | null> {
    const { data, error } = await this.sb
      .from("tasks")
      .select(
        "id, title, instructions, writer_id, editor_id, deadline, status, color, current_submission_id, word_count_target, citations_required, created_at"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) this.err("getTask", error);
    if (!data) return null;
    const exts = await this.loadPendingExtensions([id]);
    return rowToTask(data as TaskRow, exts.get(id) ?? null);
  }

  async createTask(input: {
    title: string;
    instructions: string;
    writerId: string;
    editorId?: string;
    deadline: string;
    color?: TaskZ["color"];
  }): Promise<TaskZ> {
    const { data, error } = await this.sb
      .from("tasks")
      .insert({
        title: input.title,
        instructions: input.instructions,
        writer_id: input.writerId,
        editor_id: input.editorId ?? null,
        deadline: input.deadline,
        color: input.color ?? "green",
      })
      .select(
        "id, title, instructions, writer_id, editor_id, deadline, status, color, current_submission_id, word_count_target, citations_required, created_at"
      )
      .single();
    if (error) this.err("createTask", error);
    return rowToTask(data as TaskRow);
  }

  async updateTask(
    id: string,
    patch: {
      title?: string;
      instructions?: string;
      writerId?: string;
      editorId?: string;
      deadline?: string;
      color?: TaskZ["color"];
    }
  ): Promise<TaskZ> {
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.instructions !== undefined) update.instructions = patch.instructions;
    if (patch.writerId !== undefined) update.writer_id = patch.writerId;
    if (patch.editorId !== undefined) update.editor_id = patch.editorId;
    if (patch.deadline !== undefined) update.deadline = patch.deadline;
    if (patch.color !== undefined) update.color = patch.color;

    const { data, error } = await this.sb
      .from("tasks")
      .update(update)
      .eq("id", id)
      .select(
        "id, title, instructions, writer_id, editor_id, deadline, status, color, current_submission_id, word_count_target, citations_required, created_at"
      )
      .single();
    if (error) this.err("updateTask", error);
    return rowToTask(data as TaskRow);
  }

  async setTaskStatus(id: string, status: TaskZ["status"]): Promise<TaskZ> {
    const { data, error } = await this.sb
      .from("tasks")
      .update({ status })
      .eq("id", id)
      .select(
        "id, title, instructions, writer_id, editor_id, deadline, status, color, current_submission_id, word_count_target, citations_required, created_at"
      )
      .single();
    if (error) this.err("setTaskStatus", error);
    return rowToTask(data as TaskRow);
  }

  // ── Submissions / reviews / comments ───────────────────────────────────
  async listSubmissions(taskId?: string): Promise<SubmissionZ[]> {
    let q = this.sb
      .from("submissions")
      .select(
        "id, task_id, type, version, content, file_filename, file_mime_type, file_size_bytes, is_current, created_at"
      );
    if (taskId) q = q.eq("task_id", taskId);
    const { data, error } = await q.order("version", { ascending: false });
    if (error) this.err("listSubmissions", error);
    return (data ?? []).map((r) => rowToSubmission(r as SubmissionRow));
  }
  createSubmission() { return this.notSupported("createSubmission"); }

  async listReviews(submissionId?: string): Promise<ReviewZ[]> {
    let q = this.sb
      .from("reviews")
      .select(
        "id, submission_id, reviewer_id, decision, notes, created_at"
      );
    if (submissionId) q = q.eq("submission_id", submissionId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) this.err("listReviews", error);
    return (data ?? []).map((r) => rowToReview(r as ReviewRow));
  }
  createReview() { return this.notSupported("createReview"); }

  async listComments(submissionId?: string): Promise<CommentZ[]> {
    let q = this.sb
      .from("comments")
      .select(
        "id, submission_id, author_id, body, inline, line_number, resolved, created_at"
      );
    if (submissionId) q = q.eq("submission_id", submissionId);
    const { data, error } = await q.order("created_at");
    if (error) this.err("listComments", error);
    return (data ?? []).map((r) => rowToComment(r as CommentRow));
  }
  createComment() { return this.notSupported("createComment"); }
  toggleResolveComment() { return this.notSupported("toggleResolveComment"); }

  // ── Conversations + messages ───────────────────────────────────────────
  async listConversations(): Promise<ConversationZ[]> {
    const { data, error } = await this.sb
      .from("conversations")
      .select("id, kind, title, last_message_at, conversation_members(user_id)")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) this.err("listConversations", error);
    type Joined = ConversationRow & {
      conversation_members: { user_id: string }[];
    };
    return ((data ?? []) as Joined[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      lastMessageAt: r.last_message_at ?? undefined,
      memberIds: r.conversation_members.map((m) => m.user_id),
    }));
  }
  createConversation() { return this.notSupported("createConversation"); }

  async listMessages(conversationId?: string): Promise<MessageZ[]> {
    let q = this.sb
      .from("messages")
      .select(
        "id, conversation_id, author_id, body, pinned_at, hidden_at, created_at"
      );
    if (conversationId) q = q.eq("conversation_id", conversationId);
    const { data, error } = await q.order("created_at");
    if (error) this.err("listMessages", error);
    return (data ?? []).map((r) => rowToMessage(r as MessageRow));
  }

  async sendMessage(input: {
    conversationId: string;
    authorId: string;
    body: string;
  }): Promise<MessageZ> {
    const { data, error } = await this.sb
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        author_id: input.authorId,
        body: input.body,
      })
      .select(
        "id, conversation_id, author_id, body, pinned_at, hidden_at, created_at"
      )
      .single();
    if (error) this.err("sendMessage", error);
    // bump conversation last_message_at
    await this.sb
      .from("conversations")
      .update({ last_message_at: (data as MessageRow).created_at })
      .eq("id", input.conversationId);
    return rowToMessage(data as MessageRow);
  }

  async togglePinMessage(id: string): Promise<MessageZ> {
    const { data: existing, error: e1 } = await this.sb
      .from("messages")
      .select("pinned_at")
      .eq("id", id)
      .single();
    if (e1) this.err("togglePinMessage", e1);
    const next = (existing as { pinned_at: string | null }).pinned_at
      ? null
      : new Date().toISOString();
    const { data, error } = await this.sb
      .from("messages")
      .update({ pinned_at: next })
      .eq("id", id)
      .select(
        "id, conversation_id, author_id, body, pinned_at, hidden_at, created_at"
      )
      .single();
    if (error) this.err("togglePinMessage", error);
    return rowToMessage(data as MessageRow);
  }

  // ── Notifications ──────────────────────────────────────────────────────
  async listNotifications(userId?: string): Promise<NotificationZ[]> {
    let q = this.sb
      .from("notifications")
      .select("id, user_id, kind, title, body, read, created_at");
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) this.err("listNotifications", error);
    return (data ?? []).map((r) => rowToNotification(r as NotificationRow));
  }

  async pushNotification(input: {
    userId: string;
    kind: NotificationZ["kind"];
    title: string;
    body?: string;
  }): Promise<NotificationZ> {
    const { data, error } = await this.sb
      .from("notifications")
      .insert({
        user_id: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
      })
      .select("id, user_id, kind, title, body, read, created_at")
      .single();
    if (error) this.err("pushNotification", error);
    return rowToNotification(data as NotificationRow);
  }

  async markNotificationRead(id: string, read = true): Promise<NotificationZ> {
    const { data, error } = await this.sb
      .from("notifications")
      .update({ read })
      .eq("id", id)
      .select("id, user_id, kind, title, body, read, created_at")
      .single();
    if (error) this.err("markNotificationRead", error);
    return rowToNotification(data as NotificationRow);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const { error } = await this.sb
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) this.err("markAllNotificationsRead", error);
  }

  // ── Extensions ─────────────────────────────────────────────────────────
  async requestExtension(input: {
    taskId: string;
    requestedById: string;
    newDeadline: string;
    reason: string;
  }): Promise<ExtensionRequest> {
    const { data, error } = await this.sb
      .from("extension_requests")
      .insert({
        task_id: input.taskId,
        requested_by_id: input.requestedById,
        new_deadline: input.newDeadline,
        reason: input.reason,
        status: "pending",
      })
      .select(
        "id, task_id, requested_by_id, new_deadline, reason, status, decided_by_id, decided_at, created_at"
      )
      .single();
    if (error) this.err("requestExtension", error);
    return rowToExtension(data as ExtensionRow);
  }

  async decideExtension(input: {
    taskId: string;
    decidedById: string;
    approve: boolean;
  }): Promise<void> {
    // Find the pending request for this task.
    const { data: pending, error: e1 } = await this.sb
      .from("extension_requests")
      .select(
        "id, task_id, requested_by_id, new_deadline, reason, status, decided_by_id, decided_at, created_at"
      )
      .eq("task_id", input.taskId)
      .eq("status", "pending")
      .maybeSingle();
    if (e1) this.err("decideExtension(find)", e1);
    if (!pending) return;
    const now = new Date().toISOString();
    const { error: e2 } = await this.sb
      .from("extension_requests")
      .update({
        status: input.approve ? "approved" : "denied",
        decided_by_id: input.decidedById,
        decided_at: now,
      })
      .eq("id", (pending as ExtensionRow).id);
    if (e2) this.err("decideExtension(update)", e2);
    if (input.approve) {
      const { error: e3 } = await this.sb
        .from("tasks")
        .update({ deadline: (pending as ExtensionRow).new_deadline })
        .eq("id", input.taskId);
      if (e3) this.err("decideExtension(roll deadline)", e3);
    }
  }

  // ── Moderation reports ─────────────────────────────────────────────────
  async listModerationReports(filter?: {
    status?: ModerationReportZ["status"];
  }): Promise<ModerationReportZ[]> {
    let q = this.sb
      .from("moderation_reports")
      .select(
        "id, message_id, conversation_id, reported_user_id, reporter_id, reason, reporter_note, status, severity, resolved_by_id, resolved_at, internal_note, created_at, updated_at"
      );
    if (filter?.status) q = q.eq("status", filter.status);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) this.err("listModerationReports", error);
    return (data ?? []).map((r) => rowToReport(r as ModerationRow));
  }

  async createModerationReport(input: {
    messageId: string;
    reporterId: string;
    reason: ModerationReportZ["reason"];
    reporterNote?: string;
    severity?: ModerationReportZ["severity"];
  }): Promise<ModerationReportZ> {
    // Resolve reported_user_id and conversation_id from the message row.
    const { data: msg, error: mErr } = await this.sb
      .from("messages")
      .select("id, author_id, conversation_id")
      .eq("id", input.messageId)
      .single();
    if (mErr) this.err("createModerationReport(message)", mErr);
    const m = msg as { author_id: string; conversation_id: string };

    const { data, error } = await this.sb
      .from("moderation_reports")
      .upsert(
        {
          message_id: input.messageId,
          conversation_id: m.conversation_id,
          reported_user_id: m.author_id,
          reporter_id: input.reporterId,
          reason: input.reason,
          reporter_note: input.reporterNote ?? null,
          severity: input.severity ?? "medium",
          status: "open",
        },
        { onConflict: "message_id,reporter_id" }
      )
      .select(
        "id, message_id, conversation_id, reported_user_id, reporter_id, reason, reporter_note, status, severity, resolved_by_id, resolved_at, internal_note, created_at, updated_at"
      )
      .single();
    if (error) this.err("createModerationReport", error);
    return rowToReport(data as ModerationRow);
  }

  async updateModerationReport(
    id: string,
    patch: {
      status?: ModerationReportZ["status"];
      severity?: ModerationReportZ["severity"];
      internalNote?: string;
      resolvedById?: string;
    }
  ): Promise<ModerationReportZ> {
    const update: Record<string, unknown> = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.severity !== undefined) update.severity = patch.severity;
    if (patch.internalNote !== undefined)
      update.internal_note = patch.internalNote;
    if (patch.resolvedById !== undefined)
      update.resolved_by_id = patch.resolvedById;
    if (
      patch.status === "resolved" ||
      patch.status === "dismissed"
    ) {
      update.resolved_at = new Date().toISOString();
    }
    const { data, error } = await this.sb
      .from("moderation_reports")
      .update(update)
      .eq("id", id)
      .select(
        "id, message_id, conversation_id, reported_user_id, reporter_id, reason, reporter_note, status, severity, resolved_by_id, resolved_at, internal_note, created_at, updated_at"
      )
      .single();
    if (error) this.err("updateModerationReport", error);
    return rowToReport(data as ModerationRow);
  }

  async bulkUpdateModerationReports(
    ids: string[],
    patch: {
      status?: ModerationReportZ["status"];
      severity?: ModerationReportZ["severity"];
      internalNote?: string;
      resolvedById?: string;
    }
  ): Promise<ModerationReportZ[]> {
    if (ids.length === 0) return [];
    const update: Record<string, unknown> = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.severity !== undefined) update.severity = patch.severity;
    if (patch.internalNote !== undefined)
      update.internal_note = patch.internalNote;
    if (patch.resolvedById !== undefined)
      update.resolved_by_id = patch.resolvedById;
    if (patch.status === "resolved" || patch.status === "dismissed") {
      update.resolved_at = new Date().toISOString();
    }
    const { data, error } = await this.sb
      .from("moderation_reports")
      .update(update)
      .in("id", ids)
      .select(
        "id, message_id, conversation_id, reported_user_id, reporter_id, reason, reporter_note, status, severity, resolved_by_id, resolved_at, internal_note, created_at, updated_at"
      );
    if (error) this.err("bulkUpdateModerationReports", error);
    return (data ?? []).map((r) => rowToReport(r as ModerationRow));
  }

  async hideMessage(messageId: string): Promise<MessageZ> {
    const { data: existing, error: e1 } = await this.sb
      .from("messages")
      .select("hidden_at")
      .eq("id", messageId)
      .single();
    if (e1) this.err("hideMessage(read)", e1);
    const next = (existing as { hidden_at: string | null }).hidden_at
      ? null
      : new Date().toISOString();
    const { data, error } = await this.sb
      .from("messages")
      .update({ hidden_at: next })
      .eq("id", messageId)
      .select(
        "id, conversation_id, author_id, body, pinned_at, hidden_at, created_at"
      )
      .single();
    if (error) this.err("hideMessage", error);
    return rowToMessage(data as MessageRow);
  }
}
