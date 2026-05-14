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
  AssignmentBriefZ,
  CommentZ,
  ConversationZ,
  EditorialChecklistZ,
  IssueSlotZ,
  IssueZ,
  MessageZ,
  ModerationReportZ,
  NotificationZ,
  PitchZ,
  ReviewZ,
  SectionZ,
  SensitiveFlagZ,
  SubmissionZ,
  TaskZ,
  UserZ,
} from "@/lib/contracts";
import type { ChecklistItem, ExtensionRequest } from "@/lib/types";
import { defaultChecklistItems } from "@/lib/mock-data";

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
  // newsroom (additive — present only after migration 0002)
  section_id?: string | null;
  pitch_id?: string | null;
  issue_id?: string | null;
  copy_editor_id?: string | null;
  fact_checker_id?: string | null;
  slug?: string | null;
  assignment_brief?: AssignmentBriefZ | Record<string, never> | null;
  word_count_actual?: number | null;
};

const TASK_COLUMNS =
  "id, title, instructions, writer_id, editor_id, deadline, status, color, current_submission_id, word_count_target, citations_required, created_at, section_id, pitch_id, issue_id, copy_editor_id, fact_checker_id, slug, assignment_brief, word_count_actual";

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

function rowToTask(
  r: TaskRow,
  ext?: ExtensionRow | null,
  sensitive?: SensitiveFlagRow | null
): TaskZ {
  const briefRaw = r.assignment_brief ?? null;
  const brief =
    briefRaw && typeof briefRaw === "object" && Object.keys(briefRaw).length > 0
      ? (briefRaw as AssignmentBriefZ)
      : undefined;

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
    sectionId: r.section_id ?? undefined,
    pitchId: r.pitch_id ?? undefined,
    issueId: r.issue_id ?? undefined,
    copyEditorId: r.copy_editor_id ?? undefined,
    factCheckerId: r.fact_checker_id ?? undefined,
    slug: r.slug ?? undefined,
    brief,
    wordCountActual: r.word_count_actual ?? undefined,
    sensitive: sensitive ? rowToSensitive(sensitive) : undefined,
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

// ── newsroom row types ────────────────────────────────────────────────────
type SectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
};

function rowToSection(r: SectionRow): SectionZ {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    accent: r.accent,
  };
}

type PitchRow = {
  id: string;
  proposed_headline: string;
  section_id: string;
  angle: string;
  why_now: string;
  proposed_sources: string[] | null;
  expected_word_count: number | null;
  deadline_pref: string | null;
  writer_note: string | null;
  writer_id: string;
  status: PitchZ["status"];
  editor_note: string | null;
  decided_by_id: string | null;
  decided_at: string | null;
  task_id: string | null;
  created_at: string;
};

function rowToPitch(r: PitchRow): PitchZ {
  return {
    id: r.id,
    proposedHeadline: r.proposed_headline,
    sectionId: r.section_id,
    angle: r.angle,
    whyNow: r.why_now,
    proposedSources: r.proposed_sources ?? [],
    expectedWordCount: r.expected_word_count ?? undefined,
    deadlinePref: r.deadline_pref ?? undefined,
    writerNote: r.writer_note ?? undefined,
    writerId: r.writer_id,
    status: r.status,
    editorNote: r.editor_note ?? undefined,
    decidedById: r.decided_by_id ?? undefined,
    decidedAt: r.decided_at ?? undefined,
    taskId: r.task_id ?? undefined,
    createdAt: r.created_at,
  };
}

type IssueRow = {
  id: string;
  number: number;
  name: string;
  publish_date: string;
  status: IssueZ["status"];
  notes: string | null;
};

function rowToIssue(r: IssueRow): IssueZ {
  return {
    id: r.id,
    number: r.number,
    name: r.name,
    publishDate: r.publish_date,
    status: r.status,
    notes: r.notes ?? undefined,
  };
}

