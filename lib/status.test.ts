import { describe, expect, it } from "vitest";
import {
  STATUS_DEFINITIONS,
  SUBSTATE_LABEL,
  deriveSubState,
} from "./status";
import { makeTask } from "./test-fixtures";
import type { Review, TaskStatus } from "./types";

describe("STATUS_DEFINITIONS", () => {
  const statuses: TaskStatus[] = [
    "not_started",
    "in_progress",
    "submitted",
    "complete",
  ];
  it("defines a label, description, next actions and tone for every status", () => {
    for (const s of statuses) {
      const def = STATUS_DEFINITIONS[s];
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.nextAction.writer).toBeTruthy();
      expect(def.nextAction.editor).toBeTruthy();
      expect(def.nextAction.leader).toBeTruthy();
      expect(["default", "secondary", "warning", "success"]).toContain(
        def.badgeTone
      );
    }
  });
  it("maps submitted to a warning tone and complete to success", () => {
    expect(STATUS_DEFINITIONS.submitted.badgeTone).toBe("warning");
    expect(STATUS_DEFINITIONS.complete.badgeTone).toBe("success");
  });
});

describe("deriveSubState", () => {
  it("returns null for tasks not in progress", () => {
    expect(
      deriveSubState({ task: makeTask({ status: "submitted" }), reviews: [] })
    ).toBeNull();
    expect(
      deriveSubState({ task: makeTask({ status: "complete" }), reviews: [] })
    ).toBeNull();
  });
  it("returns fresh_draft for an in_progress task with no prior reviews", () => {
    expect(
      deriveSubState({ task: makeTask({ status: "in_progress" }), reviews: [] })
    ).toBe("fresh_draft");
  });
  it("returns changes_requested when the latest review asked for changes", () => {
    const task = makeTask({ id: "task-cr", status: "in_progress" });
    const reviews: Review[] = [
      {
        id: "r1",
        submissionId: "s1",
        reviewerId: "editor-1",
        decision: "approved",
        createdAt: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "r2",
        submissionId: "s1",
        reviewerId: "editor-1",
        decision: "changes_requested",
        createdAt: "2026-05-05T00:00:00.000Z",
      },
    ];
    const map = new Map([["s1", "task-cr"]]);
    expect(
      deriveSubState({ task, reviews, submissionTaskMap: map })
    ).toBe("changes_requested");
  });
  it("returns null when the latest review approved the draft", () => {
    const task = makeTask({ id: "task-ok", status: "in_progress" });
    const reviews: Review[] = [
      {
        id: "r1",
        submissionId: "s1",
        reviewerId: "editor-1",
        decision: "approved",
        createdAt: "2026-05-05T00:00:00.000Z",
      },
    ];
    const map = new Map([["s1", "task-ok"]]);
    expect(deriveSubState({ task, reviews, submissionTaskMap: map })).toBeNull();
  });
});

describe("SUBSTATE_LABEL", () => {
  it("labels both derived sub-states", () => {
    expect(SUBSTATE_LABEL.fresh_draft).toBe("Drafting");
    expect(SUBSTATE_LABEL.changes_requested).toBe("Changes Requested");
  });
});
