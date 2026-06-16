import { afterEach, describe, expect, it } from "vitest";
import {
  clearSubmissionDraft,
  loadSubmissionDraft,
  saveSubmissionDraft,
  submissionDraftKey,
} from "./draft-store";

afterEach(() => {
  window.localStorage.clear();
});

describe("submissionDraftKey", () => {
  it("namespaces the key per task", () => {
    expect(submissionDraftKey("task-1")).toBe(
      "advantage:draft:submission:task-1"
    );
    expect(submissionDraftKey("task-1")).not.toBe(submissionDraftKey("task-2"));
  });
});

describe("draft round-trip", () => {
  it("saves and loads a draft for a task", () => {
    saveSubmissionDraft("task-1", "my draft");
    expect(loadSubmissionDraft("task-1")).toBe("my draft");
  });

  it("isolates drafts between tasks", () => {
    saveSubmissionDraft("task-1", "one");
    saveSubmissionDraft("task-2", "two");
    expect(loadSubmissionDraft("task-1")).toBe("one");
    expect(loadSubmissionDraft("task-2")).toBe("two");
  });

  it("returns empty string when no draft exists", () => {
    expect(loadSubmissionDraft("missing")).toBe("");
  });

  it("removes (does not store) an empty/whitespace draft", () => {
    saveSubmissionDraft("task-1", "something");
    saveSubmissionDraft("task-1", "   ");
    expect(loadSubmissionDraft("task-1")).toBe("");
    expect(
      window.localStorage.getItem(submissionDraftKey("task-1"))
    ).toBeNull();
  });

  it("clears a saved draft", () => {
    saveSubmissionDraft("task-1", "draft");
    clearSubmissionDraft("task-1");
    expect(loadSubmissionDraft("task-1")).toBe("");
  });
});
