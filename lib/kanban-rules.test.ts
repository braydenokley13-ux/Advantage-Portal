import { describe, expect, it } from "vitest";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  canDragTask,
  canDropTask,
  isValidTransition,
} from "./kanban-rules";
import type { Role, TaskStatus } from "./types";

const roles: Role[] = ["writer", "editor", "leader", "admin"];

describe("STATUS_ORDER / STATUS_LABELS", () => {
  it("orders the four canonical statuses", () => {
    expect(STATUS_ORDER).toEqual([
      "not_started",
      "in_progress",
      "submitted",
      "complete",
    ]);
  });
  it("labels every status", () => {
    for (const s of STATUS_ORDER) expect(STATUS_LABELS[s]).toBeTruthy();
  });
});

describe("canDragTask", () => {
  it("lets leader and admin drag any task from any column", () => {
    for (const role of ["leader", "admin"] as Role[]) {
      for (const from of STATUS_ORDER) {
        expect(canDragTask({ role, isOwnTask: false, from })).toBe(true);
      }
    }
  });
  it("never lets an editor drag", () => {
    for (const from of STATUS_ORDER) {
      expect(canDragTask({ role: "editor", isOwnTask: true, from })).toBe(false);
    }
  });
  it("lets a writer drag only their own task from not_started or in_progress", () => {
    expect(
      canDragTask({ role: "writer", isOwnTask: true, from: "not_started" })
    ).toBe(true);
    expect(
      canDragTask({ role: "writer", isOwnTask: true, from: "in_progress" })
    ).toBe(true);
    expect(
      canDragTask({ role: "writer", isOwnTask: true, from: "submitted" })
    ).toBe(false);
    expect(
      canDragTask({ role: "writer", isOwnTask: false, from: "in_progress" })
    ).toBe(false);
  });
});

describe("canDropTask", () => {
  it("lets leader and admin drop into any column", () => {
    for (const role of ["leader", "admin"] as Role[]) {
      for (const to of STATUS_ORDER) {
        expect(canDropTask({ role, isOwnTask: false, to })).toBe(true);
      }
    }
  });
  it("never lets an editor drop", () => {
    for (const to of STATUS_ORDER) {
      expect(canDropTask({ role: "editor", isOwnTask: true, to })).toBe(false);
    }
  });
  it("lets a writer drop their own task into not_started, in_progress, or submitted", () => {
    expect(
      canDropTask({ role: "writer", isOwnTask: true, to: "in_progress" })
    ).toBe(true);
    // Drag-to-submit: the board routes this drop into the submission composer.
    expect(
      canDropTask({ role: "writer", isOwnTask: true, to: "submitted" })
    ).toBe(true);
    expect(
      canDropTask({ role: "writer", isOwnTask: true, to: "complete" })
    ).toBe(false);
    expect(
      canDropTask({ role: "writer", isOwnTask: false, to: "in_progress" })
    ).toBe(false);
  });
});

describe("isValidTransition", () => {
  it("treats a same-status move as valid (no-op)", () => {
    for (const s of STATUS_ORDER) expect(isValidTransition(s, s)).toBe(true);
  });
  it("allows the forward state machine moves", () => {
    expect(isValidTransition("not_started", "in_progress")).toBe(true);
    expect(isValidTransition("in_progress", "submitted")).toBe(true);
    expect(isValidTransition("in_progress", "not_started")).toBe(true);
    expect(isValidTransition("submitted", "complete")).toBe(true);
    expect(isValidTransition("submitted", "in_progress")).toBe(true);
  });
  it("blocks skipping states and moving out of complete", () => {
    expect(isValidTransition("not_started", "submitted")).toBe(false);
    expect(isValidTransition("not_started", "complete")).toBe(false);
    expect(isValidTransition("in_progress", "complete")).toBe(false);
    for (const to of ["not_started", "in_progress", "submitted"] as TaskStatus[]) {
      expect(isValidTransition("complete", to)).toBe(false);
    }
  });
  it("never throws for any role over any status pair", () => {
    for (const role of roles) {
      for (const from of STATUS_ORDER) {
        for (const to of STATUS_ORDER) {
          expect(typeof isValidTransition(from, to)).toBe("boolean");
        }
        expect(typeof canDragTask({ role, isOwnTask: true, from })).toBe(
          "boolean"
        );
      }
    }
  });
});
