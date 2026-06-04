import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfigStatus, resolveDataMode } from "./env";

// An empty string reads as "unset" through clean(), so stubbing every key
// to "" before each test gives a deterministic baseline regardless of the
// ambient environment.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveDataMode", () => {
  it("is always supabase mode but carries no config when nothing is set", () => {
    const resolved = resolveDataMode();
    expect(resolved.mode).toBe("supabase");
    expect(resolved.config).toBeUndefined();
    expect(resolved.reason).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(resolved.reason).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("resolves config with valid credentials", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(resolveDataMode()).toEqual({
      mode: "supabase",
      config: { url: "https://abc.supabase.co", anonKey: "anon-key" },
    });
  });

  it("reports no config with a reason when the anon key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    const resolved = resolveDataMode();
    expect(resolved.config).toBeUndefined();
    expect(resolved.reason).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("reports no config when the URL is not a Supabase project URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const resolved = resolveDataMode();
    expect(resolved.config).toBeUndefined();
    expect(resolved.reason).toContain("does not look like a Supabase");
  });

  it("strips wrapping quotes and whitespace from values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", '"https://abc.supabase.co"');
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", " anon-key ");
    expect(resolveDataMode()).toEqual({
      mode: "supabase",
      config: { url: "https://abc.supabase.co", anonKey: "anon-key" },
    });
  });
});

describe("getSupabaseConfigStatus", () => {
  it("reports not configured when nothing is set", () => {
    const status = getSupabaseConfigStatus();
    expect(status).toMatchObject({
      configured: false,
      hasUrl: false,
      hasAnonKey: false,
      urlLooksValid: false,
    });
    expect(status.reason).toBeTruthy();
  });

  it("reports which vars are present when partially configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    const status = getSupabaseConfigStatus();
    expect(status.configured).toBe(false);
    expect(status.hasUrl).toBe(true);
    expect(status.hasAnonKey).toBe(false);
    expect(status.urlLooksValid).toBe(true);
  });

  it("exposes the public host when valid and carries no secret values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "secret-anon-key");
    const status = getSupabaseConfigStatus();
    expect(status.configured).toBe(true);
    expect(status.urlHost).toBe("abc.supabase.co");
    expect(JSON.stringify(status)).not.toContain("secret-anon-key");
  });
});
