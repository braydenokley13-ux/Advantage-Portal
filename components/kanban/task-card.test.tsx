import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TaskCard } from "./task-card";
import type { Task } from "@/lib/types";

vi.mock("@/lib/store", () => ({
  useStore: () => ({
    users: [{ id: "u-1", name: "Wendy Writer", role: "writer" }],
    submissions: [],
  }),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Quarterly market outlook",
    instructions: "Cover the key beats.",
    writerId: "u-1",
    status: "in_progress",
    color: "green",
    deadline: "2026-07-01T17:00:00.000Z",
    createdAt: "2026-06-01T12:00:00.000Z",
    ...overrides,
  } as Task;
}

describe("TaskCard submit affordance", () => {
  it("shows a 'Submit work' button and fires onClick when showSubmit is set", () => {
    const onClick = vi.fn();
    render(<TaskCard task={makeTask()} draggable onClick={onClick} showSubmit />);

    const btn = screen.getByRole("button", { name: /submit work/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("labels the button 'Revise & resubmit' for changes-requested tasks", () => {
    render(
      <TaskCard task={makeTask()} draggable showSubmit changesRequested />
    );
    expect(
      screen.getByRole("button", { name: /revise & resubmit/i })
    ).toBeInTheDocument();
  });

  it("renders no submit button when showSubmit is false", () => {
    render(<TaskCard task={makeTask()} draggable />);
    expect(
      screen.queryByRole("button", { name: /submit work/i })
    ).not.toBeInTheDocument();
  });
});
