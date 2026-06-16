import { describe, expect, it } from "vitest";
import {
  canComment,
  canCreateConversation,
  canCreateTask,
  canEditTask,
  canForceComplete,
  canManageUsers,
  canModerate,
  canPinMessage,
  canPostAnnouncement,
  canPostInConversation,
  canReview,
  canSubmit,
  canViewTeam,
  visibleConversations,
} from "./permissions";
import { makeTask, makeUsersByRole } from "./test-fixtures";
import type { Conversation, ConversationKind, Role } from "./types";

const roles: Role[] = ["writer", "editor", "leader", "admin"];
const users = makeUsersByRole();

describe("canSubmit", () => {
  it("allows the owning writer on an unfinished task", () => {
    const task = makeTask({ writerId: "writer-1", status: "in_progress" });
    expect(canSubmit({ task, user: users.writer })).toBe(true);
  });
  it("rejects a writer who does not own the task", () => {
    const task = makeTask({ writerId: "other", status: "in_progress" });
    expect(canSubmit({ task, user: users.writer })).toBe(false);
  });
  it("rejects when the task is complete", () => {
    const task = makeTask({ writerId: "writer-1", status: "complete" });
    expect(canSubmit({ task, user: users.writer })).toBe(false);
  });
  it("rejects non-writers", () => {
    const task = makeTask({ writerId: "editor-1", status: "in_progress" });
    expect(canSubmit({ task, user: users.editor })).toBe(false);
    expect(canSubmit({ task, user: users.leader })).toBe(false);
    expect(canSubmit({ task, user: users.admin })).toBe(false);
  });
});

describe("canReview", () => {
  it("requires the task to be submitted", () => {
    const task = makeTask({ status: "in_progress", editorId: "editor-1" });
    expect(canReview({ task, user: users.editor })).toBe(false);
  });
  it("lets the assigned editor review a submitted task", () => {
    const task = makeTask({ status: "submitted", editorId: "editor-1" });
    expect(canReview({ task, user: users.editor })).toBe(true);
  });
  it("blocks an editor not assigned to the task", () => {
    const task = makeTask({ status: "submitted", editorId: "other" });
    expect(canReview({ task, user: users.editor })).toBe(false);
  });
  it("lets leader and admin review any submitted task", () => {
    const task = makeTask({ status: "submitted", editorId: "other" });
    expect(canReview({ task, user: users.leader })).toBe(true);
    expect(canReview({ task, user: users.admin })).toBe(true);
  });
  it("never lets a writer review their own task", () => {
    const task = makeTask({ status: "submitted", writerId: "writer-1" });
    expect(canReview({ task, user: users.writer })).toBe(false);
  });
});

describe("canForceComplete", () => {
  it("lets leader and admin complete an unfinished task without review", () => {
    const task = makeTask({ status: "submitted" });
    expect(canForceComplete({ task, user: users.leader })).toBe(true);
    expect(canForceComplete({ task, user: users.admin })).toBe(true);
  });
  it("works from any non-complete status", () => {
    for (const status of ["not_started", "in_progress", "submitted"] as const) {
      expect(
        canForceComplete({ task: makeTask({ status }), user: users.admin })
      ).toBe(true);
    }
  });
  it("blocks writers and editors", () => {
    const task = makeTask({ status: "submitted", editorId: "editor-1" });
    expect(canForceComplete({ task, user: users.writer })).toBe(false);
    expect(canForceComplete({ task, user: users.editor })).toBe(false);
  });
  it("is a no-op once the task is already complete", () => {
    const task = makeTask({ status: "complete" });
    expect(canForceComplete({ task, user: users.admin })).toBe(false);
  });
});

describe("canComment", () => {
  it("allows leader and admin always", () => {
    const task = makeTask({ writerId: "x", editorId: "y" });
    expect(canComment({ task, user: users.leader })).toBe(true);
    expect(canComment({ task, user: users.admin })).toBe(true);
  });
  it("allows the owning writer", () => {
    const task = makeTask({ writerId: "writer-1" });
    expect(canComment({ task, user: users.writer })).toBe(true);
  });
  it("allows the assigned editor only", () => {
    expect(
      canComment({ task: makeTask({ editorId: "editor-1" }), user: users.editor })
    ).toBe(true);
    expect(
      canComment({ task: makeTask({ editorId: "other" }), user: users.editor })
    ).toBe(false);
  });
});

