import { describe, expect, it } from "vitest";
import { STAGE_ORDER, deriveStoryStage, nextActionForRole } from "./newsroom-stage";
import { makeTask } from "./test-fixtures";
import type {
  ChecklistItem,
  EditorialChecklist,
  Issue,
  SensitiveFlag,
} from "./types";

function checklist(items: Partial<ChecklistItem>[]): EditorialChecklist {
  return {
    taskId: "task-1",
    updatedAt: "2026-05-01T00:00:00.000Z",
    items: items.map((i, idx) => ({
      key: i.key ?? `k-${idx}`,
      label: i.label ?? "Item",
      group: i.group ?? "general",
      checked: i.checked ?? false,
      required: i.required ?? true,
    })),
  };
}

const sectionKeys = ["g_headline", "g_lede", "g_claims", "g_sources", "g_quotes"];
function sectionItems(checked: boolean) {
  return sectionKeys.map((key) => ({ key, group: "general" as const, checked }));
}

describe("deriveStoryStage — base statuses", () => {
  it("unstarted task with a pitch is at the pitch stage", () => {
    const task = makeTask({ status: "not_started", pitchId: "pitch-1" });
    expect(deriveStoryStage({ task }).stage).toBe("pitch");
  });

  it("unstarted task without a pitch is drafting", () => {
    const task = makeTask({ status: "not_started" });
    expect(deriveStoryStage({ task }).stage).toBe("drafting");
  });

  it("in_progress task is drafting", () => {
    expect(
      deriveStoryStage({ task: makeTask({ status: "in_progress" }) }).stage
    ).toBe("drafting");
  });
});

describe("deriveStoryStage — submitted editorial passes", () => {
  it("submitted with no checklist sits in section_edit", () => {
    const task = makeTask({ status: "submitted" });
    const { stage, reasons } = deriveStoryStage({ task });
    expect(stage).toBe("section_edit");
    expect(reasons[0].code).toBe("section_edit_pending");
  });

  it("advances to copy_edit once section keys are checked", () => {
    const task = makeTask({ status: "submitted" });
    const { stage } = deriveStoryStage({
      task,
      checklist: checklist(sectionItems(true)),
    });
    expect(stage).toBe("copy_edit");
  });

  it("advances to fact_check once grammar is also checked", () => {
    const task = makeTask({ status: "submitted" });
    const { stage } = deriveStoryStage({
      task,
      checklist: checklist([
        ...sectionItems(true),
        { key: "g_grammar", group: "general", checked: true },
        { key: "b_1", group: "business", checked: false },
      ]),
    });
    expect(stage).toBe("fact_check");
  });

  it("reaches final_approval when all passes are complete", () => {
    const task = makeTask({ status: "submitted" });
    const { stage } = deriveStoryStage({
      task,
      checklist: checklist([
        ...sectionItems(true),
        { key: "g_grammar", group: "general", checked: true },
      ]),
    });
    expect(stage).toBe("final_approval");
  });
});

describe("deriveStoryStage — completion & gates", () => {
  it("complete with clean general checklist is publish_ready", () => {
    const task = makeTask({ status: "complete" });
    const { stage } = deriveStoryStage({
      task,
      checklist: checklist([{ key: "g_x", group: "general", checked: true }]),
    });
    expect(stage).toBe("publish_ready");
  });

  it("complete with incomplete general checklist stays at final_approval", () => {
    const task = makeTask({ status: "complete" });
    const { stage, reasons } = deriveStoryStage({
      task,
      checklist: checklist([{ key: "g_x", group: "general", checked: false }]),
    });
    expect(stage).toBe("final_approval");
    expect(reasons[0].code).toBe("general_checklist_incomplete");
  });

  it("an open sensitive flag blocks publish_ready", () => {
    const sensitive: SensitiveFlag = {
      id: "f1",
      taskId: "task-1",
      reason: "politics",
      notes: "n",
      status: "open",
      raisedById: "u1",
      raisedAt: "2026-05-01T00:00:00.000Z",
    };
    const task = makeTask({ status: "complete", sensitive });
    const { stage, reasons } = deriveStoryStage({
      task,
      checklist: checklist([{ key: "g_x", group: "general", checked: true }]),
    });
    expect(stage).toBe("final_approval");
    expect(reasons[0].code).toBe("sensitive_open");
  });

  it("a holding sensitive flag locks the story at final_approval", () => {
    const sensitive: SensitiveFlag = {
      id: "f1",
      taskId: "task-1",
      reason: "allegations",
      notes: "n",
      status: "holding",
      raisedById: "u1",
      raisedAt: "2026-05-01T00:00:00.000Z",
    };
    const task = makeTask({ status: "complete", sensitive });
    const { stage, reasons } = deriveStoryStage({ task });
    expect(stage).toBe("final_approval");
    expect(reasons[0].code).toBe("sensitive_holding");
  });

  it("a published issue promotes the story to published", () => {
    const issue: Issue = {
      id: "i1",
      number: 1,
      name: "Issue 1",
      publishDate: "2026-06-01T00:00:00.000Z",
      status: "published",
    };
    const task = makeTask({ status: "in_progress" });
    expect(deriveStoryStage({ task, issue }).stage).toBe("published");
  });
});

describe("stage metadata helpers", () => {
  it("STAGE_ORDER lists nine stages in conveyor order", () => {
    expect(STAGE_ORDER[0]).toBe("pitch");
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe("archived");
  });

  it("nextActionForRole returns role-specific microcopy", () => {
    expect(nextActionForRole("drafting", "writer")).toMatch(/draft/i);
    expect(typeof nextActionForRole("publish_ready", "leader")).toBe("string");
  });
});
