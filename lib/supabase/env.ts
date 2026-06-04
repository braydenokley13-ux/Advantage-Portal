/**
 * Centralised env access for Supabase. Importing from here ensures the
 * credential checks happen in exactly one place.
 *
 * The portal runs against Supabase only. When `NEXT_PUBLIC_SUPABASE_URL` and
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present and well-formed the app talks to
 * the configured project; when they are missing or malformed the app fails
 * loud (the /login page and admin surface explain what is misconfigured)
 * rather than silently serving throwaway in-memory data.
 *
 * Reminder: every NEXT_PUBLIC_* value is inlined into the browser bundle at
 * BUILD time. Changing one on a host like Vercel has no effect until a fresh,
 * cache-free build runs — see docs/supabase-setup-guide.md.
 */

/**
 * Retained for the many call sites that read `resolved.mode`. The portal is
 * Supabase-only now, so this is a single-value alias.
 */
export type DataMode = "supabase";

export type ResolvedDataMode = {
  mode: DataMode;
  /** Explains why config is absent when `config` is undefined. */
  reason?: string;
  /** Present only when Supabase credentials are valid. */
  config?: {
    url: string;
    anonKey: string;
  };
};

/**
 * Public-safe Supabase configuration status for diagnostics UI (the /login
 * config notice, the admin data card). Contains no secrets — only booleans
 * and the public Supabase host.
 */
export type SupabaseConfigStatus = {
  /** True when both URL and anon key are present and the URL is valid. */
  configured: boolean;
  /** Human-readable explanation when not configured. */
  reason?: string;
  hasUrl: boolean;
  hasAnonKey: boolean;
  urlLooksValid: boolean;
  /** Public Supabase host — present only when the URL is valid. */
  urlHost?: string;
};

/**
 * Normalise a raw env value, tolerating the two most common dashboard
 * mistakes: surrounding whitespace and a wrapping pair of quotes (e.g.
 * pasting `"https://x.supabase.co"` instead of the bare value).
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
  // make the app think Supabase is unconfigured no matter how the host is set.
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let urlLooksValid = false;
  let urlHost: string | undefined;
  if (url) {
    try {
      // Cheap sanity check on the URL shape; avoids surfacing cryptic errors
      // deep inside @supabase/supabase-js when the URL is mistyped.
      const host = new URL(url).hostname;
      if (host.includes("supabase.")) {
        urlLooksValid = true;
        urlHost = host;
      }
    } catch {
      // urlLooksValid stays false for an unparseable URL.
    }
  }

  return { url, anonKey, urlLooksValid, urlHost };
}

/** Derive the public config status from an env snapshot. Pure, client-safe. */
function diagnose(env: EnvSnapshot): SupabaseConfigStatus {
  const base = {
    hasUrl: !!env.url,
    hasAnonKey: !!env.anonKey,
    urlLooksValid: env.urlLooksValid,
    urlHost: env.urlHost,
  };

  if (!env.url || !env.anonKey) {
    const missing = [
      !env.url && "NEXT_PUBLIC_SUPABASE_URL",
      !env.anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ].filter(Boolean) as string[];
    return {
      ...base,
      configured: false,
      reason: `${missing.join(" and ")} ${
        missing.length > 1 ? "are" : "is"
      } not set. Set the Supabase URL and anon key and redeploy with a fresh build.`,
    };
  }

  if (!env.urlLooksValid) {
    return {
      ...base,
      configured: false,
      reason:
        "NEXT_PUBLIC_SUPABASE_URL does not look like a Supabase project URL (expected https://<project-ref>.supabase.co).",
    };
  }

  return { ...base, configured: true };
}

/**
 * Public Supabase config status. Used by UI surfaces (the /login config
 * notice, the admin data card) to explain exactly what is configured and
 * why. Pure, client-safe, and contains no secrets.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  return diagnose(readEnv());
}

/**
 * Resolve the Supabase config. Every adapter, the session provider, and the
 * edge middleware funnel through this one function. `config` is present only
 * when the credentials are valid; callers short-circuit on its absence.
 */
export function resolveDataMode(): ResolvedDataMode {
  const env = readEnv();
  const diag = diagnose(env);
  if (diag.configured) {
    // diagnose() only reports configured once url + anonKey are both present
    // and the URL is valid, so these assertions hold.
    return { mode: "supabase", config: { url: env.url!, anonKey: env.anonKey! } };
  }
  return { mode: "supabase", reason: diag.reason };
}

/**
 * Service-role key for server-side flows (invites, server actions). Must
 * never reach the browser; calling this from a client component returns
 * undefined. The accessor is server-only by virtue of the missing
 * NEXT_PUBLIC_ prefix on the underlying env var.
 */
export function getServiceRoleKey(): string | undefined {
  // Static, non-public access: the client bundle inlines this as undefined,
  // so the service-role key never ships to the browser.
  return clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
