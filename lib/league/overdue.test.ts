import { describe, expect, it } from "vitest";
import {
  scanOverdueSubmissions,
  type OverdueSubmissionInput,
} from "./overdue";

const NOW = new Date("2026-06-29T08:00:00.000Z");
const DAY_MS = 86_400_000;

/** ISO timestamp `n` days before NOW. */
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY_MS).toISOString();
}

function sub(
  overrides: Partial<OverdueSubmissionInput> & { submission_date: string }
): OverdueSubmissionInput {
  return {
    id: "sub-1",
    article_title: "A Title",
    assigned_editor: "Editor A",
    writer_name: "Writer One",
    reminder_sent_at: null,
    escalation_sent_at: null,
    urgent_escalation_sent_at: null,
    ...overrides,
  };
}

describe("scanOverdueSubmissions", () => {
  it("emits nothing for a piece under 5 days old", () => {
    expect(scanOverdueSubmissions([sub({ submission_date: daysAgo(4) })], NOW)).toEqual(
      []
    );
  });

  it("emits an editor reminder once past 5 days", () => {
    const out = scanOverdueSubmissions([sub({ submission_date: daysAgo(6) })], NOW);
    expect(out.map((a) => a.tier)).toEqual(["reminder"]);
    expect(out[0].sentColumn).toBe("reminder_sent_at");
    expect(out[0].daysOverdue).toBe(6);
  });

  it("emits reminder + journal escalation between 7 and 10 days", () => {
    const out = scanOverdueSubmissions([sub({ submission_date: daysAgo(8) })], NOW);
    expect(out.map((a) => a.tier).sort()).toEqual(["escalation", "reminder"]);
  });

  it("emits reminder + urgent (not escalation) at 10+ days", () => {
    const out = scanOverdueSubmissions([sub({ submission_date: daysAgo(11) })], NOW);
    const tiers = out.map((a) => a.tier).sort();
    expect(tiers).toEqual(["reminder", "urgent"]);
    expect(tiers).not.toContain("escalation");
  });

  it("does not repeat a tier already sent today", () => {
    const out = scanOverdueSubmissions(
      [
        sub({
          submission_date: daysAgo(8),
          reminder_sent_at: daysAgo(0), // already nudged the editor today
        }),
      ],
      NOW
    );
    // Reminder suppressed; the journal escalation still fires.
    expect(out.map((a) => a.tier)).toEqual(["escalation"]);
  });

  it("re-fires a tier whose last send was a previous day", () => {
    const out = scanOverdueSubmissions(
      [
        sub({
          submission_date: daysAgo(6),
          reminder_sent_at: daysAgo(1), // sent yesterday → eligible again
        }),
      ],
      NOW
    );
    expect(out.map((a) => a.tier)).toEqual(["reminder"]);
  });

  it("suppresses the urgent escalation when already sent today but still nudges the editor", () => {
    const out = scanOverdueSubmissions(
      [
        sub({
          submission_date: daysAgo(12),
          urgent_escalation_sent_at: daysAgo(0),
        }),
      ],
      NOW
    );
    expect(out.map((a) => a.tier)).toEqual(["reminder"]);
  });
});