describe("canCreateConversation", () => {
  const kinds: ConversationKind[] = [
    "dm",
    "group",
    "all_team",
    "issue",
    "admins_only",
  ];
  it("never allows all_team", () => {
    for (const role of roles) {
      expect(canCreateConversation(role, "all_team")).toBe(false);
    }
  });
  it("allows dm for every role", () => {
    for (const role of roles) {
      expect(canCreateConversation(role, "dm")).toBe(true);
    }
  });
  it("restricts admins_only to admin", () => {
    expect(canCreateConversation("admin", "admins_only")).toBe(true);
    expect(canCreateConversation("leader", "admins_only")).toBe(false);
    expect(canCreateConversation("editor", "admins_only")).toBe(false);
    expect(canCreateConversation("writer", "admins_only")).toBe(false);
  });
  it("restricts group and issue to leaders and admins", () => {
    for (const kind of ["group", "issue"] as ConversationKind[]) {
      expect(canCreateConversation("leader", kind)).toBe(true);
      expect(canCreateConversation("admin", kind)).toBe(true);
      expect(canCreateConversation("editor", kind)).toBe(false);
      expect(canCreateConversation("writer", kind)).toBe(false);
    }
  });
  it("covers every kind without throwing", () => {
    for (const kind of kinds) {
      for (const role of roles) {
        expect(typeof canCreateConversation(role, kind)).toBe("boolean");
      }
    }
  });
});

describe("canPostInConversation", () => {
  const conv = (
    kind: ConversationKind,
    memberIds: string[]
  ): Conversation => ({ id: "c1", kind, title: "t", memberIds });

  it("requires membership", () => {
    expect(
      canPostInConversation({
        conversation: conv("dm", ["other"]),
        user: users.writer,
      })
    ).toBe(false);
  });
  it("lets any member post in a dm or group", () => {
    expect(
      canPostInConversation({
        conversation: conv("dm", ["writer-1"]),
        user: users.writer,
      })
    ).toBe(true);
  });
  it("restricts all_team and admins_only posting to leaders and admins", () => {
    for (const kind of ["all_team", "admins_only"] as ConversationKind[]) {
      const all = ["writer-1", "editor-1", "leader-1", "admin-1"];
      expect(
        canPostInConversation({ conversation: conv(kind, all), user: users.writer })
      ).toBe(false);
      expect(
        canPostInConversation({ conversation: conv(kind, all), user: users.editor })
      ).toBe(false);
      expect(
        canPostInConversation({ conversation: conv(kind, all), user: users.leader })
      ).toBe(true);
      expect(
        canPostInConversation({ conversation: conv(kind, all), user: users.admin })
      ).toBe(true);
    }
  });
});

describe("visibleConversations", () => {
  it("returns only conversations the user is a member of", () => {
    const conversations: Conversation[] = [
      { id: "a", kind: "dm", title: "A", memberIds: ["writer-1", "editor-1"] },
      { id: "b", kind: "group", title: "B", memberIds: ["editor-1"] },
      { id: "c", kind: "all_team", title: "C", memberIds: ["writer-1"] },
    ];
    expect(
      visibleConversations({ conversations, user: users.writer }).map((c) => c.id)
    ).toEqual(["a", "c"]);
    expect(
      visibleConversations({ conversations, user: users.editor }).map((c) => c.id)
    ).toEqual(["a", "b"]);
    expect(
      visibleConversations({ conversations, user: users.admin })
    ).toEqual([]);
  });
});

describe("role gate helpers", () => {
  it("canCreateTask / canEditTask: leader and admin only", () => {
    expect(canCreateTask("writer")).toBe(false);
    expect(canCreateTask("editor")).toBe(false);
    expect(canCreateTask("leader")).toBe(true);
    expect(canCreateTask("admin")).toBe(true);
    expect(canEditTask("editor")).toBe(false);
    expect(canEditTask("leader")).toBe(true);
  });
  it("canViewTeam: everyone", () => {
    for (const role of roles) expect(canViewTeam(role)).toBe(true);
  });
  it("canManageUsers: admin only", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("leader")).toBe(false);
    expect(canManageUsers("editor")).toBe(false);
    expect(canManageUsers("writer")).toBe(false);
  });
  it("canPostAnnouncement / canPinMessage / canModerate: leader and admin", () => {
    for (const fn of [canPostAnnouncement, canPinMessage, canModerate]) {
      expect(fn("writer")).toBe(false);
      expect(fn("editor")).toBe(false);
      expect(fn("leader")).toBe(true);
      expect(fn("admin")).toBe(true);
    }
  });
});
