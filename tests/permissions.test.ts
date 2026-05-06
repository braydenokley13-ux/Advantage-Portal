/**
 * Permission tests — covers the ownership invariants that the writer /
 * editor / reviewer / commenter flows now rely on. The Supabase adapter
 * routes every mutation through methods whose RLS policies mirror these
 * helpers, so this is the canonical contract.
 *
 * Run with:
 *   node --experimental-strip-types --test tests/permissions.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canComment,
  canReview,
  canSubmit,
} from "../lib/permissions.ts";
import type { Task, User } from "../lib/types.ts";

const writer: User = {
  id: "u-writer",
  name: "Alex",
  email: "alex@example.com",
  role: "writer",
};
const otherWriter: User = { ...writer, id: "u-writer-2" };
const assignedEditor: User = {
  id: "u-editor",
  name: "Casey",
  email: "casey@example.com",
  role: "editor",
};
const otherEditor: User = { ...assignedEditor, id: "u-editor-2" };
const leader: User = {
  id: "u-leader",
  name: "Riley",
  email: "riley@example.com",
  role: "leader",
};
const admin: User = {
  id: "u-admin",
  name: "Sam",
  email: "sam@example.com",
  role: "admin",
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Test piece",
    instructions: "",
    writerId: writer.id,
    editorId: assignedEditor.id,
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    status: "in_progress",
    color: "green",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── canSubmit ──────────────────────────────────────────────────────────────
test("canSubmit: writer can submit their own in-progress task", () => {
  assert.equal(canSubmit({ task: task(), user: writer }), true);
});

test("canSubmit: writer cannot submit someone else's task", () => {
  assert.equal(canSubmit({ task: task(), user: otherWriter }), false);
});

test("canSubmit: writer cannot submit a complete task", () => {
  assert.equal(
    canSubmit({ task: task({ status: "complete" }), user: writer }),
    false
  );
});

test("canSubmit: editor / leader / admin cannot submit (writers only)", () => {
  for (const u of [assignedEditor, leader, admin]) {
    assert.equal(canSubmit({ task: task(), user: u }), false, `${u.role}`);
  }
});

// ── canReview ─────────────────────────────────────────────────────────────
test("canReview: assigned editor can review a submitted task", () => {
  assert.equal(
    canReview({ task: task({ status: "submitted" }), user: assignedEditor }),
    true
  );
});

test("canReview: writer cannot review their own submission", () => {
  assert.equal(
    canReview({ task: task({ status: "submitted" }), user: writer }),
    false
  );
});

test("canReview: leader and admin can review any submitted task", () => {
  for (const u of [leader, admin]) {
    assert.equal(
      canReview({ task: task({ status: "submitted" }), user: u }),
      true,
      `${u.role}`
    );
  }
});

test("canReview: unrelated editor cannot review", () => {
  assert.equal(
    canReview({ task: task({ status: "submitted" }), user: otherEditor }),
    false
  );
});

test("canReview: nothing reviewable when status != submitted", () => {
  for (const status of ["not_started", "in_progress", "complete"] as const) {
    assert.equal(
      canReview({ task: task({ status }), user: assignedEditor }),
      false,
      status
    );
  }
});

// ── canComment ────────────────────────────────────────────────────────────
test("canComment: writer of task can comment", () => {
  assert.equal(canComment({ task: task(), user: writer }), true);
});

test("canComment: assigned editor can comment", () => {
  assert.equal(canComment({ task: task(), user: assignedEditor }), true);
});

test("canComment: leader / admin can always comment", () => {
  for (const u of [leader, admin]) {
    assert.equal(canComment({ task: task(), user: u }), true, u.role);
  }
});

test("canComment: unrelated writer cannot comment", () => {
  assert.equal(canComment({ task: task(), user: otherWriter }), false);
});

test("canComment: unrelated editor cannot comment", () => {
  assert.equal(canComment({ task: task(), user: otherEditor }), false);
});
