import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PitchesPage, { PitchForm } from "./page";

const mocks = vi.hoisted(() => ({
  createPitch: vi.fn(),
  sections: [] as { id: string; name: string }[],
  pitches: [] as {
    id: string;
    proposedHeadline: string;
    sectionId: string;
    angle: string;
    whyNow: string;
    proposedSources: string[];
    writerId: string;
    status: "submitted" | "accepted" | "declined" | "converted";
    taskId?: string;
    createdAt: string;
  }[],
  issues: [] as { id: string; name: string }[],
  store: {
    tasks: [] as { id: string; issueId?: string }[],
    users: [] as { id: string; name: string; role: string }[],
  },
}));

vi.mock("@/lib/api/provider", () => ({
  useApiClient: () => ({
    createPitch: mocks.createPitch,
  }),
}));

vi.mock("@/lib/role-context", () => ({
  useRole: () => ({
    user: {
      id: "u-writer",
      name: "Test Writer",
      email: "writer@example.com",
      role: "writer",
    },
    role: "writer",
  }),
}));

vi.mock("@/lib/hooks", () => ({
  useSections: () => ({ data: mocks.sections, refetch: vi.fn() }),
  usePitches: () => ({ data: mocks.pitches, refetch: vi.fn() }),
  useIssues: () => ({ data: mocks.issues, refetch: vi.fn() }),
}));

vi.mock("@/lib/store", () => ({
  useStore: () => mocks.store,
}));

const sections = [
  { id: "sec-news", name: "News" },
  { id: "sec-business", name: "Business" },
];

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Proposed headline"), {
    target: { value: "A useful student newsroom pitch" },
  });
  fireEvent.change(screen.getByLabelText("Angle / thesis"), {
    target: { value: "This pitch explains the core reporting angle." },
  });
  fireEvent.change(screen.getByLabelText("Why now?"), {
    target: { value: "The timing matters this week." },
  });
}

describe("PitchForm", () => {
  beforeEach(() => {
    mocks.createPitch.mockReset();
    mocks.sections = [];
    mocks.pitches = [];
    mocks.issues = [];
    mocks.store = { tasks: [], users: [] };
    mocks.createPitch.mockResolvedValue({
      id: "pitch-new",
      proposedHeadline: "A useful student newsroom pitch",
      sectionId: "sec-news",
      angle: "This pitch explains the core reporting angle.",
      whyNow: "The timing matters this week.",
      proposedSources: [],
      writerId: "u-writer",
      status: "submitted",
      createdAt: "2026-05-31T12:00:00.000Z",
    });
  });

  it("enables submit once the required fields are filled", async () => {
    const onSubmitted = vi.fn();
    render(<PitchForm onSubmitted={onSubmitted} />);

    expect(
      screen.getByRole("button", { name: /submit pitch/i })
    ).toBeDisabled();

    fillRequiredFields();
    expect(screen.getByRole("button", { name: /submit pitch/i })).toBeEnabled();
  });

  it("submits the pitch the writer composes", async () => {
    const onSubmitted = vi.fn();
    render(<PitchForm onSubmitted={onSubmitted} />);

    fireEvent.change(screen.getByLabelText(/Expected word count/i), {
      target: { value: "900" },
    });
    fireEvent.change(screen.getByLabelText(/Proposed sources/i), {
      target: { value: "Teacher interview\nBudget spreadsheet\n" },
    });
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: /submit pitch/i }));

    await waitFor(() => expect(mocks.createPitch).toHaveBeenCalledTimes(1));
    expect(mocks.createPitch).toHaveBeenCalledWith({
      proposedHeadline: "A useful student newsroom pitch",
      angle: "This pitch explains the core reporting angle.",
      whyNow: "The timing matters this week.",
      proposedSources: ["Teacher interview", "Budget spreadsheet"],
      expectedWordCount: 900,
      deadlinePref: undefined,
      writerNote: undefined,
      writerId: "u-writer",
    });
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/Pitch sent to the editor queue/i)
    ).toBeInTheDocument();
  });

  it("shows a converted pitch's issue through its linked task", async () => {
    mocks.sections = sections;
    mocks.issues = [{ id: "issue-43", name: "Issue #43" }];
    mocks.store = {
      tasks: [{ id: "task-from-pitch", issueId: "issue-43" }],
      users: [],
    };
    mocks.pitches = [
      {
        id: "pitch-converted",
        proposedHeadline: "Converted pitch with issue",
        sectionId: "sec-news",
        angle: "The angle is already accepted.",
        whyNow: "The assignment exists now.",
        proposedSources: [],
        writerId: "u-writer",
        status: "converted",
        taskId: "task-from-pitch",
        createdAt: "2026-05-31T12:00:00.000Z",
      },
    ];

    render(<PitchesPage />);
    const myPitchesTab = screen.getByRole("tab", { name: /My pitches/i });
    fireEvent.pointerDown(myPitchesTab);
    fireEvent.mouseDown(myPitchesTab);
    fireEvent.click(myPitchesTab);

    expect(screen.getByText("Converted pitch with issue")).toBeInTheDocument();
    expect(screen.getByText(/Issue #43/)).toBeInTheDocument();
  });
});
