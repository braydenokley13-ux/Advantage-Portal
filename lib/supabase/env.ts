/**
 * Centralised env access for Supabase. Importing from here ensures the
 * data-mode switch and credential checks happen in exactly one place.
 *
 * The portal can run in two data modes:
 *   - "mock"     → in-memory store (offline, default)
 *   - "supabase" → SupabaseAdapter against the configured project
 *
 * If `NEXT_PUBLIC_DATA_MODE=supabase` is set but URL/anon key are missing
 * or malformed, the resolver downgrades to "mock" and explains why so the
 * dev server stays usable. `getDataModeDiagnostics()` exposes the full
 * picture for UI surfaces (the mock-mode banner on /login, the admin
 * data-mode card).
 *
 * Reminder: every NEXT_PUBLIC_* value is inlined into the browser bundle
 * at BUILD time. Changing one on a host like Vercel has no effect until a
 * fresh, cache-free build runs — see docs/supabase-setup-guide.md.
 */

export type DataMode = "mock" | "supabase";

export type ResolvedDataMode = {
  mode: DataMode;
  /** When mode === "mock", reason explains any forced downgrade. */
  reason?: string;
  config?: {
    url: string;
    anonKey: string;
  };
};

/**
 * Full env/data-mode picture for diagnostics UI. Contains no secrets:
 * only booleans and the public Supabase host (NEXT_PUBLIC_SUPABASE_URL is
 * shipped to the browser by design). The service-role key is never read.
 */
export type DataModeDiagnostics = {
  /** Normalised value of NEXT_PUBLIC_DATA_MODE ("mock" when unset). */
  requestedMode: string;
  /** Mode actually in effect after credential validation. */
  resolvedMode: DataMode;
  /** True when "supabase" was requested but the app fell back to mock. */
  downgraded: boolean;
  /** Human-readable explanation when downgraded or misconfigured. */
  reason?: string;
  /** NEXT_PUBLIC_SUPABASE_URL is set and non-empty. */
  hasUrl: boolean;
  /** NEXT_PUBLIC_SUPABASE_ANON_KEY is set and non-empty. */
  hasAnonKey: boolean;
  /** The URL parses and looks like a Supabase project URL. */
  urlLooksValid: boolean;
  /** Public Supabase host — present only when the URL is valid. */
  urlHost?: string;
};

/**
 * Normalise a raw env value, tolerating the two most common dashboard
 * mistakes: surrounding whitespace and a wrapping pair of quotes (e.g.
 * pasting `"supabase"` instead of `supabase` into a host's env UI).
 */
function clean(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

type EnvSnapshot = {
  requestedMode: string;
  url?: string;
  anonKey?: string;
  urlLooksValid: boolean;
  urlHost?: string;
};

function readEnv(): EnvSnapshot {
  // These MUST stay as static `process.env.NEXT_PUBLIC_*` member accesses.
  // Next.js / Turbopack only inline NEXT_PUBLIC_* values into the browser
  // bundle when the property is referenced literally. A dynamic
  // `process.env[name]` lookup is NOT inlined — on the client it reads an
  // empty polyfill object and resolves to undefined, which would silently
  // pin the whole app to mock mode no matter how the host is configured.
  const requestedMode = (
    clean(process.env.NEXT_PUBLIC_DATA_MODE) ?? "mock"
  ).toLowerCase();
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let urlLooksValid = false;
  let urlHost: string | undefined;
  if (url) {
    try {
      // Cheap sanity check on the URL shape; avoids surfacing cryptic
      // errors deep inside @supabase/supabase-js when the URL is mistyped.
      const host = new URL(url).hostname;
      if (host.includes("supabase.")) {
        urlLooksValid = true;
        urlHost = host;
      }
    } catch {
      // urlLooksValid stays false for an unparseable URL.
    }
  }

  return { requestedMode, url, anonKey, urlLooksValid, urlHost };
}

/**
 * Derive the full diagnostics object from an env snapshot. Pure — safe to
 * call during render on both the server and the client.
 */
function diagnose(env: EnvSnapshot): DataModeDiagnostics {
  const base = {
    requestedMode: env.requestedMode,
    hasUrl: !!env.url,
    hasAnonKey: !!env.anonKey,
    urlLooksValid: env.urlLooksValid,
    urlHost: env.urlHost,
  };

  // Not asking for supabase → plain mock.
  if (env.requestedMode !== "supabase") {
    // A value that is neither "mock" nor "supabase" is almost certainly a
    // typo; surface it rather than silently running mock.
    if (env.requestedMode !== "mock") {
      return {
        ...base,
        resolvedMode: "mock",
        downgraded: false,
        reason: `NEXT_PUBLIC_DATA_MODE is "${env.requestedMode}", which is not a recognised value. Expected "mock" or "supabase" — running in mock mode.`,
      };
    }
    return { ...base, resolvedMode: "mock", downgraded: false };
  }

  // supabase requested — credentials must be present and well-formed.
  if (!env.url || !env.anonKey) {
    const missing = [
      !env.url && "NEXT_PUBLIC_SUPABASE_URL",
      !env.anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ].filter(Boolean) as string[];
    return {
      ...base,
      resolvedMode: "mock",
      downgraded: true,
      reason: `NEXT_PUBLIC_DATA_MODE=supabase, but ${missing.join(" and ")} ${
        missing.length > 1 ? "are" : "is"
      } not set — falling back to mock.`,
    };
  }

  if (!env.urlLooksValid) {
    return {
      ...base,
      resolvedMode: "mock",
      downgraded: true,
      reason:
        "NEXT_PUBLIC_DATA_MODE=supabase, but NEXT_PUBLIC_SUPABASE_URL does not look like a Supabase project URL (expected https://<project-ref>.supabase.co) — falling back to mock.",
    };
  }

  return { ...base, resolvedMode: "supabase", downgraded: false };
}

/**
 * Full env/data-mode diagnostics. Used by UI surfaces (the /login
 * mock-mode banner, the admin data-mode card) to explain exactly what is
 * configured and why. Pure, client-safe, and contains no secrets.
 */
export function getDataModeDiagnostics(): DataModeDiagnostics {
  return diagnose(readEnv());
}

/**
 * Resolve the active data mode and, when running against Supabase, the
 * validated credentials. Every adapter, the session provider, and the
 * edge middleware funnel through this one function.
 */
export function resolveDataMode(): ResolvedDataMode {
  const env = readEnv();
  const diag = diagnose(env);
  if (diag.resolvedMode === "supabase") {
    // diagnose() only resolves to "supabase" once url + anonKey are both
    // present, so these assertions hold.
    return {
      mode: "supabase",
      config: { url: env.url!, anonKey: env.anonKey! },
    };
  }
  return diag.reason ? { mode: "mock", reason: diag.reason } : { mode: "mock" };
}

/**
 * Service-role key for server-side flows (invites, server actions). Must
 * never reach the browser; calling this from a client component returns
 * undefined. The accessor is server-only by virtue of the missing
 * NEXT_PUBLIC_ prefix on the underlying env var.
 */
export function getServiceRoleKey(): string | undefined {
  // Static, non-public access: the client bundle inlines this as
  // undefined, so the service-role key never ships to the browser.
  return clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
