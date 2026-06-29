/**
 * Data hooks — the UI's contract with the API.
 *
 * Components should call these hooks instead of touching `useStore` directly.
 * Today they read through the MockAdapter (still in-memory and synchronous).
 * Tomorrow they will read through the HttpAdapter without any UI changes.
 */
"use client";

import { useApiClient } from "@/lib/api/provider";
import { useApiResource, type ApiResource } from "./use-api-resource";

export { useRealtimeRefetch } from "./use-realtime";
import { visibleTasks } from "@/lib/visibility";
import { useSession } from "@/lib/session";
import type {
  CommentZ,
  ConversationZ,
  EditorialChecklistZ,
  FeedbackStatusZ,
  FeedbackZ,
  IssueSlotZ,
  IssueZ,
  MessageZ,
  ModerationReportZ,
  NotificationZ,
  PitchStatusZ,
  PitchZ,
  ReviewZ,
  SectionZ,
  SensitiveFlagZ,
  SubmissionZ,
  TaskZ,
  UserZ,
} from "@/lib/contracts";

// ── Users ───────────────────────────────────────────────────────────────────
export function useUsers(): ApiResource<UserZ[]> {
  const api = useApiClient();
  return useApiResource(() => api.listUsers(), [api]);
}

// ── Tasks ───────────────────────────────────────────────────────────────────
export function useTasks(): ApiResource<TaskZ[]> {
  const api = useApiClient();
  return useApiResource(() => api.listTasks(), [api]);
}

/**
 * Tasks visible to the current session user, applying role-based filtering.
 * Convenience wrapper most pages want.
 */
export function useVisibleTasks(): ApiResource<TaskZ[]> {
  const { data, loading, error, refetch } = useTasks();
  const { currentUser } = useSession();

  const filtered =
    data && currentUser
      ? visibleTasks({ tasks: data, role: currentUser.role, userId: currentUser.id })
      : data;
  return { data: filtered, loading, error, refetch };
}

export function useTask(id: string | null): ApiResource<TaskZ | null> {
  const api = useApiClient();
  return useApiResource(
    () => (id ? api.getTask(id) : Promise.resolve(null)),
    [api, id]
  );
}

// ── Submissions ─────────────────────────────────────────────────────────────
export function useSubmissions(taskId?: string): ApiResource<SubmissionZ[]> {
  const api = useApiClient();
  // No task scope → no submissions (rather than a list-everything fetch). The
  // drawer passes `undefined` while closed; this keeps that a cheap no-op.
  return useApiResource(
    () => (taskId ? api.listSubmissions(taskId) : Promise.resolve([])),
    [api, taskId]
  );
}

// ── Reviews ─────────────────────────────────────────────────────────────────
export function useReviews(submissionId?: string): ApiResource<ReviewZ[]> {
  const api = useApiClient();
  return useApiResource(() => api.listReviews(submissionId), [api, submissionId]);
}

// ── Comments ────────────────────────────────────────────────────────────────
export function useComments(submissionId?: string): ApiResource<CommentZ[]> {
  const api = useApiClient();
  // No submission scope → no comments. Both callers (comments panel + inline
  // viewer) read per-submission, so skip the list-everything fetch.
  return useApiResource(
    () => (submissionId ? api.listComments(submissionId) : Promise.resolve([])),
    [api, submissionId]
  );
}

// ── Conversations + Messages ────────────────────────────────────────────────
export function useConversations(): ApiResource<ConversationZ[]> {
  const api = useApiClient();
  return useApiResource(() => api.listConversations(), [api]);
}

export function useMessages(conversationId?: string): ApiResource<MessageZ[]> {
  const api = useApiClient();
  return useApiResource(
    () => api.listMessages(conversationId),
    [api, conversationId]
  );
}

// ── Notifications ───────────────────────────────────────────────────────────
export function useNotifications(): ApiResource<NotificationZ[]> {
  const api = useApiClient();
  const { currentUser } = useSession();
  return useApiResource(
    () => api.listNotifications(currentUser?.id),
    [api, currentUser?.id]
  );
}

// ── Moderation reports ──────────────────────────────────────────────────────
export function useModerationReports(filter?: {
  status?: ModerationReportZ["status"];
}): ApiResource<ModerationReportZ[]> {
  const api = useApiClient();
  return useApiResource(
    () => api.listModerationReports(filter),
    [api, filter?.status]
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────
export function useFeedback(filter?: {
  status?: FeedbackStatusZ;
  authorId?: string;
}): ApiResource<FeedbackZ[]> {
  const api = useApiClient();
  return useApiResource(
    () => api.listFeedback(filter),
    [api, filter?.status, filter?.authorId]
  );
}

// ── Calendar events ─────────────────────────────────────────────────────────
/**
 * Calendar events are derived from task deadlines (visibility-filtered).
 * Returning the source tasks keeps the calendar UI's filtering logic
 * untouched while still routing through the API surface.
 */
export function useCalendarEvents(): ApiResource<TaskZ[]> {
  return useVisibleTasks();
}

// ── Newsroom: sections / pitches / issues / slots / checklists / flags ─────
//
// These hooks read through the active ApiClient (mock or Supabase). The
// existing newsroom pages still read directly from `useStore()` to keep
// optimistic in-memory updates snappy; these hooks are the migration path
// for moving those reads onto persisted backends without touching the UI.
export function useSections(): ApiResource<SectionZ[]> {
  const api = useApiClient();
  return useApiResource(() => api.listSections(), [api]);
}

export function usePitches(filter?: {
  writerId?: string;
  status?: PitchStatusZ;
}): ApiResource<PitchZ[]> {
  const api = useApiClient();
  return useApiResource(
    () => api.listPitches(filter),
    [api, filter?.writerId, filter?.status]
  );
}

export function useIssues(): ApiResource<IssueZ[]> {
  const api = useApiClient();
  return useApiResource(() => api.listIssues(), [api]);
}

export function useIssueSlots(issueId?: string): ApiResource<IssueSlotZ[]> {
  const api = useApiClient();
  return useApiResource(() => api.listIssueSlots(issueId), [api, issueId]);
}

export function useEditorialChecklist(
  taskId: string | null
): ApiResource<EditorialChecklistZ | null> {
  const api = useApiClient();
  return useApiResource(
    () =>
      taskId
        ? api.getEditorialChecklist(taskId)
        : Promise.resolve(null),
    [api, taskId]
  );
}

/**
 * Bulk checklist read. Used by surfaces that derive readiness for many
 * stories at once (the Issues planning page). Pass `taskIds` to scope the
 * fetch; omit to fetch all.
 */
export function useChecklists(
  taskIds?: string[]
): ApiResource<EditorialChecklistZ[]> {
  const api = useApiClient();
  // Stable cache key so re-renders with the same id set don't refetch.
  const key = taskIds ? taskIds.slice().sort().join(",") : "*";
  return useApiResource(() => api.listChecklists(taskIds), [api, key]);
}

export function useSensitiveFlags(filter?: {
  status?: SensitiveFlagZ["status"];
  taskId?: string;
}): ApiResource<SensitiveFlagZ[]> {
  const api = useApiClient();
  return useApiResource(
    () => api.listSensitiveFlags(filter),
    [api, filter?.status, filter?.taskId]
  );
}
