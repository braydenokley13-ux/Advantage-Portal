import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dispatchNotificationEmail,
  fanOutNotificationEmail,
} from "./notify-client";

function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dispatchNotificationEmail", () => {
  it("posts to the notification email route for an important kind", () => {
    const fetchMock = mockFetch();
    dispatchNotificationEmail({
      userId: "u1",
      kind: "review_decision",
      title: "Approved: My story",
      body: "Nice work",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/email/notification");
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload).toMatchObject({
      userId: "u1",
      kind: "review_decision",
      title: "Approved: My story",
      body: "Nice work",
      actionPath: "/tasks",
    });
  });

  it("respects an explicit action path", () => {
    const fetchMock = mockFetch();
    dispatchNotificationEmail({
      userId: "u1",
      kind: "submission",
      title: "New draft",
      actionPath: "/reviews/123",
    });
    const payload = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(payload.actionPath).toBe("/reviews/123");
  });

  it("skips kinds that are email-quiet by default", () => {
    const fetchMock = mockFetch();
    dispatchNotificationEmail({ userId: "u1", kind: "message", title: "Hi" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honours a per-user override that opts a quiet kind back in", () => {
    const fetchMock = mockFetch();
    dispatchNotificationEmail({
      userId: "u1",
      kind: "message",
      title: "Hi",
      prefs: { message: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fanOutNotificationEmail", () => {
  it("de-dupes recipients and drops empty ids", () => {
    const fetchMock = mockFetch();
    fanOutNotificationEmail(["u1", "u1", undefined, "u2", null], {
      kind: "task_assigned",
      title: "Assigned: Story",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
