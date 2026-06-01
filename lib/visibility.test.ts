import { describe, expect, it } from "vitest";
import { visibleTasks } from "./visibility";
import { makeTask } from "./test-fixtures";
import type { Role } from "./types";

const tasks = [
  makeTask({ id: "t-a", writerId: "writer-1", editorId: "editor-1" }),
  makeTask({ id: "t-b", writerId: "writer-2", editorId: "editor-1" }),
  makeTask({ id: "t-c", writerId: "writer-1", editorId: "editor-2" }),
];

describe("visibleTasks", () => {
  it("writer sees only tasks they author", () => {
    const seen = visibleTasks({ tasks, role: "writer", userId: "writer-1" });
    expect(seen.map((t) => t.id)).toEqual(["t-a", "t-c"]);
  });

  it("editor sees only tasks they are assigned to as editor", () => {
    const seen = visibleTasks({ tasks, role: "editor", userId: "editor-1" });
    expect(seen.map((t) => t.id)).toEqual(["t-a", "t-b"]);
  });

  it("leader sees every task", () => {
    expect(
      visibleTasks({ tasks, role: "leader", userId: "leader-1" })
    ).toHaveLength(3);
  });

  it("admin sees every task", () => {
    expect(
      visibleTasks({ tasks, role: "admin", userId: "admin-1" })
    ).toHaveLength(3);
  });

  it("writer with no authored tasks sees nothing", () => {
    expect(
      visibleTasks({ tasks, role: "writer", userId: "nobody" })
    ).toEqual([]);
  });

  it("never throws for any role", () => {
    const roles: Role[] = ["writer", "editor", "leader", "admin"];
    for (const role of roles) {
      expect(Array.isArray(visibleTasks({ tasks, role, userId: "x" }))).toBe(
        true
      );
    }
  });
});
