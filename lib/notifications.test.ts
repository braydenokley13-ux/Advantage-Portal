import { describe, expect, it } from "vitest";
import { NOTIFICATION_META, NOTIFICATION_ORDER } from "./notifications";
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

describe("NOTIFICATION_META", () => {
  it("has an entry for every notification kind", () => {
    for (const kind of ALL_KINDS) {
      expect(NOTIFICATION_META[kind]).toBeDefined();
    }
  });

  it("each entry carries a label, description, icon and tone", () => {
    for (const kind of ALL_KINDS) {
      const meta = NOTIFICATION_META[kind];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.icon).toBeTruthy();
      expect(meta.tone).toMatch(/bg-/);
    }
  });
});

describe("NOTIFICATION_ORDER", () => {
  it("lists every kind exactly once", () => {
    expect([...NOTIFICATION_ORDER].sort()).toEqual([...ALL_KINDS].sort());
    expect(new Set(NOTIFICATION_ORDER).size).toBe(NOTIFICATION_ORDER.length);
  });
});
