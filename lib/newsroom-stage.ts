/**
 * Newsroom publication stages.
 *
 * The portal's canonical TaskStatus (`not_started | in_progress | submitted |
 * complete`) drives the kanban and permission system. The *stage* is a
 * derived, reader-facing layer: where this story is on the publication
 * conveyor belt — pitch, drafting, section edit, copy edit, fact-check,
 * final approval, publish-ready, published.
 *
 * Stage is computed from TaskStatus + the editorial checklist + any
 * sensitive flag. Issue status promotes everything to `published` when an
 * edition ships. Stage is presentation-only — never persisted, never used
 * for permission decisions.
 */
import type {
  EditorialChecklist,
  Issue,
  Role,
  StoryStage,
  Task,
} from "./types";

export const STAGE_ORDER: StoryStage[] = [
  "pitch",
  "drafting",
  "section_edit",
  "copy_edit",
  "fact_check",
  "final_approval",
  "publish_ready",
  "published",
  "archived",
];

export const STAGE_DEFINITIONS: Record<
  StoryStage,
  {
    label: string;
    description: string;
    /** What each role should do when a story is at this stage. */
    nextAction: Record<Role, string>;
    /** Tone hint for badges. */
    tone: "default" | "secondary" | "warning" | "success" | "danger";
  }
> = {
  pitch: {
    label: "Pitch",
    description: "An idea is on the table — no draft yet.",
    nextAction: {
      writer: "Wait for an editor's decision on your pitch.",
      editor: "Review the pitch and accept, decline, or ask for more.",
      leader: "Convert accepted pitches into assignments.",
      admin: "Monitor pitch volume and section coverage.",
    },
    tone: "secondary",
  },
  drafting: {
    label: "Drafting",
    description: "The writer is on it. No submission yet.",
    nextAction: {
      writer: "Keep drafting — submit when the piece holds together.",
      editor: "Stay close in case the writer needs guidance.",
      leader: "Track progress; nudge if a deadline is at risk.",
      admin: "No action needed.",
    },
    tone: "default",
  },
  section_edit: {
    label: "Section edit",
    description:
      "Draft is in for the section editor's first read.",
    nextAction: {
      writer: "Sit tight — your section editor has the draft.",
      editor:
        "Run the section edit. Tighten lede, structure, and voice.",
      leader: "Watch for stories stuck here too long.",
      admin: "No action needed.",
    },
    tone: "warning",
  },
  copy_edit: {
    label: "Copy edit",
    description: "Section edit is clean. Copy desk to do its pass.",
    nextAction: {
      writer: "Stay close in case copy has questions.",
      editor: "Copy edit pass — grammar, house style, attributions.",
      leader: "Check copy desk backlog if it stalls.",
      admin: "No action needed.",
    },
    tone: "warning",
  },
  fact_check: {
    label: "Fact check",
    description: "Copy is clean. Fact desk is verifying claims.",
    nextAction: {
      writer: "Be reachable for source confirmation pings.",
      editor: "Verify every named source and numerical claim.",
      leader: "Step in only if something can't be verified.",
      admin: "No action needed.",
    },
    tone: "warning",
  },
  final_approval: {
    label: "Final approval",
    description:
      "Edits are done — leader/managing editor needs to sign off.",
    nextAction: {
      writer: "Almost there. Last call for fixes if asked.",
      editor: "Hand off to leader; flag any open concerns.",
      leader: "Read the piece and sign off, or send back.",
      admin: "Resolve any sensitive escalation before approval.",
    },
    tone: "warning",
  },
  publish_ready: {
    label: "Publish-ready",
    description:
      "All checks complete. Ready to slot into the next issue.",
    nextAction: {
      writer: "Done — nice work. Watch for the publish ping.",
      editor: "Confirm the slot in the issue plan.",
      leader: "Schedule into an issue and ship.",
      admin: "Ready to publish — no blockers.",
    },
    tone: "success",
  },
  published: {
    label: "Published",
    description: "Story is live on theadvantagejournal.org.",
    nextAction: {
      writer: "Share it. Track reader feedback.",
      editor: "Move on to the next story.",
      leader: "Note metrics; archive when the issue closes.",
      admin: "Archive after the issue cycle.",
    },
    tone: "success",
  },
  archived: {
    label: "Archived",
    description: "Story is closed. Kept for the record.",
    nextAction: {
      writer: "—",
      editor: "—",
      leader: "—",
      admin: "—",
    },
    tone: "secondary",
  },
};

/** Reasons the stage helper might block publish-ready. */
export interface StageReason {
  code:
    | "draft_not_submitted"
    | "section_edit_pending"
    | "copy_edit_pending"
    | "fact_check_pending"
    | "general_checklist_incomplete"
    | "sensitive_open"
    | "sensitive_holding";
  message: string;
}

