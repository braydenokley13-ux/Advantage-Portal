import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it("keeps normal app paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/tasks?id=123")).toBe("/tasks?id=123");
  });

  it("rejects external or malformed paths", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil")).toBe("/dashboard");
    expect(safeNextPath("/bad\u0000path")).toBe("/dashboard");
  });

  it("uses the requested fallback", () => {
    expect(safeNextPath(null, "/login")).toBe("/login");
    expect(safeNextPath("https://evil.example", "/login")).toBe("/login");
  });
});
