import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDataModeDiagnostics, resolveDataMode } from "./env";

// An empty string reads as "unset" through clean(), so stubbing every key
// to "" before each test gives a deterministic baseline regardless of the
// ambient environment.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveDataMode", () => {
  it("defaults to mock when nothing is configured", () => {
    expect(resolveDataMode()).toEqual({ mode: "mock" });
  });

  it("resolves to supabase with valid credentials", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(resolveDataMode()).toEqual({
      mode: "supabase",
      config: { url: "https://abc.supabase.co", anonKey: "anon-key" },
    });
  });

  it("downgrades to mock with a reason when both credentials are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "supabase");
    const resolved = resolveDataMode();
    expect(resolved.mode).toBe("mock");
    expect(resolved.reason).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(resolved.reason).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("downgrades when the URL is not a Supabase project URL", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const resolved = resolveDataMode();
    expect(resolved.mode).toBe("mock");
    expect(resolved.reason).toContain("does not look like a Supabase");
  });

  it("strips wrapping quotes and whitespace from values", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", '  "supabase" ');
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", '"https://abc.supabase.co"');
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", " anon-key ");
    expect(resolveDataMode()).toEqual({
      mode: "supabase",
      config: { url: "https://abc.supabase.co", anonKey: "anon-key" },
    });
  });

  it("treats the mode value case-insensitively", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "SUPABASE");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(resolveDataMode().mode).toBe("supabase");
  });
});

describe("getDataModeDiagnostics", () => {
  it("reports plain mock without flagging a downgrade", () => {
    const diag = getDataModeDiagnostics();
    expect(diag).toMatchObject({
      requestedMode: "mock",
      resolvedMode: "mock",
      downgraded: false,
      hasUrl: false,
      hasAnonKey: false,
      urlLooksValid: false,
    });
    expect(diag.reason).toBeUndefined();
  });

  it("flags an unrecognised mode value as a likely typo", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "supabse");
    const diag = getDataModeDiagnostics();
    expect(diag.resolvedMode).toBe("mock");
    expect(diag.downgraded).toBe(false);
    expect(diag.reason).toContain("not a recognised value");
  });

  it("marks a credential downgrade and reports which vars are present", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    const diag = getDataModeDiagnostics();
    expect(diag.downgraded).toBe(true);
    expect(diag.hasUrl).toBe(true);
    expect(diag.hasAnonKey).toBe(false);
    expect(diag.urlLooksValid).toBe(true);
  });

  it("exposes the public host when valid and carries no secret values", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "secret-anon-key");
    const diag = getDataModeDiagnostics();
    expect(diag.resolvedMode).toBe("supabase");
    expect(diag.urlHost).toBe("abc.supabase.co");
    expect(JSON.stringify(diag)).not.toContain("secret-anon-key");
  });
});
