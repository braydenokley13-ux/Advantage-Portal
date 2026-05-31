/**
 * HttpAdapter — placeholder for the eventual real-backend implementation.
 *
 * Every method throws `ApiError("Not implemented")` today. When the backend
 * comes online, fill in `fetch` calls against `${baseUrl}/api/...` and parse
 * responses through the matching Zod schema in `lib/contracts`.
 *
 * Sketched usage (NOT wired in app/layout.tsx yet):
 *   const client = new HttpApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL })
 *   <ApiClientProvider value={client}>...</ApiClientProvider>
 */
import { ApiError, type ApiClient } from "./client";
import {
  CommentSchema,
  ConversationSchema,
  MessageSchema,
  NotificationSchema,
  ReviewSchema,
  SubmissionSchema,
  TaskSchema,
  UserSchema,
} from "@/lib/contracts";
import type { z } from "zod";

export interface HttpAdapterConfig {
  baseUrl: string;
  /** Token getter for Authorization header. */
  getAuthToken?: () => string | null | Promise<string | null>;
}

export class HttpApiClient implements ApiClient {
  constructor(private readonly config: HttpAdapterConfig) {}

  // Internal helpers — left typed for the future HTTP endpoint wiring.
  private async request<T>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<T>
  ): Promise<T> {
    const token = await Promise.resolve(this.config.getAuthToken?.() ?? null);
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!res.ok) {
      throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status);
    }
    const json = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("Response failed contract validation", 500, parsed.error);
    }
    return parsed.data;
  }

  // Reference the helper so unused-import/private-method lints stay quiet
  // when the methods below are filled in.
  private notImplemented(method: string): never {
    void this.request;
    void UserSchema;
    void TaskSchema;
    void SubmissionSchema;
    void ReviewSchema;
    void CommentSchema;
    void ConversationSchema;
    void MessageSchema;
    void NotificationSchema;
    throw new ApiError(`HttpApiClient.${method} not implemented yet`, 501);
  }

  getCurrentUser() { return this.notImplemented("getCurrentUser"); }
  listUsers() { return this.notImplemented("listUsers"); }
  getUser() { return this.notImplemented("getUser"); }
  updateUserRole() { return this.notImplemented("updateUserRole"); }
  setUserActive() { return this.notImplemented("setUserActive"); }

  listTasks() { return this.notImplemented("listTasks"); }
  getTask() { return this.notImplemented("getTask"); }
  createTask() { return this.notImplemented("createTask"); }
  updateTask() { return this.notImplemented("updateTask"); }
  setTaskStatus() { return this.notImplemented("setTaskStatus"); }

  listSubmissions() { return this.notImplemented("listSubmissions"); }
  createSubmission() { return this.notImplemented("createSubmission"); }

  listReviews() { return this.notImplemented("listReviews"); }
  createReview() { return this.notImplemented("createReview"); }

  listComments() { return this.notImplemented("listComments"); }
  createComment() { return this.notImplemented("createComment"); }
  toggleResolveComment() { return this.notImplemented("toggleResolveComment"); }

  listConversations() { return this.notImplemented("listConversations"); }
  createConversation() { return this.notImplemented("createConversation"); }
  listMessages() { return this.notImplemented("listMessages"); }
  sendMessage() { return this.notImplemented("sendMessage"); }
  togglePinMessage() { return this.notImplemented("togglePinMessage"); }

  listNotifications() { return this.notImplemented("listNotifications"); }
  pushNotification() { return this.notImplemented("pushNotification"); }
  markNotificationRead() { return this.notImplemented("markNotificationRead"); }
  markAllNotificationsRead() {
    return this.notImplemented("markAllNotificationsRead");
  }

  requestExtension() { return this.notImplemented("requestExtension"); }
  decideExtension() { return this.notImplemented("decideExtension"); }
  listModerationReports() {
    return this.notImplemented("listModerationReports");
  }
  createModerationReport() {
    return this.notImplemented("createModerationReport");
  }
  updateModerationReport() {
    return this.notImplemented("updateModerationReport");
  }
  bulkUpdateModerationReports() {
    return this.notImplemented("bulkUpdateModerationReports");
  }
  hideMessage() { return this.notImplemented("hideMessage"); }

  // ── Newsroom — placeholders ───────────────────────────────────────────
  listSections() { return this.notImplemented("listSections"); }
  listPitches() { return this.notImplemented("listPitches"); }
  createPitch() { return this.notImplemented("createPitch"); }
  decidePitch() { return this.notImplemented("decidePitch"); }
  convertPitch() { return this.notImplemented("convertPitch"); }
  listIssues() { return this.notImplemented("listIssues"); }
  getIssue() { return this.notImplemented("getIssue"); }
  updateIssue() { return this.notImplemented("updateIssue"); }
  publishIssue() { return this.notImplemented("publishIssue"); }
  listIssueSlots() { return this.notImplemented("listIssueSlots"); }
  upsertIssueSlot() { return this.notImplemented("upsertIssueSlot"); }
  removeIssueSlot() { return this.notImplemented("removeIssueSlot"); }
  getEditorialChecklist() {
    return this.notImplemented("getEditorialChecklist");
  }
  listChecklists() { return this.notImplemented("listChecklists"); }
  updateChecklistItem() {
    return this.notImplemented("updateChecklistItem");
  }
  listSensitiveFlags() { return this.notImplemented("listSensitiveFlags"); }
  raiseSensitiveFlag() { return this.notImplemented("raiseSensitiveFlag"); }
  decideSensitiveFlag() { return this.notImplemented("decideSensitiveFlag"); }
}
