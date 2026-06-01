import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskFormDialog } from "./task-form-dialog";

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  users: [
    { id: "u-writer", name: "Wendy Writer", role: "writer", active: true },
    { id: "u-editor", name: "Eddie Editor", role: "editor", active: true },
  ],
}));

vi.mock("@/lib/store", () => ({
  useStore: () => ({
    users: mocks.users,
    createTask: mocks.createTask,
    updateTask: mocks.updateTask,
  }),
}));

vi.mock("@/lib/role-context", () => ({
  useRole: () => ({ role: "leader" }),
}));

describe("TaskFormDialog", () => {
  beforeEach(() => {
    mocks.createTask.mockReset();
    mocks.updateTask.mockReset();
  });

  function fillRequired() {
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: "Quarterly market outlook" },
    });
    fireEvent.change(screen.getByLabelText(/Instructions/i), {
      target: { value: "Cover the key beats and sources." },
    });
  }

  it("awaits createTask and keeps the dialog open, surfacing an error on failure", async () => {
    mocks.createTask.mockRejectedValue(new Error("Network is down"));
    const onOpenChange = vi.fn();
    render(
      <TaskFormDialog mode="create" open onOpenChange={onOpenChange} />
    );

    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() =>
      expect(mocks.createTask).toHaveBeenCalledTimes(1)
    );
    // On failure the dialog must NOT close (no silent "looks saved").
    await waitFor(() =>
      expect(screen.getByText(/Network is down/i)).toBeInTheDocument()
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes the dialog after a successful create", async () => {
    mocks.createTask.mockResolvedValue({ id: "task-new" });
    const onOpenChange = vi.fn();
    render(
      <TaskFormDialog mode="create" open onOpenChange={onOpenChange} />
    );

    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