type IssueSlotRow = {
  id: string;
  issue_id: string;
  task_id: string;
  priority: IssueSlotZ["priority"];
};

function rowToIssueSlot(r: IssueSlotRow): IssueSlotZ {
  return {
    id: r.id,
    issueId: r.issue_id,
    taskId: r.task_id,
    priority: r.priority,
  };
}

type EditorialChecklistRow = {
  task_id: string;
  items: ChecklistItem[] | null;
  updated_at: string;
};

function rowToChecklist(r: EditorialChecklistRow): EditorialChecklistZ {
  return {
    taskId: r.task_id,
    items: (r.items ?? []) as ChecklistItem[],
    updatedAt: r.updated_at,
  };
}

type SensitiveFlagRow = {
  id: string;
  task_id: string;
  reason: SensitiveFlagZ["reason"];
  notes: string;
  status: SensitiveFlagZ["status"];
  raised_by_id: string;
  raised_at: string;
  decided_by_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
};

function rowToSensitive(r: SensitiveFlagRow): SensitiveFlagZ {
  return {
    id: r.id,
    taskId: r.task_id,
    reason: r.reason,
    notes: r.notes,
    status: r.status,
    raisedById: r.raised_by_id,
    raisedAt: r.raised_at,
    decidedById: r.decided_by_id ?? undefined,
    decidedAt: r.decided_at ?? undefined,
    decisionNote: r.decision_note ?? undefined,
  };
}

const SENSITIVE_COLUMNS =
  "id, task_id, reason, notes, status, raised_by_id, raised_at, decided_by_id, decided_at, decision_note";

const PITCH_COLUMNS =
  "id, proposed_headline, section_id, angle, why_now, proposed_sources, expected_word_count, deadline_pref, writer_note, writer_id, status, editor_note, decided_by_id, decided_at, task_id, created_at";

