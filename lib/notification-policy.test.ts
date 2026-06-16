import { describe, expect, it } from "vitest";
import {
  EMAIL_DEFAULTS,
  defaultNotificationPath,
  shouldEmailNotification,
} from "./notification-policy";
import type { NotificationKind } from "./types";

const ALL_KINDS: NotificationKind[] = [
  "task_assigned",
  "deadline",
  "submission",
  "comment",
  "review_decision",
  "task_complete",
  "message",
  "announcement",
];

describe("EMAIL_DEFAULTS", () => {
  it("declares a boolean for every notification kind", () => {
    for (const kind of ALL_KINDS) {
      expect(typeof EMAIL_DEFAULTS[kind]).toBe("boolean");
    }
  });

  it("emails the important workflow events and milestones, staying quiet only on chat noise", () => {
    expect(EMAIL_DEFAULTS.task_assigned).toBe(true);
    expect(EMAIL_DEFAULTS.deadline).toBe(true);
    expect(EMAIL_DEFAULTS.submission).toBe(true);
    expect(EMAIL_DEFAULTS.comment).toBe(true);
    expect(EMAIL_DEFAULTS.review_decision).toBe(true);
    expect(EMAIL_DEFAULTS.announcement).toBe(true);
    // Completions/publishing are milestones worth an email.
    expect(EMAIL_DEFAULTS.task_complete).toBe(true);
    // Per-message chat emails would be pure noise; opt-in via preferences.
    expect(EMAIL_DEFAULTS.message).toBe(false);
  });
});

describe("shouldEmailNotification", () => {
  it("falls back to the defaults when no preference is supplied", () => {
    expect(shouldEmailNotification("review_decision")).toBe(true);
    expect(shouldEmailNotification("message")).toBe(false);
  });

  it("honours an explicit per-user override either way", () => {
    expect(shouldEmailNotification("message", { message: true })).toBe(true);
    expect(
      shouldEmailNotification("review_decision", { review_decision: false })
    ).toBe(false);
  });

  it("ignores an unrelated override and uses the default", () => {
    expect(shouldEmailNotification("deadline", { message: true })).toBe(true);
  });
});

describe("defaultNotificationPath", () => {
  it("returns an in-app path for every kind", () => {
    for (const kind of ALL_KINDS) {
      expect(defaultNotificationPath(kind)).toMatch(/^\//);
    }
  });

  it("routes review work to /reviews and writer-facing events to /tasks", () => {
    expect(defaultNotificationPath("submission")).toBe("/reviews");
    expect(defaultNotificationPath("comment")).toBe("/reviews");
    expect(defaultNotificationPath("review_decision")).toBe("/tasks");
    expect(defaultNotificationPath("task_assigned")).toBe("/tasks");
    expect(defaultNotificationPath("announcement")).toBe("/announcements");
    expect(defaultNotificationPath("message")).toBe("/messages");
  });
});
