"use client";

/**
 * MockAdapter — bridges the typed `ApiClient` interface to the in-memory
 * `StoreProvider`. This lets the new hooks layer call API methods while the
 * UI continues to render from the existing store. When the HTTP backend
 * comes online, the adapter swaps and the rest of the codebase stays put.
 */
import { useMemo } from "react";
import type { ApiClient } from "./client";
import { useStore } from "@/lib/store";
import type { Comment, Notification, Submission, User } from "@/lib/types";
import type {
  CommentZ,
  ConversationZ,
  MessageZ,
  NotificationZ,
  ReviewZ,
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
    };
  }, [store, currentUserId]);
}
