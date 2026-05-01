"use client";

/**
 * MockAdapter — bridges the typed `ApiClient` interface to the in-memory
 * `StoreProvider`. This lets the new hooks layer call API methods while the
 * UI continues to render from the existing store. When the HTTP backend
 * comes online, the adapter swaps and the rest of the codebase stays put.
 */
import { useMemo } from "react";
import { ApiError, type ApiClient } from "./client";
import { useStore } from "@/lib/store";
import type {
  Comment,
  EditorialChecklist,
  Issue,
  IssueSlot,
  ModerationReport,
  Notification,
  Pitch,
  Section,
  SensitiveFlag,
  Submission,
  User,
} from "@/lib/types";
import type {
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

/** Plain identity casts — the runtime shape already matches the schema. */
const asUser = (u: User): UserZ => ({ active: true, ...u });
const asTask = (t: import("@/lib/types").Task): TaskZ => t;
const asSubmission = (s: Submission): SubmissionZ => s;
const asReview = (r: import("@/lib/types").Review): ReviewZ => r;
const asComment = (c: Comment): CommentZ => c;
const asConversation = (c: import("@/lib/types").Conversation): ConversationZ =>
  c;
const asMessage = (m: import("@/lib/types").Message): MessageZ => m;
const asNotification = (n: Notification): NotificationZ => n;
const asReport = (r: ModerationReport): ModerationReportZ => r;
const asSection = (s: Section): SectionZ => s;
const asPitch = (p: Pitch): PitchZ => p;
const asIssue = (i: Issue): IssueZ => i;
const asIssueSlot = (s: IssueSlot): IssueSlotZ => s;
const asChecklist = (c: EditorialChecklist): EditorialChecklistZ => c;
const asFlag = (f: SensitiveFlag): SensitiveFlagZ => f;

/**
 * Build a mock ApiClient bound to the live store snapshot. Re-created on every
 * store change because the adapter closes over current state arrays.
 */
export function useMockApiClient(currentUserId: string | null): ApiClient {
  const store = useStore();

  return useMemo<ApiClient>(() => {
    return {
      // ── Identity ─────────────────────────────────────────────────────────
      async getCurrentUser() {
        if (!currentUserId) return null;
        const u = store.users.find((x) => x.id === currentUserId);
        return u ? asUser(u) : null;
      },

      // ── Users ────────────────────────────────────────────────────────────
      async listUsers() {
        return store.users.map(asUser);
      },
      async getUser(id) {
        const u = store.users.find((x) => x.id === id);
        return u ? asUser(u) : null;
      },
      async updateUserRole(id, role) {
        store.updateUserRole(id, role);
        const u = store.users.find((x) => x.id === id);
        if (!u) throw new Error(`User ${id} not found`);
        return asUser({ ...u, role });
      },
      async setUserActive(id, active) {
        store.setUserActive(id, active);
        const u = store.users.find((x) => x.id === id);
        if (!u) throw new Error(`User ${id} not found`);
        return asUser({ ...u, active });
      },

      // ── Tasks ────────────────────────────────────────────────────────────
      async listTasks() {
        return store.tasks.map(asTask);
      },
      async getTask(id) {
        const t = store.tasks.find((x) => x.id === id);
        return t ? asTask(t) : null;
      },
      async createTask(input) {
        const t = store.createTask(input);
        return asTask(t);
      },
      async updateTask(id, patch) {
        store.updateTask(id, patch);
        const t = store.tasks.find((x) => x.id === id);
        if (!t) throw new Error(`Task ${id} not found`);
        return asTask({ ...t, ...patch });
      },
      async setTaskStatus(id, status) {
        store.setTaskStatus(id, status);
        const t = store.tasks.find((x) => x.id === id);
        if (!t) throw new Error(`Task ${id} not found`);
        return asTask({ ...t, status });
      },

      // ── Submissions ──────────────────────────────────────────────────────
      async listSubmissions(taskId) {
        const all = store.submissions.map(asSubmission);
        return taskId ? all.filter((s) => s.taskId === taskId) : all;
      },
      async createSubmission(input) {
        return asSubmission(store.createSubmission(input));
      },

      // ── Reviews ──────────────────────────────────────────────────────────
      async listReviews(submissionId) {
        const all = store.reviews.map(asReview);
        return submissionId
          ? all.filter((r) => r.submissionId === submissionId)
          : all;
      },
      async createReview(input) {
        return asReview(store.submitReview(input));
      },

      // ── Comments ─────────────────────────────────────────────────────────
      async listComments(submissionId) {
        const all = store.comments.map(asComment);
        return submissionId
          ? all.filter((c) => c.submissionId === submissionId)
          : all;
      },
      async createComment(input) {
        return asComment(store.addComment(input));
      },
      async toggleResolveComment(id) {
        store.toggleResolveComment(id);
        const c = store.comments.find((x) => x.id === id);
        if (!c) throw new Error(`Comment ${id} not found`);
        return asComment({ ...c, resolved: !c.resolved });
      },

      // ── Conversations + Messages ─────────────────────────────────────────
      async listConversations() {
        return store.conversations.map(asConversation);
      },
      async createConversation(input) {
        return asConversation(store.createConversation(input));
      },
      async listMessages(conversationId) {
        const all = store.messages.map(asMessage);
        return conversationId
          ? all.filter((m) => m.conversationId === conversationId)
          : all;
      },
      async sendMessage(input) {
        return asMessage(store.sendMessage(input));
      },
      async togglePinMessage(id) {
        store.togglePinMessage(id);
        const m = store.messages.find((x) => x.id === id);
        if (!m) throw new Error(`Message ${id} not found`);
        return asMessage(m);
      },

      // ── Notifications ────────────────────────────────────────────────────
      async listNotifications(userId) {
        const all = store.notifications.map(asNotification);
        return userId ? all.filter((n) => n.userId === userId) : all;
      },
      async pushNotification(input) {
        store.pushNotification(input);
        const all = store.notifications;
        return asNotification(all[0]);
      },
      async markNotificationRead(id, read = true) {
        store.markNotificationRead(id, read);
        const n = store.notifications.find((x) => x.id === id);
        if (!n) throw new Error(`Notification ${id} not found`);
        return asNotification({ ...n, read });
      },
      async markAllNotificationsRead(userId) {
        store.markAllRead(userId);
      },

      // ── Extension requests ──────────────────────────────────────────────
      async requestExtension(input) {
        return store.requestExtension(input);
      },
      async decideExtension(input) {
        store.decideExtension(input);
      },

      // ── Moderation reports ──────────────────────────────────────────────
      async listModerationReports(filter) {
        const all = store.moderationReports.map(asReport);
        return filter?.status
          ? all.filter((r) => r.status === filter.status)
          : all;
      },
      async createModerationReport(input) {
        const r = store.createModerationReport({
          messageId: input.messageId,
          reporterId: input.reporterId,
          reason: input.reason,
          reporterNote: input.reporterNote,
          severity: input.severity,
        });
        if (!r) {
          throw new Error(`Message ${input.messageId} not found`);
        }
        return asReport(r);
      },
      async updateModerationReport(id, patch) {
        store.updateModerationReport(id, patch);
        const r = store.moderationReports.find((x) => x.id === id);
        if (!r) throw new Error(`Report ${id} not found`);
        return asReport(r);
      },
      async bulkUpdateModerationReports(ids, patch) {
        for (const id of ids) store.updateModerationReport(id, patch);
        return store.moderationReports
          .filter((r) => ids.includes(r.id))
          .map(asReport);
      },
      async hideMessage(messageId) {
        store.hideMessage(messageId);
        const m = store.messages.find((x) => x.id === messageId);
        if (!m) throw new Error(`Message ${messageId} not found`);
        return m as MessageZ;
      },

      // ── Newsroom: sections ──────────────────────────────────────────────
      async listSections() {
        return store.sections.map(asSection);
      },

      // ── Newsroom: pitches ───────────────────────────────────────────────
      async listPitches(filter) {
        let rows = store.pitches.slice();
        if (filter?.writerId)
          rows = rows.filter((p) => p.writerId === filter.writerId);
        if (filter?.status)
          rows = rows.filter((p) => p.status === filter.status);
        return rows.map(asPitch);
      },
      async createPitch(input) {
        const p = store.createPitch({
          ...input,
          proposedSources: input.proposedSources ?? [],
        });
        return asPitch(p);
      },
      async decidePitch(input) {
        const p = store.decidePitch({
          pitchId: input.pitchId,
          decidedById: input.decidedById,
          accept: input.accept,
          note: input.note,
        });
        if (!p) throw new ApiError(`Pitch ${input.pitchId} not found`, 404);
        return asPitch(p);
      },
      async convertPitch(input) {
        const t = store.convertPitch({
          pitchId: input.pitchId,
          editorId: input.editorId,
          deadline: input.deadline,
          leaderId: input.leaderId,
          issueId: input.issueId,
        });
        if (!t)
          throw new ApiError(
            `Pitch ${input.pitchId} cannot be converted`,
            409
          );
        return asTask(t);
      },

      // ── Newsroom: issues ────────────────────────────────────────────────
      async listIssues() {
        return store.issues.map(asIssue);
      },
      async getIssue(id) {
        const i = store.issues.find((x) => x.id === id);
        return i ? asIssue(i) : null;
      },
      async updateIssue(id, patch) {
        // The mock store's `setIssueStatus` is the only mutator we have for
        // issues today. For richer patches, we go in via setIssueStatus when
        // status changes are present and otherwise no-op (mock fidelity).
        if (patch.status) store.setIssueStatus(id, patch.status);
        const i = store.issues.find((x) => x.id === id);
        if (!i) throw new ApiError(`Issue ${id} not found`, 404);
        // Apply name/notes/publishDate locally for the return value so the
        // immediate UI update reflects the patch even if the in-memory model
        // doesn't currently persist them. In Supabase mode they round-trip.
        return asIssue({ ...i, ...patch });
      },
      async publishIssue(id) {
        store.setIssueStatus(id, "published");
        const i = store.issues.find((x) => x.id === id);
        if (!i) throw new ApiError(`Issue ${id} not found`, 404);
        return asIssue(i);
      },

      // ── Newsroom: issue slots ───────────────────────────────────────────
      async listIssueSlots(issueId) {
        const all = store.issueSlots.map(asIssueSlot);
        return issueId ? all.filter((s) => s.issueId === issueId) : all;
      },
      async upsertIssueSlot(input) {
        const existing = store.issueSlots.find(
          (s) => s.issueId === input.issueId && s.taskId === input.taskId
        );
        if (existing) {
          // Mock store has no in-place priority update; remove + re-add
          // keeps mock fidelity without leaking a new mutator API.
          if (
            input.priority &&
            input.priority !== existing.priority
          ) {
            store.removeIssueSlot(existing.id);
            const slot = store.addIssueSlot({
              issueId: input.issueId,
              taskId: input.taskId,
              priority: input.priority,
            });
            return asIssueSlot(slot);
          }
          return asIssueSlot(existing);
        }
        const slot = store.addIssueSlot(input);
        return asIssueSlot(slot);
      },
      async removeIssueSlot(id) {
        store.removeIssueSlot(id);
      },

      // ── Newsroom: editorial checklists ──────────────────────────────────
      async getEditorialChecklist(taskId) {
        const cl = store.checklists.find((c) => c.taskId === taskId);
        return cl ? asChecklist(cl) : null;
      },
      async updateChecklistItem(input) {
        store.toggleChecklistItem(input);
        const cl = store.checklists.find((c) => c.taskId === input.taskId);
        if (!cl) throw new ApiError(`Checklist for ${input.taskId} not found`, 500);
        return asChecklist(cl);
      },

      // ── Newsroom: sensitive flags ───────────────────────────────────────
      async listSensitiveFlags(filter) {
        // Store carries the latest flag on each task. Surface them as a
        // flat list so callers don't have to know that.
        let flags: SensitiveFlag[] = store.tasks
          .map((t) => t.sensitive)
          .filter((f): f is SensitiveFlag => !!f);
        if (filter?.status)
          flags = flags.filter((f) => f.status === filter.status);
        if (filter?.taskId)
          flags = flags.filter((f) => f.taskId === filter.taskId);
        return flags.map(asFlag);
      },
      async raiseSensitiveFlag(input) {
        const f = store.raiseSensitiveFlag(input);
        return asFlag(f);
      },
      async decideSensitiveFlag(input) {
        store.decideSensitiveFlag(input);
        const t = store.tasks.find((x) => x.id === input.taskId);
        if (!t?.sensitive)
          throw new ApiError(`No sensitive flag on task ${input.taskId}`, 404);
        return asFlag(t.sensitive);
      },
    };
  }, [store, currentUserId]);
}
