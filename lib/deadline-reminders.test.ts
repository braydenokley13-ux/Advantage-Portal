import { describe, expect, it } from "vitest";
import {
  daysUntilDeadline,
  reminderKey,
  scanDeadlineReminders,
} from "./deadline-reminders";
import { isoOffsetDays, makeTask, makeUser } from "./test-fixtures";

const NOW = new Date("2026-05-18T12:00:00.000Z");

const writer = makeUser({ id: "writer-1", role: "writer" });
const editor = makeUser({ id: "editor-1", role: "editor" });
const leader = makeUser({ id: "leader-1", role: "leader" });
const users = [writer, editor, leader];

describe("daysUntilDeadline", () => {
  it("counts whole days, ignoring time of day", () => {
    expect(daysUntilDeadline(isoOffsetDays(7, NOW), NOW)).toBe(7);
    expect(daysUntilDeadline(isoOffsetDays(0, NOW), NOW)).toBe(0);
    expect(daysUntilDeadline(isoOffsetDays(-2, NOW), NOW)).toBe(-2);
  });
});

describe("scanDeadlineReminders thresholds", () => {
  function scanFor(days: number) {
    const task = makeTask({
      id: "task-1",
      writerId: "writer-1",
      editorId: "editor-1",
      status: "in_progress",
      deadline: isoOffsetDays(days, NOW),
    });
    return scanDeadlineReminders({
      tasks: [task],
      users,
      issuedKeys: new Set(),
      now: NOW,
    });
  }

  it("fires a 7-day reminder for writer and editor", () => {
    const out = scanFor(7);
    expect(out.map((r) => r.kind)).toEqual(["7d", "7d"]);
    expect(out.map((r) => r.userId).sort()).toEqual(["editor-1", "writer-1"]);
  });

  it("fires a 3-day reminder", () => {
    expect(scanFor(3).every((r) => r.kind === "3d")).toBe(true);
    expect(scanFor(3)).toHaveLength(2);
  });

  it("fires a 1-day reminder", () => {
    expect(scanFor(1).every((r) => r.kind === "1d")).toBe(true);
  });

  it("fires an overdue reminder and escalates to leaders", () => {
    const out = scanFor(-1);
    expect(out.every((r) => r.kind === "missed")).toBe(true);
    expect(out.map((r) => r.userId).sort()).toEqual([
      "editor-1",
      "leader-1",
      "writer-1",
    ]);
    expect(out[0].title).toContain("Overdue");
  });

  it("does not fire for non-threshold days (e.g. 5 days out)", () => {
    expect(scanFor(5)).toEqual([]);
  });
});

describe("scanDeadlineReminders dedupe & completion", () => {
  it("re-running with the same issuedKeys produces no duplicates", () => {
    const task = makeTask({
      id: "task-1",
      writerId: "writer-1",
      editorId: "editor-1",
      status: "in_progress",
      deadline: isoOffsetDays(3, NOW),
    });
    const first = scanDeadlineReminders({
      tasks: [task],
      users,
      issuedKeys: new Set(),
      now: NOW,
    });
    expect(first).toHaveLength(2);

    const issued = new Set(first.map((r) => r.key));
    const second = scanDeadlineReminders({
      tasks: [task],
      users,
      issuedKeys: issued,
      now: NOW,
    });
    expect(second).toEqual([]);
  });

  it("excludes completed tasks", () => {
    const task = makeTask({
      id: "task-1",
      writerId: "writer-1",
      status: "complete",
      deadline: isoOffsetDays(-1, NOW),
    });
    expect(
      scanDeadlineReminders({
        tasks: [task],
        users,
        issuedKeys: new Set(),
        now: NOW,
      })
    ).toEqual([]);
  });

  it("reminderKey is unique per task/kind/user", () => {
    expect(reminderKey("t1", "7d", "u1")).toBe("t1:7d:u1");
    expect(reminderKey("t1", "missed", "u1")).not.toBe(
      reminderKey("t1", "7d", "u1")
    );
  });
});
