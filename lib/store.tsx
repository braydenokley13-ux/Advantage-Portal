"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  conversations as seedConversations,
  messages as seedMessages,
  notifications as seedNotifications,
  submissions as seedSubmissions,
  tasks as seedTasks,
  users,
} from "./mock-data";
import {
  scanDeadlineReminders,
  type DeadlineReminder,
} from "./deadline-reminders";
import type {
  Comment,
  Conversation,
  Message,
  Notification,
  NotificationKind,
  Review,
  ReviewDecision,
  Role,
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

  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  createTask: (input: {
    title: string;
    instructions: string;
    writerId: string;
    editorId?: string;
    deadline: string;
    color?: TaskColor;
  }) => Task;
  updateTask: (
    taskId: string,
    patch: Partial<Pick<Task, "title" | "instructions" | "writerId" | "editorId" | "deadline" | "color">>
  ) => void;
  updateUserRole: (userId: string, role: Role) => void;
  setUserActive: (userId: string, active: boolean) => void;
  togglePinMessage: (messageId: string) => void;
  createSubmission: (input: {
    taskId: string;
    authorId: string;
    type: SubmissionType;
    content: string;
    file?: SubmissionFileMeta;
  }) => Submission;
  submitReview: (input: {
    submissionId: string;
    reviewerId: string;
    decision: ReviewDecision;
    notes?: string;
  }) => Review;
  addComment: (input: {
    submissionId: string;
    authorId: string;
    body: string;
    inline?: boolean;
    lineNumber?: number;
  }) => Comment;
  toggleResolveComment: (commentId: string) => void;
  sendMessage: (input: {
    conversationId: string;
    authorId: string;
    body: string;
  }) => Message;
  createConversation: (input: {
    kind: Conversation["kind"];
    title: string;
    memberIds: string[];
  }) => Conversation;
  markNotificationRead: (id: string, read?: boolean) => void;
  markAllRead: (userId: string) => void;
  pushNotification: (input: {
    userId: string;
    kind: NotificationKind;
    title: string;
    body?: string;
  }) => void;
  runDeadlineScan: (input?: { now?: Date }) => DeadlineReminder[];
  resetDeadlineReminders: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

let _id = 1000;
const nextId = (prefix: string) => `${prefix}${++_id}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [usersState, setUsersState] = useState<User[]>(() =>
    users.map((u) => ({ active: true, ...u }))
  );
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [submissions, setSubmissions] = useState<Submission[]>(seedSubmissions);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [conversations, setConversations] =
    useState<Conversation[]>(seedConversations);
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [notifications, setNotifications] =
    useState<Notification[]>(seedNotifications);
  const [issuedReminderKeys, setIssuedReminderKeys] = useState<Set<string>>(
    () => new Set()
  );

  const setTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
  }, []);

  const createTask = useCallback<StoreValue["createTask"]>((input) => {
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
  }, []);

  const updateTask = useCallback<StoreValue["updateTask"]>((taskId, patch) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  }, []);

  const updateUserRole = useCallback<StoreValue["updateUserRole"]>(
    (userId, role) => {
      setUsersState((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      );
    },
    []
  );

  const setUserActive = useCallback<StoreValue["setUserActive"]>(
    (userId, active) => {
      setUsersState((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, active } : u))
      );
    },
    []
  );

  const togglePinMessage = useCallback<StoreValue["togglePinMessage"]>(
    (messageId) => {
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
    },
    []
  );

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

  const createSubmission = useCallback<StoreValue["createSubmission"]>(
    (input) => {
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

  const submitReview = useCallback<StoreValue["submitReview"]>(
    (input) => {
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
      const task = sub
        ? tasks.find((t) => t.id === sub.taskId)
        : undefined;
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

  const addComment = useCallback<StoreValue["addComment"]>(
    (input) => {
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
      const task = sub
        ? tasks.find((t) => t.id === sub.taskId)
        : undefined;
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

  const sendMessage = useCallback<StoreValue["sendMessage"]>(
    (input) => {
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

  const createConversation = useCallback<StoreValue["createConversation"]>(
    (input) => {
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

  const markNotificationRead = useCallback(
    (id: string, read = true) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read } : n))
      );
    },
    []
  );

  const runDeadlineScan = useCallback<StoreValue["runDeadlineScan"]>(
    (input) => {
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

  const markAllRead = useCallback((userId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.userId === userId ? { ...n, read: true } : n))
    );
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      users: usersState,
      tasks,
      submissions,
      reviews,
      comments,
      conversations,
      messages,
      notifications,
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
    }),
    [
      usersState,
      tasks,
      submissions,
      reviews,
      comments,
      conversations,
      messages,
      notifications,
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
    ]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
