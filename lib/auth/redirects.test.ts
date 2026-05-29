import { describe, expect, it } from "vitest";
import {
  authTokenCallbackUrlFromRedirect,
  normalizeEmailOtpType,
  safeNextPath,
} from "./redirects";

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

describe("normalizeEmailOtpType", () => {
  it("keeps Supabase email OTP types that verifyOtp accepts", () => {
    expect(normalizeEmailOtpType("signup")).toBe("signup");
    expect(normalizeEmailOtpType("magiclink")).toBe("magiclink");
    expect(normalizeEmailOtpType("recovery")).toBe("recovery");
  });

  it("normalizes hook and generated-link aliases", () => {
    expect(normalizeEmailOtpType("magic_link")).toBe("magiclink");
    expect(normalizeEmailOtpType("email_change_current")).toBe(
      "email_change"
    );
    expect(normalizeEmailOtpType("email_change_new")).toBe("email_change");
  });

  it("rejects unknown verification types", () => {
    expect(normalizeEmailOtpType("external")).toBeNull();
    expect(normalizeEmailOtpType(null)).toBeNull();
  });
});

describe("authTokenCallbackUrlFromRedirect", () => {
  it("adds token_hash and type while preserving the requested next path", () => {
    expect(
      authTokenCallbackUrlFromRedirect(
        "https://portal.example/auth/callback?next=%2Ftasks%3Fid%3D123",
        "hashed-token",
        "magiclink"
      )
    ).toBe(
      "https://portal.example/auth/callback?next=%2Ftasks%3Fid%3D123&token_hash=hashed-token&type=magiclink"
    );
  });

  it("routes final destinations through the auth callback first", () => {
    expect(
      authTokenCallbackUrlFromRedirect(
        "https://portal.example/auth/update-password",
        "reset-token",
        "recovery"
      )
    ).toBe(
      "https://portal.example/auth/callback?next=%2Fauth%2Fupdate-password&token_hash=reset-token&type=recovery"
    );
  });

  it("returns null for incomplete values", () => {
    expect(
      authTokenCallbackUrlFromRedirect(
        "https://portal.example/auth/callback",
        "",
        "magiclink"
      )
    ).toBeNull();
    expect(
      authTokenCallbackUrlFromRedirect(
        "https://portal.example/auth/callback",
        "hashed-token",
        "unknown"
      )
    ).toBeNull();
  });
});
