"use client";

/* eslint-disable react-hooks/set-state-in-effect */

/**
 * StoreProvider — the app's in-memory cache of every collection, hydrated
 * from Supabase and kept in sync after each mutation.
 *
 * Every mutation persists through the Supabase `ApiClient` and then
 * re-hydrates so the local cache reflects server-side cascades (status
 * transitions, slot creation, checklist seeding, …). Important user-facing
 * events also fan out an email via `fanOutNotificationEmail`.
 *
 * When Supabase credentials are absent the store stays empty and its
 * mutators reject with a clear error — the app fails loud rather than
 * silently serving throwaway data.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  scanDeadlineReminders,
  type DeadlineReminder,
} from "./deadline-reminders";
import { getSupabaseBrowserClient } from "./supabase/browser";
import { fanOutNotificationEmail } from "./email/notify-client";
import { SupabaseApiClient } from "./api/supabase-adapter";
import { ApiError, type ApiClient } from "./api/client";
import type {
  Comment,
  Conversation,
  EditorialChecklist,
  ExtensionRequest,
  Issue,
  IssueSlot,
  IssueSlotPriority,
  IssueStatus,
  Message,
  ModerationReason,
  ModerationReport,
  ModerationSeverity,
  ModerationStatus,
  Notification,
  NotificationKind,
  Pitch,
  Review,
  ReviewDecision,
  Role,
  Section,
  SensitiveFlag,
  SensitiveReason,
  Submission,
  SubmissionFileMeta,
  SubmissionType,
  Task,
  TaskColor,
  TaskStatus,
  User,
} from "./types";
import type { DataMode } from "./supabase/env";

type StoreValue = {
  users: User[];
  tasks: Task[];
  submissions: Submission[];
  reviews: Review[];
  comments: Comment[];
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  moderationReports: ModerationReport[];
  // ── Newsroom entities ────────────────────────────────────────────────────
  sections: Section[];
  issues: Issue[];
  issueSlots: IssueSlot[];
  pitches: Pitch[];
  checklists: EditorialChecklist[];

  // ── Data-layer status ────────────────────────────────────────────────────
  /** Active data mode — always "supabase". */
  mode: DataMode;
  /** True once the store has loaded its data. */
  hydrated: boolean;
  /** Non-null when a Supabase hydration attempt failed. */
  hydrationError: string | null;
  /** Re-load every collection from the backend. */
  refresh: () => Promise<void>;

  setTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  createTask: (input: {
    title: string;
    instructions: string;
    writerId: string;
    editorId?: string;
    deadline: string;
    color?: TaskColor;
    wordCountTarget?: number;
    citationsRequired?: boolean;
  }) => Promise<Task>;
  updateTask: (
    taskId: string,
    patch: Partial<
      Pick<
        Task,
        | "title"
        | "instructions"
        | "writerId"
        | "editorId"
        | "deadline"
        | "color"
        | "wordCountTarget"
        | "citationsRequired"
        | "sectionId"
        | "issueId"
        | "copyEditorId"
        | "factCheckerId"
        | "slug"
        | "brief"
      >
    >
  ) => Promise<void>;
  updateUserRole: (userId: string, role: Role) => Promise<void>;
  setUserActive: (userId: string, active: boolean) => Promise<void>;
  togglePinMessage: (messageId: string) => Promise<void>;
  createSubmission: (input: {
    taskId: string;
    authorId: string;
    type: SubmissionType;
    content: string;
    file?: SubmissionFileMeta;
  }) => Promise<Submission>;
  submitReview: (input: {
    submissionId: string;
    reviewerId: string;
    decision: ReviewDecision;
    notes?: string;
  }) => Promise<Review>;
  addComment: (input: {
    submissionId: string;
    authorId: string;
    body: string;
    inline?: boolean;
    lineNumber?: number;
  }) => Promise<Comment>;
  toggleResolveComment: (commentId: string) => Promise<void>;
  sendMessage: (input: {
    conversationId: string;
    authorId: string;
    body: string;
  }) => Promise<Message>;
  createConversation: (input: {
    kind: Conversation["kind"];
    title: string;
    memberIds: string[];
  }) => Promise<Conversation>;
  markNotificationRead: (id: string, read?: boolean) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  pushNotification: (input: {
    userId: string;
    kind: NotificationKind;
    title: string;
    body?: string;
  }) => Promise<void>;
  runDeadlineScan: (input?: { now?: Date }) => DeadlineReminder[];
  resetDeadlineReminders: () => void;
  requestExtension: (input: {
    taskId: string;
    requestedById: string;
    newDeadline: string;
    reason: string;
  }) => Promise<ExtensionRequest>;
  decideExtension: (input: {
    taskId: string;
    decidedById: string;
    approve: boolean;
  }) => Promise<void>;
  createModerationReport: (input: {
    messageId: string;
    reporterId: string;
    reason: ModerationReason;
    reporterNote?: string;
    severity?: ModerationSeverity;
  }) => Promise<ModerationReport | null>;
  updateModerationReport: (
    id: string,
    patch: {
      status?: ModerationStatus;
      severity?: ModerationSeverity;
      internalNote?: string;
      resolvedById?: string;
    }
  ) => Promise<void>;
  hideMessage: (messageId: string) => Promise<void>;

  // ── Newsroom actions ─────────────────────────────────────────────────────
  createPitch: (input: {
    proposedHeadline: string;
    sectionId?: string;
    angle: string;
    whyNow: string;
    proposedSources: string[];
    expectedWordCount?: number;
    deadlinePref?: string;
    writerNote?: string;
    writerId: string;
  }) => Promise<Pitch>;
  decidePitch: (input: {
    pitchId: string;
    decidedById: string;
    accept: boolean;
    note?: string;
  }) => Promise<Pitch | null>;
  /** Convert an accepted pitch into a story task (assignment). */
  convertPitch: (input: {
    pitchId: string;
    editorId?: string;
    deadline: string;
    leaderId: string;
    issueId?: string;
  }) => Promise<Task | null>;

  /** Add a story to an issue's run sheet. */
  addIssueSlot: (input: {
    issueId: string;
    taskId: string;
    priority?: IssueSlotPriority;
  }) => Promise<IssueSlot>;
  /** Remove a slot from an issue. */
  removeIssueSlot: (slotId: string) => Promise<void>;
  /** Bump an issue forward (e.g. planning → production → published). */
  setIssueStatus: (issueId: string, status: IssueStatus) => Promise<void>;

  /** Update / toggle a checklist item. Auto-seeds the list if missing. */
  toggleChecklistItem: (input: {
    taskId: string;
    key: string;
    by: string;
    /** When provided, sets to this value instead of toggling. */
    checked?: boolean;
  }) => Promise<void>;

  /** Raise an editorial sensitive flag on a story. */
  raiseSensitiveFlag: (input: {
    taskId: string;
    raisedById: string;
    reason: SensitiveReason;
    notes: string;
  }) => Promise<SensitiveFlag>;
  /** Leader/admin decision on a sensitive flag. */
  decideSensitiveFlag: (input: {
    taskId: string;
    decidedById: string;
    status: "cleared" | "holding";
    note?: string;
  }) => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

