import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emailOnComment,
  emailOnIssuePublished,
  emailOnModerationResolved,
  emailOnTaskCompleted,
  emailOnTaskEdited,
} from "./workflow";
import type { Task } from "@/lib/types";

function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Recipients (userId) of every email sent, in order. */
function recipients(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(
    (c) => JSON.parse((c[1] as RequestInit).body as string).userId as string
  );
}

/** Decoded payload of the nth email. */
function payload(fetchMock: ReturnType<typeof vi.fn>, n = 0) {
  return JSON.parse((fetchMock.mock.calls[n][1] as RequestInit).body as string);
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Quarterly outlook",
    instructions: "Cover the beats.",
    writerId: "w1",
    editorId: "e1",
    deadline: "2026-07-01T17:00:00.000Z",
    status: "in_progress",
    color: "green",
    createdAt: "2026-06-01T12:00:00.000Z",
    ...overrides,
  } as Task;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("emailOnComment — counterpart aware", () => {
  it("notifies the editor when the writer comments", () => {
    const fetchMock = mockFetch();
    emailOnComment(makeTask(), "w1");
    expect(recipients(fetchMock)).toEqual(["e1"]);
  });

  it("notifies the writer when the editor comments", () => {
    const fetchMock = mockFetch();
    emailOnComment(makeTask(), "e1");
    expect(recipients(fetchMock)).toEqual(["w1"]);
  });

  it("notifies both writer and editor when a leader/admin comments", () => {
    const fetchMock = mockFetch();
    emailOnComment(makeTask(), "leader-9");
    expect(recipients(fetchMock).sort()).toEqual(["e1", "w1"]);
  });

  it("sends nothing when the writer comments on a task with no editor", () => {
    const fetchMock = mockFetch();
    emailOnComment(makeTask({ editorId: undefined }), "w1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("emailOnTaskEdited", () => {
  it("emails a newly assigned writer", () => {
    const fetchMock = mockFetch();
    emailOnTaskEdited({
      previous: makeTask({ writerId: "w1" }),
      next: makeTask({ writerId: "w2" }),
    });
    expect(recipients(fetchMock)).toEqual(["w2"]);
    expect(payload(fetchMock).kind).toBe("task_assigned");
  });

  it("emails a newly assigned editor", () => {
    const fetchMock = mockFetch();
    emailOnTaskEdited({
      previous: makeTask({ editorId: "e1" }),
      next: makeTask({ editorId: "e2" }),
    });
    expect(recipients(fetchMock)).toEqual(["e2"]);
  });

  it("pings writer and editor on a deadline change", () => {
    const fetchMock = mockFetch();
    emailOnTaskEdited({
      previous: makeTask({ deadline: "2026-07-01T17:00:00.000Z" }),
      next: makeTask({ deadline: "2026-07-08T17:00:00.000Z" }),
    });
    expect(recipients(fetchMock).sort()).toEqual(["e1", "w1"]);
    expect(payload(fetchMock).kind).toBe("deadline");
  });

  it("does not double-notify a reassignee who already got the new deadline", () => {
    const fetchMock = mockFetch();
    emailOnTaskEdited({
      previous: makeTask({ writerId: "w1", deadline: "2026-07-01T17:00:00.000Z" }),
      next: makeTask({ writerId: "w2", deadline: "2026-07-08T17:00:00.000Z" }),
    });
    // w2 gets a single assignment email; e1 gets the deadline ping. w2 is not
    // also sent a redundant deadline email.
    const got = recipients(fetchMock);
    expect(got.filter((id) => id === "w2")).toHaveLength(1);
    expect(got.sort()).toEqual(["e1", "w2"]);
  });

  it("sends nothing when nothing relevant changed", () => {
    const fetchMock = mockFetch();
    const t = makeTask();
    emailOnTaskEdited({ previous: t, next: makeTask({ title: "Renamed" }) });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("emailOnTaskCompleted", () => {
  it("emails the writer a completion milestone", () => {
    const fetchMock = mockFetch();
    emailOnTaskCompleted(makeTask());
    expect(recipients(fetchMock)).toEqual(["w1"]);
    expect(payload(fetchMock).kind).toBe("task_complete");
  });
});

describe("emailOnModerationResolved", () => {
  it("gives each reporter closure once, without disclosing the outcome", () => {
    const fetchMock = mockFetch();
    emailOnModerationResolved(["r1", "r1", undefined, "r2"]);
    expect(recipients(fetchMock).sort()).toEqual(["r1", "r2"]);
    const p = payload(fetchMock);
    expect(p.title).toMatch(/reviewed/i);
    expect(p.actionPath).toBe("/notifications");
  });
});

describe("emailOnIssuePublished", () => {
  it("congratulates each writer once, dropping blanks and dupes", () => {
    const fetchMock = mockFetch();
    emailOnIssuePublished("Spring Edition", ["w1", "w1", undefined, "w2", null]);
    expect(recipients(fetchMock).sort()).toEqual(["w1", "w2"]);
    expect(payload(fetchMock).kind).toBe("task_complete");
    expect(payload(fetchMock).title).toContain("Spring Edition");
  });
});
