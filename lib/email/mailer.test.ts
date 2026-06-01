import { describe, expect, it } from "vitest";
import { normalizeEmailAddress } from "./mailer";

describe("normalizeEmailAddress", () => {
  it("trims and lowercases valid email addresses", () => {
    expect(normalizeEmailAddress("  Riley@Advantage.CO ")).toBe(
      "riley@advantage.co"
    );
  });

  it("rejects missing or malformed email addresses", () => {
    expect(normalizeEmailAddress(undefined)).toBeNull();
    expect(normalizeEmailAddress("not-an-email")).toBeNull();
    expect(normalizeEmailAddress("person@example")).toBeNull();
    expect(normalizeEmailAddress("person example.com")).toBeNull();
  });
});