let _id = 1000;
const nextId = (prefix: string) => `${prefix}${++_id}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // The Supabase-backed API client. The store delegates every mutation to it
  // and hydrates its collections from it. `null` when credentials are missing.
  const api = useMemo<ApiClient | null>(() => {
    const client = getSupabaseBrowserClient();
    return client ? new SupabaseApiClient(client, null) : null;
  }, []);

  // Collections start empty and are filled by `refresh()` once the auth
  // session is known (RLS gates every read on the session).
  const [usersState, setUsersState] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [moderationReports, setModerationReports] = useState<ModerationReport[]>(
    []
  );
  const [sectionsState, setSectionsState] = useState<Section[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueSlots, setIssueSlots] = useState<IssueSlot[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [checklists, setChecklists] = useState<EditorialChecklist[]>([]);
  const [issuedReminderKeys, setIssuedReminderKeys] = useState<Set<string>>(
    () => new Set()
  );

  // Hydration status. With no client (unconfigured) we are immediately
  // "hydrated" with empty collections so the app can render its fail-loud UI.
  const [hydrated, setHydrated] = useState(!api);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  // ── Supabase hydration ─────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const [
        u,
        t,
        subs,
        rev,
        com,
        conv,
        msg,
        notif,
        mod,
        sec,
        pit,
        iss,
        slot,
        chk,
      ] = await Promise.all([
        api.listUsers(),
        api.listTasks(),
        api.listSubmissions(),
        api.listReviews(),
        api.listComments(),
        api.listConversations(),
        api.listMessages(),
        api.listNotifications(),
        api.listModerationReports(),
        api.listSections(),
        api.listPitches(),
        api.listIssues(),
        api.listIssueSlots(),
        api.listChecklists(),
      ]);
      // `listTasks()` already attaches each task's latest sensitive flag,
      // so no separate flag merge is needed here.
      setUsersState(u as User[]);
      setTasks(t as Task[]);
      setSubmissions(subs as Submission[]);
      setReviews(rev as Review[]);
      setComments(com as Comment[]);
      setConversations(conv as Conversation[]);
      setMessages(msg as Message[]);
      setNotifications(notif as Notification[]);
      setModerationReports(mod as ModerationReport[]);
      setSectionsState(sec as Section[]);
      setPitches(pit as Pitch[]);
      setIssues(iss as Issue[]);
      setIssueSlots(slot as IssueSlot[]);
      setChecklists(chk as EditorialChecklist[]);
      setHydrationError(null);
      setHydrated(true);
    } catch (e) {
      setHydrationError(
        e instanceof Error ? e.message : "Failed to load portal data."
      );
      setHydrated(true);
    }
  }, [api]);

  // Hydrate once the Supabase auth session is known, and re-hydrate whenever
  // it changes (sign-in / sign-out). Row-level security gates every read on
  // the session, so hydrating before sign-in would just return empty sets.
  useEffect(() => {
    if (!api) return;
    const client = getSupabaseBrowserClient();
    if (!client) {
      setHydrated(true);
      return;
    }
    let active = true;

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        refresh();
      } else {
        setHydrated(true);
      }
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        refresh();
      } else {
        setHydrated(true);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [api, refresh]);

  // ── Deadline scan ───────────────────────────────────────────────────────
  // Pure-ish helper that turns due/overdue tasks into in-app notifications.
  // Used by the leader/admin "simulate reminders" control; the production
  // path is the /api/cron/deadline-reminders endpoint.
  const runDeadlineScan = useCallback(
    (input?: { now?: Date }) => {
      const fired = scanDeadlineReminders({
        tasks,
        users: usersState,
        issuedKeys: issuedReminderKeys,
        now: input?.now,
      });
      if (fired.length === 0) return fired;

      const created: Notification[] = fired.map((r) => ({
        id: nextId("n"),
        userId: r.userId,
        kind: "deadline",
        title: r.title,
        body: r.body,
        read: false,
        createdAt: new Date().toISOString(),
      }));
      setNotifications((prev) => [...created, ...prev]);
      setIssuedReminderKeys((prev) => {
        const next = new Set(prev);
        for (const r of fired) next.add(r.key);
        return next;
      });
      return fired;
    },
    [tasks, usersState, issuedReminderKeys]
  );

  const resetDeadlineReminders = useCallback(() => {
    setIssuedReminderKeys(new Set());
  }, []);

  const value = useMemo<StoreValue>(() => {
    const collections = {
      users: usersState,
      tasks,
      submissions,
      reviews,
      comments,
      conversations,
      messages,
      notifications,
      moderationReports,
      sections: sectionsState,
      issues,
      issueSlots,
      pitches,
      checklists,
      mode: "supabase" as DataMode,
      hydrated,
      hydrationError,
      refresh,
      runDeadlineScan,
      resetDeadlineReminders,
    };

    // ── No backend configured: fail loud. Mutators reject with a clear error
    //    instead of silently mutating throwaway in-memory data.
    if (!api) {
      const fail = async (): Promise<never> => {
        throw new ApiError(
          "The portal backend is not configured. Check the Supabase environment variables.",
          503
        );
      };
      return {
        ...collections,
        setTaskStatus: fail,
        createTask: fail,
        updateTask: fail,
        updateUserRole: fail,
        setUserActive: fail,
        togglePinMessage: fail,
        createSubmission: fail,
        submitReview: fail,
        addComment: fail,
        toggleResolveComment: fail,
        sendMessage: fail,
        createConversation: fail,
        markNotificationRead: fail,
        markAllRead: fail,
        pushNotification: fail,
        requestExtension: fail,
        decideExtension: fail,
        createModerationReport: fail,
        updateModerationReport: fail,
        hideMessage: fail,
        createPitch: fail,
        decidePitch: fail,
        convertPitch: fail,
        addIssueSlot: fail,
        removeIssueSlot: fail,
        setIssueStatus: fail,
        toggleChecklistItem: fail,
        raiseSensitiveFlag: fail,
        decideSensitiveFlag: fail,
      };
    }

    // ── Every mutation persists through the API client and then re-hydrates
    //    so the local cache reflects server-side cascades.
    const persist = async <T,>(op: Promise<T>): Promise<T> => {
      const result = await op;
      await refresh();
      return result;
    };
    // Active users in a set of roles — recipients for "all editors / all
    // leaders" style fan-outs (pitches, extensions, sensitive flags, reports).
    const staff = (roles: Role[]): string[] =>
      usersState
        .filter((u) => u.active !== false && roles.includes(u.role))
        .map((u) => u.id);
    return {
      ...collections,
      setTaskStatus: async (id, status) => {
        await persist(api.setTaskStatus(id, status));
      },
      createTask: async (input) => {
        const task = await persist(api.createTask(input));
        // Email fan-out mirrors the in-app notifications the backend emits.
        fanOutNotificationEmail([task.writerId], {
          kind: "task_assigned",
          title: `Assigned: ${task.title}`,
          body: `Due ${new Date(task.deadline).toLocaleDateString()}`,
        });
        if (task.editorId) {
          fanOutNotificationEmail([task.editorId], {
            kind: "task_assigned",
            title: `Editing: ${task.title}`,
            body: "You are the assigned editor.",
          });
        }
        return task;
      },
      updateTask: async (id, patch) => {
        await persist(api.updateTask(id, patch));
      },
      updateUserRole: async (id, role) => {
        await persist(api.updateUserRole(id, role));
      },
      setUserActive: async (id, active) => {
        await persist(api.setUserActive(id, active));
      },
      togglePinMessage: async (id) => {
        await persist(api.togglePinMessage(id));
      },
      createSubmission: async (input) => {
        const submission = await persist(api.createSubmission(input));
        const task = tasks.find((t) => t.id === input.taskId);
        if (task?.editorId) {
          fanOutNotificationEmail([task.editorId], {
            kind: "submission",
            title: `New submission: ${task.title}`,
            body: `Version ${submission.version} ready for review.`,
          });
        }
        return submission;
      },
      submitReview: async (input) => {
        const review = await persist(api.createReview(input));
        const sub = submissions.find((s) => s.id === input.submissionId);
        const task = sub ? tasks.find((t) => t.id === sub.taskId) : undefined;
        if (task) {
          fanOutNotificationEmail([task.writerId], {
            kind: "review_decision",
            title:
              input.decision === "approved"
                ? `Approved: ${task.title}`
                : input.decision === "rejected"
                  ? `Rejected: ${task.title}`
                  : `Changes requested: ${task.title}`,
            body: input.notes,
          });
        }
        return review;
      },
      addComment: async (input) => {
        const comment = await persist(api.createComment(input));
        const sub = submissions.find((s) => s.id === input.submissionId);
        const task = sub ? tasks.find((t) => t.id === sub.taskId) : undefined;
        if (task && task.writerId !== input.authorId) {
          fanOutNotificationEmail([task.writerId], {
            kind: "comment",
            title: `New comment on ${task.title}`,
          });
        }
        return comment;
      },
      toggleResolveComment: async (id) => {
        await persist(api.toggleResolveComment(id));
      },
      sendMessage: (input) => persist(api.sendMessage(input)),
      createConversation: (input) => persist(api.createConversation(input)),
      markNotificationRead: async (id, read) => {
        await persist(api.markNotificationRead(id, read));
      },
      markAllRead: async (userId) => {
        await persist(api.markAllNotificationsRead(userId));
      },
      pushNotification: async (input) => {
        // Notification fan-out to other users requires a server-side
        // (service-role) path — the `notifications` RLS policy only lets a
        // client insert a row for itself or when acting as an admin. Treat
        // this as best-effort so a rejected fan-out can't break the user's
        // action; production delivery is a server-side trigger's job.
        try {
          await api.pushNotification(input);
          await refresh();
        } catch {
          /* RLS-rejected fan-out — delivered server-side in production */
        }
        // The in-app row may be RLS-blocked above, but the email goes out
        // through the service-role route regardless. This covers direct
        // callers such as the announcements composer.
        fanOutNotificationEmail([input.userId], {
          kind: input.kind,
          title: input.title,
          body: input.body,
        });
      },
      requestExtension: async (input) => {
        const req = await persist(api.requestExtension(input));
        fanOutNotificationEmail(staff(["leader", "admin"]), {
          kind: "task_assigned",
          title: "Extension requested",
          body: input.reason.slice(0, 120),
        });
        return req;
      },
      decideExtension: async (input) => {
        const task = tasks.find((t) => t.id === input.taskId);
        await persist(api.decideExtension(input));
        if (task?.extensionRequest) {
          fanOutNotificationEmail([task.extensionRequest.requestedById], {
            kind: "task_assigned",
            title: input.approve
              ? `Extension approved: ${task.title}`
              : `Extension denied: ${task.title}`,
          });
        }
      },
      createModerationReport: async (input) => {
        const report = await persist(api.createModerationReport(input));
        fanOutNotificationEmail(
          staff(["admin", "leader"]).filter((id) => id !== input.reporterId),
          {
            kind: "comment",
            title: "Message reported",
            body: input.reporterNote?.slice(0, 100),
          }
        );
        return report;
      },
      updateModerationReport: async (id, patch) => {
        await persist(api.updateModerationReport(id, patch));
      },
      hideMessage: async (id) => {
        await persist(api.hideMessage(id));
      },
      createPitch: async (input) => {
        const pitch = await persist(api.createPitch(input));
        fanOutNotificationEmail(staff(["editor", "leader"]), {
          kind: "task_assigned",
          title: "New pitch submitted",
          body: input.proposedHeadline,
        });
        return pitch;
      },
      decidePitch: async (input) => {
        const pitch = await persist(api.decidePitch(input));
        if (pitch) {
          fanOutNotificationEmail([pitch.writerId], {
            kind: "review_decision",
            title: input.accept
              ? `Pitch accepted: ${pitch.proposedHeadline}`
              : `Pitch declined: ${pitch.proposedHeadline}`,
            body: input.note,
          });
        }
        return pitch;
      },
      convertPitch: async (input) => {
        const task = await persist(api.convertPitch(input));
        if (task) {
          fanOutNotificationEmail([task.writerId], {
            kind: "task_assigned",
            title: `Assigned: ${task.title}`,
            body: `Due ${new Date(task.deadline).toLocaleDateString()}`,
          });
          if (task.editorId) {
            fanOutNotificationEmail([task.editorId], {
              kind: "task_assigned",
              title: `Editing: ${task.title}`,
            });
          }
        }
        return task;
      },
      addIssueSlot: (input) => persist(api.upsertIssueSlot(input)),
      removeIssueSlot: async (id) => {
        await persist(api.removeIssueSlot(id));
      },
      setIssueStatus: async (id, status) => {
        await persist(
          status === "published"
            ? api.publishIssue(id)
            : api.updateIssue(id, { status })
        );
      },
      toggleChecklistItem: async (input) => {
        await persist(api.updateChecklistItem(input));
      },
      raiseSensitiveFlag: async (input) => {
        const flag = await persist(api.raiseSensitiveFlag(input));
        fanOutNotificationEmail(
          staff(["leader", "admin"]).filter((id) => id !== input.raisedById),
          {
            kind: "review_decision",
            title: "Sensitive story flagged",
            body: input.notes.slice(0, 120),
          }
        );
        return flag;
      },
      decideSensitiveFlag: async (input) => {
        const task = tasks.find((t) => t.id === input.taskId);
        await persist(api.decideSensitiveFlag(input));
        if (task) {
          fanOutNotificationEmail([task.writerId], {
            kind: "review_decision",
            title:
              input.status === "cleared"
                ? `Sensitive review cleared: ${task.title}`
                : `Sensitive review on hold: ${task.title}`,
            body: input.note,
          });
        }
      },
    };
  }, [
    api,
    hydrated,
    hydrationError,
    refresh,
    usersState,
    tasks,
    submissions,
    reviews,
    comments,
    conversations,
    messages,
    notifications,
    moderationReports,
    sectionsState,
    issues,
    issueSlots,
    pitches,
    checklists,
    runDeadlineScan,
    resetDeadlineReminders,
  ]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
