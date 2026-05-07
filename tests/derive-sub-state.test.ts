/**
 * deriveSubState — kanban + reviews surfaces depend on this to flag a task
 * that has bounced back to in_progress after a "changes_requested" review.
 * The selector is pure and joins reviews + a submission→task index, so any
 * caller that swaps mock and Supabase data sources must produce the same
 * output for the same shape.
 *
 * Run with: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSubState } from "../lib/status.ts";
import type { Review, Task } from "../lib/types.ts";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Test piece",
    instructions: "",
    writerId: "u-writer",
    editorId: "u-editor",
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    status: "in_progress",
    color: "green",
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    ...overrides,
  };
}

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: "r1",
    submissionId: "s1",
    reviewerId: "u-editor",
    decision: "changes_requested",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const indexFor = (...pairs: [string, string][]): Map<string, string> =>
  new Map(pairs);

test("deriveSubState: returns null when task is not in_progress", () => {
  for (const status of ["not_started", "submitted", "complete"] as const) {
    assert.equal(
      deriveSubState({
        task: task({ status }),
        reviews: [],
        submissionTaskMap: new Map(),
      }),
      null,
      status
    );
  }
});

test("deriveSubState: fresh_draft when in_progress and no reviews on this task", () => {
  assert.equal(
    deriveSubState({
      task: task(),
      reviews: [review({ submissionId: "s-other" })],
      submissionTaskMap: indexFor(["s-other", "t-other"]),
    }),
    "fresh_draft"
  );
});

test("deriveSubState: changes_requested when latest review on this task asked for changes", () => {
  const t = task({ id: "t1" });
  const reviews: Review[] = [
    review({
      id: "old",
      submissionId: "s1",
      decision: "approved",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    }),
    review({
      id: "new",
      submissionId: "s1",
      decision: "changes_requested",
      createdAt: new Date().toISOString(),
    }),
  ];
  assert.equal(
    deriveSubState({
      task: t,
      reviews,
      submissionTaskMap: indexFor(["s1", "t1"]),
    }),
    "changes_requested"
  );
});

test("deriveSubState: null (clean drafting) when latest review approved", () => {
  const reviews: Review[] = [
    review({
      submissionId: "s1",
      decision: "changes_requested",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    }),
    // Latest review approved — but task somehow returned to in_progress.
    review({
      id: "r2",
      submissionId: "s1",
      decision: "approved",
      createdAt: new Date().toISOString(),
    }),
  ];
  assert.equal(
    deriveSubState({
      task: task(),
      reviews,
      submissionTaskMap: indexFor(["s1", "t1"]),
    }),
    null
  );
});

test("deriveSubState: ignores reviews on submissions belonging to other tasks", () => {
  assert.equal(
    deriveSubState({
      task: task({ id: "t1" }),
      reviews: [
        review({
          submissionId: "s99",
          decision: "changes_requested",
        }),
      ],
      submissionTaskMap: indexFor(["s99", "t99"]),
    }),
    "fresh_draft"
  );
});

test("deriveSubState: returns fresh_draft when submissionTaskMap is missing", () => {
  // Without the index we cannot tell which reviews belong to this task,
  // so the safest call is to treat it as a brand-new draft. This matches
  // the kanban's behaviour during the initial render before submissions
  // load, so the card doesn't flash an incorrect "Changes Requested" tag.
  assert.equal(
    deriveSubState({
      task: task(),
      reviews: [review({ decision: "changes_requested" })],
      submissionTaskMap: undefined,
    }),
    "fresh_draft"
  );
});
