import { describe, expect, it } from "vitest";
import { extractBearer, isCronAuthorized } from "./cron-auth";

describe("extractBearer", () => {
  it("pulls the token from a Bearer header", () => {
    expect(extractBearer("Bearer abc123")).toBe("abc123");
    expect(extractBearer("bearer  spaced ")).toBe("spaced");
  });

  it("returns null for missing or malformed headers", () => {
    expect(extractBearer(null)).toBeNull();
    expect(extractBearer(undefined)).toBeNull();
    expect(extractBearer("Basic abc")).toBeNull();
    expect(extractBearer("")).toBeNull();
  });
});

describe("isCronAuthorized", () => {
  const expectedSecret = "s3cret-token";

  it("accepts a matching Bearer token", () => {
    expect(
      isCronAuthorized({
        authorization: `Bearer ${expectedSecret}`,
        expectedSecret,
      })
    ).toBe(true);
  });

  it("accepts a matching query secret (header-less schedulers)", () => {
    expect(
      isCronAuthorized({ querySecret: expectedSecret, expectedSecret })
    ).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(
      isCronAuthorized({ authorization: "Bearer nope", expectedSecret })
    ).toBe(false);
    expect(
      isCronAuthorized({ querySecret: "nope", expectedSecret })
    ).toBe(false);
  });

  it("refuses to authorize when no secret is configured", () => {
    expect(
      isCronAuthorized({
        authorization: "Bearer anything",
        expectedSecret: undefined,
      })
    ).toBe(false);
    expect(isCronAuthorized({ querySecret: "", expectedSecret: "" })).toBe(false);
  });
});