/**
 * Compute the publication stage for a story.
 *
 * Order of precedence (top wins):
 *   1. Issue published        → `published`
 *   2. Sensitive flag holding → `final_approval` (locked)
 *   3. Status complete + checklist clean + (no flag or cleared) → `publish_ready`
 *   4. Status complete                                          → `final_approval`
 *   5. Status submitted, branch by checklist completion         → section/copy/fact_check
 *   6. Status in_progress / not_started                         → drafting / pitch
 */
export function deriveStoryStage(args: {
  task: Task;
  checklist?: EditorialChecklist;
  issue?: Issue;
}): { stage: StoryStage; reasons: StageReason[] } {
  const { task, checklist, issue } = args;
  const reasons: StageReason[] = [];

  if (issue?.status === "published") {
    return { stage: "published", reasons };
  }
  if (issue?.status === "archived") {
    return { stage: "archived", reasons };
  }

  // No draft yet. If the story originated from a pitch and is unstarted,
  // call it "pitch"; otherwise, call it "drafting" once any work begins.
  if (task.status === "not_started") {
    return { stage: task.pitchId ? "pitch" : "drafting", reasons };
  }

  const generalDone = checklistGroupComplete(checklist, "general");
  const businessDone = checklistGroupComplete(checklist, "business");
  const sensitiveDone = checklistGroupComplete(checklist, "sensitive");

  // Sensitive is the strongest gate: holding blocks even after sign-off.
  if (task.sensitive?.status === "holding") {
    reasons.push({
      code: "sensitive_holding",
      message: "Sensitive review on hold — leader/admin must release.",
    });
    return { stage: "final_approval", reasons };
  }

  if (task.status === "complete") {
    const hasOpenSensitive = task.sensitive?.status === "open";
    if (hasOpenSensitive) {
      reasons.push({
        code: "sensitive_open",
        message: "Sensitive flag is still open.",
      });
      return { stage: "final_approval", reasons };
    }
    if (!generalDone) {
      reasons.push({
        code: "general_checklist_incomplete",
        message: "General editorial checklist is not yet fully checked.",
      });
      return { stage: "final_approval", reasons };
    }
    if (
      hasGroup(checklist, "business") && !businessDone
    ) {
      reasons.push({
        code: "general_checklist_incomplete",
        message: "Business / Markets checklist is not complete.",
      });
      return { stage: "final_approval", reasons };
    }
    if (hasGroup(checklist, "sensitive") && !sensitiveDone) {
      reasons.push({
        code: "general_checklist_incomplete",
        message: "Sensitive-story checklist is not complete.",
      });
      return { stage: "final_approval", reasons };
    }
    return { stage: "publish_ready", reasons };
  }

  if (task.status === "submitted") {
    // Walk through the editorial passes — section → copy → fact-check.
    // We cluster the checks: section edit done means general "headline,
    // lede, claims, sources, quotes, opinion" all true; copy edit means
    // grammar; fact-check means business + sensitive verifications.
    const section = checklistKeysComplete(checklist, [
      "g_headline",
      "g_lede",
      "g_claims",
      "g_sources",
      "g_quotes",
    ]);
    const copy = checklistKeysComplete(checklist, ["g_grammar"]);
    const fact =
      (!hasGroup(checklist, "business") || businessDone) &&
      (!hasGroup(checklist, "sensitive") || sensitiveDone);

    if (!section) {
      reasons.push({
        code: "section_edit_pending",
        message: "Section editor still working through structure & sources.",
      });
      return { stage: "section_edit", reasons };
    }
    if (!copy) {
      reasons.push({
        code: "copy_edit_pending",
        message: "Copy desk hasn't signed off on grammar / house style.",
      });
      return { stage: "copy_edit", reasons };
    }
    if (!fact) {
      reasons.push({
        code: "fact_check_pending",
        message: "Fact desk hasn't verified all claims.",
      });
      return { stage: "fact_check", reasons };
    }
    return { stage: "final_approval", reasons };
  }

  // status === "in_progress"
  return { stage: "drafting", reasons };
}

/** Per-role next-action microcopy for the current derived stage. */
export function nextActionForRole(
  stage: StoryStage,
  role: Role
): string {
  return STAGE_DEFINITIONS[stage].nextAction[role];
}

// ── helpers ────────────────────────────────────────────────────────────────

function checklistGroupComplete(
  checklist: EditorialChecklist | undefined,
  group: "general" | "business" | "sensitive"
): boolean {
  if (!checklist) return false;
  const items = checklist.items.filter(
    (i) => i.group === group && i.required
  );
  if (items.length === 0) return true;
  return items.every((i) => i.checked);
}

function hasGroup(
  checklist: EditorialChecklist | undefined,
  group: "general" | "business" | "sensitive"
): boolean {
  if (!checklist) return false;
  return checklist.items.some((i) => i.group === group);
}

function checklistKeysComplete(
  checklist: EditorialChecklist | undefined,
  keys: string[]
): boolean {
  if (!checklist) return false;
  return keys.every(
    (k) => checklist.items.find((i) => i.key === k)?.checked === true
  );
}
