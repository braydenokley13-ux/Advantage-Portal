import { describe, expect, it } from "vitest";
import { assignEditorByRotation } from "./assign";
import type { BoardMember } from "./config";

const BOARD: BoardMember[] = [
  { name: "A", email: "a@example.com" },
  { name: "B", email: "b@example.com" },
  { name: "C", email: "c@example.com" },
];

describe("assignEditorByRotation", () => {
  it("rotates round-robin through the board by submission count", () => {
    expect(assignEditorByRotation(0, BOARD).name).toBe("A");
    expect(assignEditorByRotation(1, BOARD).name).toBe("B");
    expect(assignEditorByRotation(2, BOARD).name).toBe("C");
    // Wraps back to the start.
    expect(assignEditorByRotation(3, BOARD).name).toBe("A");
    expect(assignEditorByRotation(7, BOARD).name).toBe("B");
  });

  it("treats negative, NaN, and fractional counts as the first slot/floor", () => {
    expect(assignEditorByRotation(-5, BOARD).name).toBe("A");
    expect(assignEditorByRotation(Number.NaN, BOARD).name).toBe("A");
    expect(assignEditorByRotation(4.9, BOARD).name).toBe("B"); // floor(4.9)=4 → 4%3=1
  });

  it("throws when the board is empty", () => {
    expect(() => assignEditorByRotation(0, [])).toThrow(/empty/i);
  });
});