const ISSUE_COLUMNS = "id, number, name, publish_date, status, notes";

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

  /**
   * Refuse a mutation that claims an actor id different from the signed-in
   * user. RLS already enforces role membership, but only this check stops
   * a leader from attributing a decision to a different leader, etc.
   * Once we ship `with check (actor_id = auth.uid())` in RLS, this becomes
   * defence-in-depth; until then it is the only guard.
   */
  private assertSelf(method: string, actorId: string | null | undefined): void {
    if (!actorId) return;
    if (!this.currentUserId) {
      throw new ApiError(
        `SupabaseApiClient.${method}: no signed-in user to act as`,
        401
      );
    }
    if (actorId !== this.currentUserId) {
      throw new ApiError(
        `SupabaseApiClient.${method}: actor id ${actorId} does not match the signed-in user`,
        403
      );
    }
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
    // Admins cannot demote themselves — the UI hides the control too, but
    // this is the API-level guard so a crafted request can't lock the
    // last admin out of the portal.
    if (this.currentUserId && id === this.currentUserId) {
      throw new ApiError(
        "SupabaseApiClient.updateUserRole: admins cannot change their own role",
        403
      );
    }
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
    // Admins cannot deactivate themselves — same reasoning as above.
    if (this.currentUserId && id === this.currentUserId) {
      throw new ApiError(
        "SupabaseApiClient.setUserActive: admins cannot deactivate themselves",
        403
      );
    }
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

  /** Load the most-recent flag per task. Most-recent open or holding wins;
   *  if none, the most recent cleared flag still surfaces so the UI shows
   *  the historical decision state. */
  private async loadLatestSensitiveFlags(
    taskIds: string[]
  ): Promise<Map<string, SensitiveFlagRow>> {
    if (taskIds.length === 0) return new Map();
    const { data, error } = await this.sb
      .from("sensitive_flags")
      .select(SENSITIVE_COLUMNS)
      .in("task_id", taskIds)
      .order("raised_at", { ascending: false });
    if (error) this.err("loadLatestSensitiveFlags", error);
    const out = new Map<string, SensitiveFlagRow>();
    for (const row of (data ?? []) as SensitiveFlagRow[]) {
      // keep the first (most recent) per task
      if (!out.has(row.task_id)) out.set(row.task_id, row);
    }
    return out;
  }

  async listTasks(): Promise<TaskZ[]> {
    const { data, error } = await this.sb
      .from("tasks")
      .select(TASK_COLUMNS)
      .order("deadline");
    if (error) this.err("listTasks", error);
    const rows = (data ?? []) as TaskRow[];
    const ids = rows.map((r) => r.id);
    const [exts, flags] = await Promise.all([
      this.loadPendingExtensions(ids),
      this.loadLatestSensitiveFlags(ids),
    ]);
    return rows.map((r) =>
      rowToTask(r, exts.get(r.id) ?? null, flags.get(r.id) ?? null)
    );
  }

  async getTask(id: string): Promise<TaskZ | null> {
    const { data, error } = await this.sb
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) this.err("getTask", error);
    if (!data) return null;
    const [exts, flags] = await Promise.all([
      this.loadPendingExtensions([id]),
      this.loadLatestSensitiveFlags([id]),
    ]);
    return rowToTask(
      data as TaskRow,
      exts.get(id) ?? null,
      flags.get(id) ?? null
    );
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
      .select(TASK_COLUMNS)
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
      .select(TASK_COLUMNS)
      .single();
    if (error) this.err("updateTask", error);
    return rowToTask(data as TaskRow);
  }

  async setTaskStatus(id: string, status: TaskZ["status"]): Promise<TaskZ> {
    const { data, error } = await this.sb
      .from("tasks")
      .update({ status })
      .eq("id", id)
      .select(TASK_COLUMNS)
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
    this.assertSelf("requestExtension", input.requestedById);
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
    this.assertSelf("decideExtension", input.decidedById);
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
    this.assertSelf("createModerationReport", input.reporterId);
    // Resolve reported_user_id and conversation_id from the message row.
    const { data: msg, error: mErr } = await this.sb
      .from("messages")
      .select("id, author_id, conversation_id")
      .eq("id", input.messageId)
      .single();
    if (mErr) this.err("createModerationReport(message)", mErr);
    const m = msg as { author_id: string; conversation_id: string };

    // Severity is curated by moderators, not reporters: ignoring any
    // client-supplied value so a reporter can't auto-escalate their own
    // report to "high" priority. Triage happens in the moderation queue.
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
          severity: "medium",
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
    this.assertSelf("updateModerationReport", patch.resolvedById);
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
    this.assertSelf("bulkUpdateModerationReports", patch.resolvedById);
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

  // ── Newsroom: sections ─────────────────────────────────────────────────
  async listSections(): Promise<SectionZ[]> {
    const { data, error } = await this.sb
      .from("sections")
      .select("id, slug, name, description, accent")
      .order("name");
    if (error) this.err("listSections", error);
    return (data ?? []).map((r) => rowToSection(r as SectionRow));
  }

  // ── Newsroom: pitches ──────────────────────────────────────────────────
  async listPitches(filter?: {
    writerId?: string;
    status?: PitchZ["status"];
  }): Promise<PitchZ[]> {
    let q = this.sb.from("pitches").select(PITCH_COLUMNS);
    if (filter?.writerId) q = q.eq("writer_id", filter.writerId);
    if (filter?.status) q = q.eq("status", filter.status);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) this.err("listPitches", error);
    return (data ?? []).map((r) => rowToPitch(r as PitchRow));
  }

  async createPitch(input: {
    proposedHeadline: string;
    sectionId: string;
    angle: string;
    whyNow: string;
    proposedSources: string[];
    expectedWordCount?: number;
    deadlinePref?: string;
    writerNote?: string;
    writerId: string;
  }): Promise<PitchZ> {
    this.assertSelf("createPitch", input.writerId);
    const { data, error } = await this.sb
      .from("pitches")
      .insert({
        proposed_headline: input.proposedHeadline,
        section_id: input.sectionId,
        angle: input.angle,
        why_now: input.whyNow,
        proposed_sources: input.proposedSources ?? [],
        expected_word_count: input.expectedWordCount ?? null,
        deadline_pref: input.deadlinePref ?? null,
        writer_note: input.writerNote ?? null,
        writer_id: input.writerId,
        status: "submitted",
      })
      .select(PITCH_COLUMNS)
      .single();
    if (error) this.err("createPitch", error);
    return rowToPitch(data as PitchRow);
  }

  async decidePitch(input: {
    pitchId: string;
    decidedById: string;
    accept: boolean;
    note?: string;
  }): Promise<PitchZ> {
    this.assertSelf("decidePitch", input.decidedById);
    const { data, error } = await this.sb
      .from("pitches")
      .update({
        status: input.accept ? "accepted" : "declined",
        editor_note: input.note ?? null,
        decided_by_id: input.decidedById,
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.pitchId)
      .select(PITCH_COLUMNS)
      .single();
    if (error) this.err("decidePitch", error);
    return rowToPitch(data as PitchRow);
  }

  async convertPitch(input: {
    pitchId: string;
    editorId?: string;
    deadline: string;
    leaderId: string;
    issueId?: string;
  }): Promise<TaskZ> {
    this.assertSelf("convertPitch", input.leaderId);
    // Load the pitch first so we can copy the brief / sources across.
    const { data: pdata, error: pErr } = await this.sb
      .from("pitches")
      .select(PITCH_COLUMNS)
      .eq("id", input.pitchId)
      .maybeSingle();
    if (pErr) this.err("convertPitch(read)", pErr);
    const pitchRow = pdata as PitchRow | null;
    if (!pitchRow)
      throw new ApiError(`Pitch ${input.pitchId} not found`, 404);
    if (pitchRow.status === "converted")
      throw new ApiError(
        `Pitch ${input.pitchId} already converted`,
        409
      );

    const instructions = [
      pitchRow.angle && `Angle: ${pitchRow.angle}`,
      pitchRow.why_now && `Why now: ${pitchRow.why_now}`,
      (pitchRow.proposed_sources ?? []).length
        ? `Proposed sources:\n- ${(pitchRow.proposed_sources ?? []).join("\n- ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const brief: AssignmentBriefZ = {
      angle: pitchRow.angle || undefined,
      requiredSources: (pitchRow.proposed_sources ?? []).length
        ? (pitchRow.proposed_sources ?? [])
        : undefined,
      publishingNotes: pitchRow.writer_note ?? undefined,
    };

    const { data: tdata, error: tErr } = await this.sb
      .from("tasks")
      .insert({
        title: pitchRow.proposed_headline,
        instructions,
        writer_id: pitchRow.writer_id,
        editor_id: input.editorId ?? null,
        deadline: input.deadline,
        color: "green",
        word_count_target: pitchRow.expected_word_count ?? null,
        section_id: pitchRow.section_id,
        pitch_id: pitchRow.id,
        issue_id: input.issueId ?? null,
        assignment_brief: brief,
      })
      .select(TASK_COLUMNS)
      .single();
    if (tErr) this.err("convertPitch(insert task)", tErr);
    const task = tdata as TaskRow;

    const { error: pUpdErr } = await this.sb
      .from("pitches")
      .update({
        status: "converted",
        task_id: task.id,
        decided_by_id: input.leaderId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.pitchId);
    if (pUpdErr) this.err("convertPitch(mark converted)", pUpdErr);

    if (input.issueId) {
      const { error: slotErr } = await this.sb
        .from("issue_slots")
        .upsert(
          {
            issue_id: input.issueId,
            task_id: task.id,
            priority: "nice_to_run",
          },
          { onConflict: "issue_id,task_id" }
        );
      if (slotErr) this.err("convertPitch(slot)", slotErr);
    }

    return rowToTask(task);
  }

  // ── Newsroom: issues ──────────────────────────────────────────────────
  async listIssues(): Promise<IssueZ[]> {
    const { data, error } = await this.sb
      .from("issues")
      .select(ISSUE_COLUMNS)
      .order("publish_date");
    if (error) this.err("listIssues", error);
    return (data ?? []).map((r) => rowToIssue(r as IssueRow));
  }

  async getIssue(id: string): Promise<IssueZ | null> {
    const { data, error } = await this.sb
      .from("issues")
      .select(ISSUE_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) this.err("getIssue", error);
    return data ? rowToIssue(data as IssueRow) : null;
  }

  async updateIssue(
    id: string,
    patch: {
      number?: number;
      name?: string;
      publishDate?: string;
      status?: IssueZ["status"];
      notes?: string;
    }
  ): Promise<IssueZ> {
    const update: Record<string, unknown> = {};
    if (patch.number !== undefined) update.number = patch.number;
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.publishDate !== undefined)
      update.publish_date = patch.publishDate;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.notes !== undefined) update.notes = patch.notes;
    const { data, error } = await this.sb
      .from("issues")
      .update(update)
      .eq("id", id)
      .select(ISSUE_COLUMNS)
      .single();
    if (error) this.err("updateIssue", error);
    return rowToIssue(data as IssueRow);
  }

  async publishIssue(id: string): Promise<IssueZ> {
    // 1) Mark the issue itself published.
    const { data, error } = await this.sb
      .from("issues")
      .update({ status: "published" })
      .eq("id", id)
      .select(ISSUE_COLUMNS)
      .single();
    if (error) this.err("publishIssue", error);
    // 2) Promote every still-open slotted task to complete so the derived
    //    stage helper renders it as "published". Mock parity.
    const { data: slotData, error: slotErr } = await this.sb
      .from("issue_slots")
      .select("task_id")
      .eq("issue_id", id);
    if (slotErr) this.err("publishIssue(slots)", slotErr);
    const taskIds = ((slotData ?? []) as { task_id: string }[]).map(
      (r) => r.task_id
    );
    if (taskIds.length > 0) {
      const { error: tErr } = await this.sb
        .from("tasks")
        .update({ status: "complete" })
        .in("id", taskIds)
        .neq("status", "complete");
      if (tErr) this.err("publishIssue(promote)", tErr);
    }
    return rowToIssue(data as IssueRow);
  }

  // ── Newsroom: issue slots ─────────────────────────────────────────────
  async listIssueSlots(issueId?: string): Promise<IssueSlotZ[]> {
    let q = this.sb
      .from("issue_slots")
      .select("id, issue_id, task_id, priority");
    if (issueId) q = q.eq("issue_id", issueId);
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) this.err("listIssueSlots", error);
    return (data ?? []).map((r) => rowToIssueSlot(r as IssueSlotRow));
  }

  async upsertIssueSlot(input: {
    issueId: string;
    taskId: string;
    priority?: IssueSlotZ["priority"];
  }): Promise<IssueSlotZ> {
    const { data, error } = await this.sb
      .from("issue_slots")
      .upsert(
        {
          issue_id: input.issueId,
          task_id: input.taskId,
          priority: input.priority ?? "nice_to_run",
        },
        { onConflict: "issue_id,task_id" }
      )
      .select("id, issue_id, task_id, priority")
      .single();
    if (error) this.err("upsertIssueSlot", error);
    // Also attach the issue back onto the task for convenience.
    const { error: tErr } = await this.sb
      .from("tasks")
      .update({ issue_id: input.issueId })
      .eq("id", input.taskId);
    if (tErr) this.err("upsertIssueSlot(attach task)", tErr);
    return rowToIssueSlot(data as IssueSlotRow);
  }

  async removeIssueSlot(id: string): Promise<void> {
    // Find the row first so we can detach the matching issue from the task.
    const { data: existing, error: e1 } = await this.sb
      .from("issue_slots")
      .select("id, issue_id, task_id, priority")
      .eq("id", id)
      .maybeSingle();
    if (e1) this.err("removeIssueSlot(read)", e1);
    if (!existing) return;
    const slot = existing as IssueSlotRow;
    const { error: e2 } = await this.sb
      .from("issue_slots")
      .delete()
      .eq("id", id);
    if (e2) this.err("removeIssueSlot(delete)", e2);
    const { error: e3 } = await this.sb
      .from("tasks")
      .update({ issue_id: null })
      .eq("id", slot.task_id)
      .eq("issue_id", slot.issue_id);
    if (e3) this.err("removeIssueSlot(detach task)", e3);
  }

  // ── Newsroom: editorial checklists ────────────────────────────────────
  async getEditorialChecklist(
    taskId: string
  ): Promise<EditorialChecklistZ | null> {
    const { data, error } = await this.sb
      .from("editorial_checklists")
      .select("task_id, items, updated_at")
      .eq("task_id", taskId)
      .maybeSingle();
    if (error) this.err("getEditorialChecklist", error);
    return data ? rowToChecklist(data as EditorialChecklistRow) : null;
  }

  async listChecklists(taskIds?: string[]): Promise<EditorialChecklistZ[]> {
    let q = this.sb
      .from("editorial_checklists")
      .select("task_id, items, updated_at");
    if (taskIds && taskIds.length > 0) q = q.in("task_id", taskIds);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) this.err("listChecklists", error);
    return (data ?? []).map((r) => rowToChecklist(r as EditorialChecklistRow));
  }

  async updateChecklistItem(input: {
    taskId: string;
    key: string;
    by: string;
    checked?: boolean;
  }): Promise<EditorialChecklistZ> {
    // Read existing checklist (or seed defaults from the task).
    const { data: existing, error: rErr } = await this.sb
      .from("editorial_checklists")
      .select("task_id, items, updated_at")
      .eq("task_id", input.taskId)
      .maybeSingle();
    if (rErr) this.err("updateChecklistItem(read)", rErr);

    let items: ChecklistItem[];
    if (existing) {
      items = ((existing as EditorialChecklistRow).items ??
        []) as ChecklistItem[];
    } else {
      // Determine business/sensitive groups from the task (mock parity).
      const { data: tdata, error: tErr } = await this.sb
        .from("tasks")
        .select("section_id")
        .eq("id", input.taskId)
        .maybeSingle();
      if (tErr) this.err("updateChecklistItem(read task)", tErr);
      const sectionId = (tdata as { section_id: string | null } | null)
        ?.section_id;
      // Pull the section slug to decide if it's business/markets.
      let isBusiness = false;
      if (sectionId) {
        const { data: sdata } = await this.sb
          .from("sections")
          .select("slug")
          .eq("id", sectionId)
          .maybeSingle();
        const slug = (sdata as { slug: string } | null)?.slug;
        isBusiness = slug === "business" || slug === "markets";
      }
      // If a sensitive flag is open/holding, include that group too.
      const { data: flagData } = await this.sb
        .from("sensitive_flags")
        .select("id, status")
        .eq("task_id", input.taskId)
        .in("status", ["open", "holding"])
        .limit(1);
      const isSensitive = ((flagData ?? []) as unknown[]).length > 0;
      items = defaultChecklistItems({ isBusiness, isSensitive });
    }

    const now = new Date().toISOString();
    const nextItems = items.map((it): ChecklistItem => {
      if (it.key !== input.key) return it;
      const checked =
        input.checked !== undefined ? input.checked : !it.checked;
      return {
        ...it,
        checked,
        checkedById: checked ? input.by : undefined,
        checkedAt: checked ? now : undefined,
      };
    });

    const { data, error } = await this.sb
      .from("editorial_checklists")
      .upsert(
        { task_id: input.taskId, items: nextItems, updated_at: now },
        { onConflict: "task_id" }
      )
      .select("task_id, items, updated_at")
      .single();
    if (error) this.err("updateChecklistItem(write)", error);
    return rowToChecklist(data as EditorialChecklistRow);
  }

  // ── Newsroom: sensitive flags ─────────────────────────────────────────
  async listSensitiveFlags(filter?: {
    status?: SensitiveFlagZ["status"];
    taskId?: string;
  }): Promise<SensitiveFlagZ[]> {
    let q = this.sb.from("sensitive_flags").select(SENSITIVE_COLUMNS);
    if (filter?.status) q = q.eq("status", filter.status);
    if (filter?.taskId) q = q.eq("task_id", filter.taskId);
    const { data, error } = await q.order("raised_at", { ascending: false });
    if (error) this.err("listSensitiveFlags", error);
    return (data ?? []).map((r) => rowToSensitive(r as SensitiveFlagRow));
  }

  async raiseSensitiveFlag(input: {
    taskId: string;
    raisedById: string;
    reason: SensitiveFlagZ["reason"];
    notes: string;
  }): Promise<SensitiveFlagZ> {
    this.assertSelf("raiseSensitiveFlag", input.raisedById);
    const { data, error } = await this.sb
      .from("sensitive_flags")
      .insert({
        task_id: input.taskId,
        raised_by_id: input.raisedById,
        reason: input.reason,
        notes: input.notes,
        status: "open",
      })
      .select(SENSITIVE_COLUMNS)
      .single();
    if (error) this.err("raiseSensitiveFlag", error);

    // Mirror mock store: ensure the sensitive checklist group exists.
    try {
      const existing = await this.getEditorialChecklist(input.taskId);
      const hasSensitive = (existing?.items ?? []).some(
        (i) => i.group === "sensitive"
      );
      if (!hasSensitive) {
        const sensitiveItems = defaultChecklistItems({
          isBusiness: false,
          isSensitive: true,
        }).filter((i) => i.group === "sensitive");
        const merged: ChecklistItem[] = [
          ...(existing?.items ?? []),
          ...sensitiveItems,
        ];
        if (existing) {
          await this.sb
            .from("editorial_checklists")
            .update({ items: merged, updated_at: new Date().toISOString() })
            .eq("task_id", input.taskId);
        } else {
          // No checklist yet — seed defaults including the sensitive group.
          const seeded = defaultChecklistItems({
            isBusiness: false,
            isSensitive: true,
          });
          await this.sb
            .from("editorial_checklists")
            .insert({
              task_id: input.taskId,
              items: seeded,
              updated_at: new Date().toISOString(),
            });
        }
      }
    } catch {
      // Non-fatal — the flag is already saved.
    }

    return rowToSensitive(data as SensitiveFlagRow);
  }

  async decideSensitiveFlag(input: {
    taskId: string;
    decidedById: string;
    status: "cleared" | "holding";
    note?: string;
  }): Promise<SensitiveFlagZ> {
    this.assertSelf("decideSensitiveFlag", input.decidedById);
    // Pick the most recent active flag for the task.
    const { data: pending, error: e1 } = await this.sb
      .from("sensitive_flags")
      .select(SENSITIVE_COLUMNS)
      .eq("task_id", input.taskId)
      .order("raised_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e1) this.err("decideSensitiveFlag(read)", e1);
    const row = pending as SensitiveFlagRow | null;
    if (!row)
      throw new ApiError(
        `No sensitive flag on task ${input.taskId}`,
        404
      );
    const { data, error } = await this.sb
      .from("sensitive_flags")
      .update({
        status: input.status,
        decided_by_id: input.decidedById,
        decided_at: new Date().toISOString(),
        decision_note: input.note ?? null,
      })
      .eq("id", row.id)
      .select(SENSITIVE_COLUMNS)
      .single();
    if (error) this.err("decideSensitiveFlag(update)", error);
    return rowToSensitive(data as SensitiveFlagRow);
  }
}
