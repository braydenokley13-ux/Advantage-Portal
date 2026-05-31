"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  checklists as seedChecklists,
  conversations as seedConversations,
  defaultChecklistItems,
  issues as seedIssues,
  issueSlots as seedIssueSlots,
  messages as seedMessages,
  notifications as seedNotifications,
  pitches as seedPitches,
  sections as seedSections,
  submissions as seedSubmissions,
  tasks as seedTasks,
  users,
} from "./mock-data";
import {
  scanDeadlineReminders,
  type DeadlineReminder,
} from "./deadline-reminders";
import { resolveDataMode, type DataMode } from "./supabase/env";
import { getSupabaseBrowserClient } from "./supabase/browser";
import { SupabaseApiClient } from "./api/supabase-adapter";
import type { ApiClient } from "./api/client";
import type {
  ChecklistItem,
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
  /** Active data mode — "mock" (in-memory) or "supabase" (persisted). */
  mode: DataMode;
  /** True once the store has loaded its data. Always true in mock mode. */
  hydrated: boolean;
  /** Non-null when a Supabase hydration attempt failed. */
  hydrationError: string | null;
  /** Re-load every collection from the backend (no-op in mock mode). */
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
    sectionId: string;
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
  // Data mode is env-driven and stable for the life of the page.
  const dataMode = useMemo<DataMode>(() => resolveDataMode().mode, []);
  const isSupabase = dataMode === "supabase";

  // The Supabase-backed API client. In supabase mode the store delegates
  // every mutation to it and hydrates its collections from it. `null` in
  // mock mode (or when credentials are missing).
  const api = useMemo<ApiClient | null>(() => {
    if (!isSupabase) return null;
    const client = getSupabaseBrowserClient();
    return client ? new SupabaseApiClient(client, null) : null;
  }, [isSupabase]);

  // In supabase mode collections start empty and are filled by `refresh()`;
  // in mock mode they start from the seed.
  const [usersState, setUsersState] = useState<User[]>(() =>
    isSupabase ? [] : users.map((u) => ({ active: true, ...u }))
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    isSupabase ? [] : seedTasks
  );
  const [submissions, setSubmissions] = useState<Submission[]>(() =>
    isSupabase ? [] : seedSubmissions
  );
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    isSupabase ? [] : seedConversations
  );
  const [messages, setMessages] = useState<Message[]>(() =>
    isSupabase ? [] : seedMessages
  );
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    isSupabase ? [] : seedNotifications
  );
  const [moderationReports, setModerationReports] = useState<ModerationReport[]>(
    []
  );
  const [sectionsState, setSectionsState] = useState<Section[]>(() =>
    isSupabase ? [] : seedSections
  );
  const [issues, setIssues] = useState<Issue[]>(() =>
    isSupabase ? [] : seedIssues
  );
  const [issueSlots, setIssueSlots] = useState<IssueSlot[]>(() =>
    isSupabase ? [] : seedIssueSlots
  );
  const [pitches, setPitches] = useState<Pitch[]>(() =>
    isSupabase ? [] : seedPitches
  );
  const [checklists, setChecklists] = useState<EditorialChecklist[]>(() =>
    isSupabase ? [] : seedChecklists
  );
  const [issuedReminderKeys, setIssuedReminderKeys] = useState<Set<string>>(
    () => new Set()
  );

  // Hydration status. Mock mode is hydrated immediately.
  const [hydrated, setHydrated] = useState(!isSupabase);
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

  const setTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
  }, []);

  const createTask = useCallback(
    (input: {
      title: string;
      instructions: string;
      writerId: string;
      editorId?: string;
      deadline: string;
      color?: TaskColor;
      wordCountTarget?: number;
      citationsRequired?: boolean;
    }): Task => {
      const t: Task = {
        id: nextId("t"),
        title: input.title,
        instructions: input.instructions,
        writerId: input.writerId,
        editorId: input.editorId,
        deadline: input.deadline,
        status: "not_started",
        color: input.color ?? "green",
        createdAt: new Date().toISOString(),
        wordCountTarget: input.wordCountTarget,
        citationsRequired: input.citationsRequired,
      };
      setTasks((prev) => [t, ...prev]);

      setNotifications((prev) => [
        {
          id: nextId("n"),
          userId: input.writerId,
          kind: "task_assigned",
          title: `Assigned: ${input.title}`,
          body: `Due ${new Date(input.deadline).toLocaleDateString()}`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...(input.editorId
          ? [
              {
                id: nextId("n"),
                userId: input.editorId,
                kind: "task_assigned" as const,
                title: `Editing: ${input.title}`,
                body: "You are the assigned editor.",
                read: false,
                createdAt: new Date().toISOString(),
              },
            ]
          : []),
        ...prev,
      ]);
      return t;
    },
    []
  );

  const updateTask = useCallback(
    (
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
    ) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
      );
    },
    []
  );

  const updateUserRole = useCallback((userId: string, role: Role) => {
    setUsersState((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    );
  }, []);

  const setUserActive = useCallback((userId: string, active: boolean) => {
    setUsersState((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, active } : u))
    );
  }, []);

  const togglePinMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              pinnedAt: m.pinnedAt ? undefined : new Date().toISOString(),
            }
          : m
      )
    );
  }, []);

  const pushNotification = useCallback(
    (input: {
      userId: string;
      kind: NotificationKind;
      title: string;
      body?: string;
    }) => {
      // Dedupe: skip identical (userId+kind+title) notifications fired within
      // the last 60 seconds to keep the inbox useful when multiple events
      // (in-app/email/push fan-out) arrive for the same logical action.
      // Real backend would dedup at delivery; mock dedup keeps demo clean.
      setNotifications((prev) => {
        const cutoff = Date.now() - 60_000;
        const recentDuplicate = prev.find(
          (n) =>
            n.userId === input.userId &&
            n.kind === input.kind &&
            n.title === input.title &&
            new Date(n.createdAt).getTime() > cutoff
        );
        if (recentDuplicate) return prev;
        return [
          {
            id: nextId("n"),
            userId: input.userId,
            kind: input.kind,
            title: input.title,
            body: input.body,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });
    },
    []
  );

  const createSubmission = useCallback(
    (input: {
      taskId: string;
      authorId: string;
      type: SubmissionType;
      content: string;
      file?: SubmissionFileMeta;
    }): Submission => {
      const taskSubs = submissions.filter((s) => s.taskId === input.taskId);
      const version = taskSubs.length + 1;
      const sub: Submission = {
        id: nextId("s"),
        taskId: input.taskId,
        type: input.type,
        version,
        content: input.content,
        file: input.type === "file" ? input.file : undefined,
        createdAt: new Date().toISOString(),
        isCurrent: true,
      };
      setSubmissions((prev) => [
        ...prev.map((s) =>
          s.taskId === input.taskId ? { ...s, isCurrent: false } : s
        ),
        sub,
      ]);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === input.taskId
            ? { ...t, status: "submitted", currentSubmissionId: sub.id }
            : t
        )
      );

      const task = tasks.find((t) => t.id === input.taskId);
      if (task?.editorId) {
        pushNotification({
          userId: task.editorId,
          kind: "submission",
          title: `New submission: ${task.title}`,
          body: `Version ${version} ready for review.`,
        });
      }
      return sub;
    },
    [submissions, tasks, pushNotification]
  );

  const submitReview = useCallback(
    (input: {
      submissionId: string;
      reviewerId: string;
      decision: ReviewDecision;
      notes?: string;
    }): Review => {
      const review: Review = {
        id: nextId("r"),
        submissionId: input.submissionId,
        reviewerId: input.reviewerId,
        decision: input.decision,
        notes: input.notes,
        createdAt: new Date().toISOString(),
      };
      setReviews((prev) => [...prev, review]);

      const sub = submissions.find((s) => s.id === input.submissionId);
      const task = sub ? tasks.find((t) => t.id === sub.taskId) : undefined;
      if (task) {
        const nextStatus: TaskStatus =
          input.decision === "approved" || input.decision === "rejected"
            ? "complete"
            : "in_progress";
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: nextStatus } : t
          )
        );
        pushNotification({
          userId: task.writerId,
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
    [submissions, tasks, pushNotification]
  );

  const addComment = useCallback(
    (input: {
      submissionId: string;
      authorId: string;
      body: string;
      inline?: boolean;
      lineNumber?: number;
    }): Comment => {
      const isInline = input.inline ?? input.lineNumber !== undefined;
      const c: Comment = {
        id: nextId("c"),
        submissionId: input.submissionId,
        authorId: input.authorId,
        body: input.body,
        inline: isInline,
        lineNumber: isInline ? input.lineNumber : undefined,
        resolved: false,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => [...prev, c]);

      const sub = submissions.find((s) => s.id === input.submissionId);
      const task = sub ? tasks.find((t) => t.id === sub.taskId) : undefined;
      if (task && task.writerId !== input.authorId) {
        pushNotification({
          userId: task.writerId,
          kind: "comment",
          title: `New comment on ${task.title}`,
        });
      }
      return c;
    },
    [submissions, tasks, pushNotification]
  );

  const toggleResolveComment = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, resolved: !c.resolved } : c
      )
    );
  }, []);

  const sendMessage = useCallback(
    (input: {
      conversationId: string;
      authorId: string;
      body: string;
    }): Message => {
      const m: Message = {
        id: nextId("m"),
        conversationId: input.conversationId,
        authorId: input.authorId,
        body: input.body,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, m]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === input.conversationId
            ? { ...c, lastMessageAt: m.createdAt }
            : c
        )
      );
      return m;
    },
    []
  );

  const createConversation = useCallback(
    (input: {
      kind: Conversation["kind"];
      title: string;
      memberIds: string[];
    }): Conversation => {
      const c: Conversation = {
        id: nextId("conv"),
        kind: input.kind,
        title: input.title,
        memberIds: input.memberIds,
      };
      setConversations((prev) => [...prev, c]);
      return c;
    },
    []
  );

  const markNotificationRead = useCallback((id: string, read = true) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read } : n))
    );
  }, []);

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

  const requestExtension = useCallback(
    (input: {
      taskId: string;
      requestedById: string;
      newDeadline: string;
      reason: string;
    }): ExtensionRequest => {
      const req: ExtensionRequest = {
        id: nextId("ext"),
        taskId: input.taskId,
        requestedById: input.requestedById,
        newDeadline: input.newDeadline,
        reason: input.reason,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) =>
        prev.map((t) =>
          t.id === input.taskId ? { ...t, extensionRequest: req } : t
        )
      );
      // Notify every leader/admin so an approver sees it. Per product
      // direction, both leaders and admins can approve extensions.
      for (const u of usersState.filter(
        (x) => x.role === "leader" || x.role === "admin"
      )) {
        pushNotification({
          userId: u.id,
          kind: "task_assigned",
          title: "Extension requested",
          body: input.reason.slice(0, 120),
        });
      }
      return req;
    },
    [usersState, pushNotification]
  );

  const createModerationReport = useCallback(
    (input: {
      messageId: string;
      reporterId: string;
      reason: ModerationReason;
      reporterNote?: string;
      severity?: ModerationSeverity;
    }): ModerationReport | null => {
      const message = messages.find((m) => m.id === input.messageId);
      if (!message) return null;
      // Dedupe: one report per (reporter, message). Subsequent calls bump
      // the existing report's note instead of creating a new row.
      const existing = moderationReports.find(
        (r) =>
          r.messageId === input.messageId && r.reporterId === input.reporterId
      );
      if (existing) {
        if (
          input.reporterNote &&
          input.reporterNote !== existing.reporterNote
        ) {
          setModerationReports((prev) =>
            prev.map((r) =>
              r.id === existing.id
                ? {
                    ...r,
                    reporterNote: input.reporterNote,
                    updatedAt: new Date().toISOString(),
                  }
                : r
            )
          );
        }
        return existing;
      }
      const now = new Date().toISOString();
      const report: ModerationReport = {
        id: nextId("rep"),
        messageId: input.messageId,
        conversationId: message.conversationId,
        reportedUserId: message.authorId,
        reporterId: input.reporterId,
        reason: input.reason,
        reporterNote: input.reporterNote,
        status: "open",
        severity: input.severity ?? "medium",
        createdAt: now,
        updatedAt: now,
      };
      setModerationReports((prev) => [report, ...prev]);
      // Notify every admin so they triage. Leaders also get a heads-up so
      // safety power is shared per the role policy.
      for (const u of usersState.filter(
        (x) => x.role === "admin" || x.role === "leader"
      )) {
        pushNotification({
          userId: u.id,
          kind: "comment",
          title: "Message reported",
          body: input.reporterNote?.slice(0, 100),
        });
      }
      return report;
    },
    [messages, moderationReports, usersState, pushNotification]
  );

  const updateModerationReport = useCallback(
    (
      id: string,
      patch: {
        status?: ModerationStatus;
        severity?: ModerationSeverity;
        internalNote?: string;
        resolvedById?: string;
      }
    ) => {
      setModerationReports((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const becomingResolved =
            (patch.status === "resolved" || patch.status === "dismissed") &&
            r.status !== "resolved" &&
            r.status !== "dismissed";
          return {
            ...r,
            ...patch,
            resolvedAt: becomingResolved
              ? new Date().toISOString()
              : r.resolvedAt,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const hideMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              hiddenAt: m.hiddenAt ? undefined : new Date().toISOString(),
            }
          : m
      )
    );
  }, []);

  const decideExtension = useCallback(
    (input: { taskId: string; decidedById: string; approve: boolean }) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== input.taskId || !t.extensionRequest) return t;
          const decided: ExtensionRequest = {
            ...t.extensionRequest,
            status: input.approve ? "approved" : "denied",
            decidedById: input.decidedById,
            decidedAt: new Date().toISOString(),
          };
          // On approval, slide the task deadline forward.
          return {
            ...t,
            deadline: input.approve ? decided.newDeadline : t.deadline,
            extensionRequest: decided,
          };
        })
      );
      const task = tasks.find((t) => t.id === input.taskId);
      if (task?.extensionRequest) {
        pushNotification({
          userId: task.extensionRequest.requestedById,
          kind: "task_assigned",
          title: input.approve
            ? `Extension approved: ${task.title}`
            : `Extension denied: ${task.title}`,
        });
      }
    },
    [tasks, pushNotification]
  );

  // ── Newsroom: pitches ─────────────────────────────────────────────────────
  const createPitch = useCallback(
    (input: {
      proposedHeadline: string;
      sectionId: string;
      angle: string;
      whyNow: string;
      proposedSources: string[];
      expectedWordCount?: number;
      deadlinePref?: string;
      writerNote?: string;
      writerId: string;
    }): Pitch => {
      const p: Pitch = {
        id: nextId("p"),
        proposedHeadline: input.proposedHeadline,
        sectionId: input.sectionId,
        angle: input.angle,
        whyNow: input.whyNow,
        proposedSources: input.proposedSources,
        expectedWordCount: input.expectedWordCount,
        deadlinePref: input.deadlinePref,
        writerNote: input.writerNote,
        writerId: input.writerId,
        status: "submitted",
        createdAt: new Date().toISOString(),
      };
      setPitches((prev) => [p, ...prev]);
      // Notify every editor/leader so they triage. (In real life we'd target
      // section editors only — we don't have section-editor mapping yet.)
      for (const u of usersState.filter(
        (x) => x.role === "editor" || x.role === "leader"
      )) {
        pushNotification({
          userId: u.id,
          kind: "task_assigned",
          title: "New pitch submitted",
          body: input.proposedHeadline,
        });
      }
      return p;
    },
    [usersState, pushNotification]
  );

  const decidePitch = useCallback(
    (input: {
      pitchId: string;
      decidedById: string;
      accept: boolean;
      note?: string;
    }): Pitch | null => {
      let updated: Pitch | null = null;
      setPitches((prev) =>
        prev.map((p) => {
          if (p.id !== input.pitchId) return p;
          updated = {
            ...p,
            status: input.accept ? "accepted" : "declined",
            editorNote: input.note,
            decidedById: input.decidedById,
            decidedAt: new Date().toISOString(),
          };
          return updated;
        })
      );
      if (updated) {
        const u = updated as Pitch;
        pushNotification({
          userId: u.writerId,
          kind: "review_decision",
          title: input.accept
            ? `Pitch accepted: ${u.proposedHeadline}`
            : `Pitch declined: ${u.proposedHeadline}`,
          body: input.note,
        });
      }
      return updated;
    },
    [pushNotification]
  );

  const convertPitch = useCallback(
    (input: {
      pitchId: string;
      editorId?: string;
      deadline: string;
      leaderId: string;
      issueId?: string;
    }): Task | null => {
      const pitch = pitches.find((p) => p.id === input.pitchId);
      if (!pitch || pitch.status === "converted") return null;
      const t: Task = {
        id: nextId("t"),
        title: pitch.proposedHeadline,
        instructions: [
          pitch.angle && `Angle: ${pitch.angle}`,
          pitch.whyNow && `Why now: ${pitch.whyNow}`,
          pitch.proposedSources.length
            ? `Proposed sources:\n- ${pitch.proposedSources.join("\n- ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
        writerId: pitch.writerId,
        editorId: input.editorId,
        deadline: input.deadline,
        status: "not_started",
        color: "green",
        createdAt: new Date().toISOString(),
        wordCountTarget: pitch.expectedWordCount,
        sectionId: pitch.sectionId,
        pitchId: pitch.id,
        issueId: input.issueId,
        brief: {
          angle: pitch.angle,
          requiredSources: pitch.proposedSources,
          publishingNotes: pitch.writerNote,
        },
      };
      setTasks((prev) => [t, ...prev]);
      setPitches((prev) =>
        prev.map((p) =>
          p.id === pitch.id
            ? {
                ...p,
                status: "converted",
                taskId: t.id,
                decidedById: input.leaderId,
                decidedAt: new Date().toISOString(),
              }
            : p
        )
      );
      if (input.issueId) {
        setIssueSlots((prev) => [
          ...prev,
          {
            id: nextId("slot"),
            issueId: input.issueId!,
            taskId: t.id,
            priority: "nice_to_run",
          },
        ]);
      }
      pushNotification({
        userId: pitch.writerId,
        kind: "task_assigned",
        title: `Assigned: ${pitch.proposedHeadline}`,
        body: `Due ${new Date(input.deadline).toLocaleDateString()}`,
      });
      if (input.editorId) {
        pushNotification({
          userId: input.editorId,
          kind: "task_assigned",
          title: `Editing: ${pitch.proposedHeadline}`,
        });
      }
      return t;
    },
    [pitches, pushNotification]
  );

  // ── Newsroom: issues ──────────────────────────────────────────────────────
  const addIssueSlot = useCallback(
    (input: {
      issueId: string;
      taskId: string;
      priority?: IssueSlotPriority;
    }): IssueSlot => {
      const s: IssueSlot = {
        id: nextId("slot"),
        issueId: input.issueId,
        taskId: input.taskId,
        priority: input.priority ?? "nice_to_run",
      };
      setIssueSlots((prev) => [...prev, s]);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === input.taskId ? { ...t, issueId: input.issueId } : t
        )
      );
      return s;
    },
    []
  );

  const removeIssueSlot = useCallback((slotId: string) => {
    setIssueSlots((prev) => {
      const slot = prev.find((s) => s.id === slotId);
      if (slot) {
        // Detach the issue from the task too so it doesn't ghost-link.
        setTasks((tprev) =>
          tprev.map((t) =>
            t.id === slot.taskId && t.issueId === slot.issueId
              ? { ...t, issueId: undefined }
              : t
          )
        );
      }
      return prev.filter((s) => s.id !== slotId);
    });
  }, []);

  const setIssueStatus = useCallback(
    (issueId: string, status: IssueStatus) => {
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, status } : i))
      );
      // Publishing the issue advances every slotted, ready story to complete
      // (which derives to "published" via the stage helper).
      if (status === "published") {
        setTasks((prev) =>
          prev.map((t) =>
            t.issueId === issueId && t.status !== "complete"
              ? { ...t, status: "complete" }
              : t
          )
        );
      }
    },
    []
  );

  // ── Newsroom: editorial checklists ───────────────────────────────────────
  const toggleChecklistItem = useCallback(
    (input: { taskId: string; key: string; by: string; checked?: boolean }) => {
      setChecklists((prev) => {
        let list = prev.find((c) => c.taskId === input.taskId);
        let nextList: EditorialChecklist[];
        const now = new Date().toISOString();
        if (!list) {
          // Seed a default list lazily so toggles "just work" on any task.
          const task = tasks.find((t) => t.id === input.taskId);
          const isBusiness =
            task?.sectionId === "sec-business" ||
            task?.sectionId === "sec-markets";
          const isSensitive = !!task?.sensitive;
          const seeded: EditorialChecklist = {
            taskId: input.taskId,
            items: defaultChecklistItems({ isBusiness, isSensitive }),
            updatedAt: now,
          };
          list = seeded;
          nextList = [...prev, seeded];
        } else {
          nextList = prev.slice();
        }
        const idx = nextList.findIndex((c) => c.taskId === input.taskId);
        const items = nextList[idx].items.map((it): ChecklistItem => {
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
        nextList[idx] = { ...nextList[idx], items, updatedAt: now };
        return nextList;
      });
    },
    [tasks]
  );

  // ── Newsroom: sensitive flags ────────────────────────────────────────────
  const raiseSensitiveFlag = useCallback(
    (input: {
      taskId: string;
      raisedById: string;
      reason: SensitiveReason;
      notes: string;
    }): SensitiveFlag => {
      const flag: SensitiveFlag = {
        id: nextId("sf"),
        taskId: input.taskId,
        reason: input.reason,
        notes: input.notes,
        status: "open",
        raisedById: input.raisedById,
        raisedAt: new Date().toISOString(),
      };
      setTasks((prev) =>
        prev.map((t) => (t.id === input.taskId ? { ...t, sensitive: flag } : t))
      );
      // Auto-add the sensitive checklist group if missing.
      setChecklists((prev) => {
        const existing = prev.find((c) => c.taskId === input.taskId);
        if (existing && existing.items.some((i) => i.group === "sensitive")) {
          return prev;
        }
        const sensitiveItems = defaultChecklistItems({
          isBusiness: false,
          isSensitive: true,
        }).filter((i) => i.group === "sensitive");
        if (existing) {
          return prev.map((c) =>
            c.taskId === input.taskId
              ? {
                  ...c,
                  items: [...c.items, ...sensitiveItems],
                  updatedAt: new Date().toISOString(),
                }
              : c
          );
        }
        return [
          ...prev,
          {
            taskId: input.taskId,
            items: defaultChecklistItems({
              isBusiness: false,
              isSensitive: true,
            }),
            updatedAt: new Date().toISOString(),
          },
        ];
      });
      // Notify leaders + admins for triage.
      for (const u of usersState.filter(
        (x) => x.role === "leader" || x.role === "admin"
      )) {
        pushNotification({
          userId: u.id,
          kind: "review_decision",
          title: "Sensitive story flagged",
          body: input.notes.slice(0, 120),
        });
      }
      return flag;
    },
    [usersState, pushNotification]
  );

  const decideSensitiveFlag = useCallback(
    (input: {
      taskId: string;
      decidedById: string;
      status: "cleared" | "holding";
      note?: string;
    }) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== input.taskId || !t.sensitive) return t;
          return {
            ...t,
            sensitive: {
              ...t.sensitive,
              status: input.status,
              decidedById: input.decidedById,
              decidedAt: new Date().toISOString(),
              decisionNote: input.note,
            },
          };
        })
      );
      const task = tasks.find((t) => t.id === input.taskId);
      if (task) {
        pushNotification({
          userId: task.writerId,
          kind: "review_decision",
          title:
            input.status === "cleared"
              ? `Sensitive review cleared: ${task.title}`
              : `Sensitive review on hold: ${task.title}`,
          body: input.note,
        });
      }
    },
    [tasks, pushNotification]
  );

  const markAllRead = useCallback((userId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.userId === userId ? { ...n, read: true } : n))
    );
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
      mode: dataMode,
      hydrated,
      hydrationError,
      refresh,
      runDeadlineScan,
      resetDeadlineReminders,
    };

    // ── Supabase mode: every mutation persists through the API client and
    //    then re-hydrates so the local cache reflects server-side cascades.
    if (api) {
      const persist = async <T,>(op: Promise<T>): Promise<T> => {
        const result = await op;
        await refresh();
        return result;
      };
      return {
        ...collections,
        setTaskStatus: async (id, status) => {
          await persist(api.setTaskStatus(id, status));
        },
        createTask: (input) => persist(api.createTask(input)),
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
        createSubmission: (input) => persist(api.createSubmission(input)),
        submitReview: (input) => persist(api.createReview(input)),
        addComment: (input) => persist(api.createComment(input)),
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
        },
        requestExtension: (input) => persist(api.requestExtension(input)),
        decideExtension: async (input) => {
          await persist(api.decideExtension(input));
        },
        createModerationReport: (input) =>
          persist(api.createModerationReport(input)),
        updateModerationReport: async (id, patch) => {
          await persist(api.updateModerationReport(id, patch));
        },
        hideMessage: async (id) => {
          await persist(api.hideMessage(id));
        },
        createPitch: (input) => persist(api.createPitch(input)),
        decidePitch: (input) => persist(api.decidePitch(input)),
        convertPitch: (input) => persist(api.convertPitch(input)),
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
        raiseSensitiveFlag: (input) => persist(api.raiseSensitiveFlag(input)),
        decideSensitiveFlag: async (input) => {
          await persist(api.decideSensitiveFlag(input));
        },
      };
    }

    // ── Mock mode: the synchronous in-memory mutations, surfaced through the
    //    same async contract so callers are mode-agnostic.
    return {
      ...collections,
      setTaskStatus: async (id, status) => {
        setTaskStatus(id, status);
      },
      createTask: async (input) => createTask(input),
      updateTask: async (id, patch) => {
        updateTask(id, patch);
      },
      updateUserRole: async (id, role) => {
        updateUserRole(id, role);
      },
      setUserActive: async (id, active) => {
        setUserActive(id, active);
      },
      togglePinMessage: async (id) => {
        togglePinMessage(id);
      },
      createSubmission: async (input) => createSubmission(input),
      submitReview: async (input) => submitReview(input),
      addComment: async (input) => addComment(input),
      toggleResolveComment: async (id) => {
        toggleResolveComment(id);
      },
      sendMessage: async (input) => sendMessage(input),
      createConversation: async (input) => createConversation(input),
      markNotificationRead: async (id, read) => {
        markNotificationRead(id, read);
      },
      markAllRead: async (userId) => {
        markAllRead(userId);
      },
      pushNotification: async (input) => {
        pushNotification(input);
      },
      requestExtension: async (input) => requestExtension(input),
      decideExtension: async (input) => {
        decideExtension(input);
      },
      createModerationReport: async (input) => createModerationReport(input),
      updateModerationReport: async (id, patch) => {
        updateModerationReport(id, patch);
      },
      hideMessage: async (id) => {
        hideMessage(id);
      },
      createPitch: async (input) => createPitch(input),
      decidePitch: async (input) => decidePitch(input),
      convertPitch: async (input) => convertPitch(input),
      addIssueSlot: async (input) => addIssueSlot(input),
      removeIssueSlot: async (id) => {
        removeIssueSlot(id);
      },
      setIssueStatus: async (id, status) => {
        setIssueStatus(id, status);
      },
      toggleChecklistItem: async (input) => {
        toggleChecklistItem(input);
      },
      raiseSensitiveFlag: async (input) => raiseSensitiveFlag(input),
      decideSensitiveFlag: async (input) => {
        decideSensitiveFlag(input);
      },
    };
  }, [
    api,
    dataMode,
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
    setTaskStatus,
    createTask,
    updateTask,
    updateUserRole,
    setUserActive,
    togglePinMessage,
    createSubmission,
    submitReview,
    addComment,
    toggleResolveComment,
    sendMessage,
    createConversation,
    markNotificationRead,
    markAllRead,
    pushNotification,
    runDeadlineScan,
    resetDeadlineReminders,
    requestExtension,
    decideExtension,
    createModerationReport,
    updateModerationReport,
    hideMessage,
    createPitch,
    decidePitch,
    convertPitch,
    addIssueSlot,
    removeIssueSlot,
    setIssueStatus,
    toggleChecklistItem,
    raiseSensitiveFlag,
    decideSensitiveFlag,
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
