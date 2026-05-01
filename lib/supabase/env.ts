/**
 * Centralised env access for Supabase. Importing from here ensures the
 * data-mode switch and credential checks happen in exactly one place.
 *
 * The portal can run in two data modes:
 *   - "mock"     → in-memory store (offline, default)
 *   - "supabase" → SupabaseAdapter against the configured project
 *
 * If `NEXT_PUBLIC_DATA_MODE=supabase` is set but URL/anon key are missing
 * or blank, `resolveDataMode()` downgrades to "mock" and explains why on
 * the console so the dev server stays usable.
 */

export type DataMode = "mock" | "supabase";

type ResolvedDataMode = {
  mode: DataMode;
  /** When mode === "mock", reason explains any forced downgrade. */
  reason?: string;
  config?: {
    url: string;
    anonKey: string;
  };
};

function pickEnv(name: string): string | undefined {
  // process.env is statically inlined by Next.js for NEXT_PUBLIC_* names.
  // Any non-public env requested from a browser bundle returns undefined,
  // which is the correct behaviour for service-only keys.
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function resolveDataMode(): ResolvedDataMode {
  const requested = (pickEnv("NEXT_PUBLIC_DATA_MODE") ?? "mock").toLowerCase();
  if (requested !== "supabase") return { mode: "mock" };

  const url = pickEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = pickEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    return {
      mode: "mock",
      reason:
        "NEXT_PUBLIC_DATA_MODE=supabase but URL or anon key is missing — falling back to mock.",
    };
  }

  // Cheap sanity check on the URL shape; avoids surfacing crypted errors
  // deep inside @supabase/supabase-js when the project URL is mistyped.
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("supabase.")) {
      return {
        mode: "mock",
        reason: `NEXT_PUBLIC_SUPABASE_URL doesn't look like a Supabase URL (${parsed.hostname}) — falling back to mock.`,
      };
    }
  } catch {
    return {
      mode: "mock",
      reason:
        "NEXT_PUBLIC_SUPABASE_URL is not a valid URL — falling back to mock.",
    };
  }

  return { mode: "supabase", config: { url, anonKey } };
}

/**
 * Service-role key for server-side flows (invites, server actions). Must
 * never reach the browser; calling this from a client component returns
 * undefined. The accessor is server-only by virtue of the missing
 * NEXT_PUBLIC_ prefix on the underlying env var.
 */
export function getServiceRoleKey(): string | undefined {
  return pickEnv("SUPABASE_SERVICE_ROLE_KEY");
}
