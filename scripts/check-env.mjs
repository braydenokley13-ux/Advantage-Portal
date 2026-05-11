#!/usr/bin/env node
/**
 * Pre-production env sanity check.
 *
 * Usage:
 *   node scripts/check-env.mjs            # respects current env
 *   node scripts/check-env.mjs --prod     # require production-grade vars
 *
 * Exits non-zero if a required variable is missing. Designed to be wired
 * into CI via `npm run check:env`.
 */
const args = new Set(process.argv.slice(2));
const requireProd = args.has("--prod");

const dataMode = (process.env.NEXT_PUBLIC_DATA_MODE ?? "mock").toLowerCase();

const required = [];
const warnings = [];

if (dataMode === "supabase" || requireProd) {
  required.push("NEXT_PUBLIC_SUPABASE_URL");
  required.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  required.push("NEXT_PUBLIC_APP_URL");
  if (requireProd) {
    required.push("SUPABASE_SERVICE_ROLE_KEY");
  } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY is unset — admin invites and server-only flows will be disabled."
    );
  }
}

const missing = required.filter((name) => {
  const v = process.env[name];
  return !v || v.length === 0;
});

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!u.hostname.includes("supabase.")) {
      warnings.push(
        `NEXT_PUBLIC_SUPABASE_URL host (${u.hostname}) does not look like a Supabase project URL.`
      );
    }
  } catch {
    missing.push("NEXT_PUBLIC_SUPABASE_URL (invalid URL)");
  }
}

if (process.env.NEXT_PUBLIC_APP_URL) {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_APP_URL);
    if (
      requireProd &&
      (u.hostname === "localhost" || u.hostname.endsWith(".local"))
    ) {
      warnings.push(
        `NEXT_PUBLIC_APP_URL=${process.env.NEXT_PUBLIC_APP_URL} looks like a dev URL but --prod was requested.`
      );
    }
  } catch {
    missing.push("NEXT_PUBLIC_APP_URL (invalid URL)");
  }
}

if (missing.length > 0) {
  console.error("[check-env] FAILED — missing required variables:");
  for (const name of missing) console.error(`  • ${name}`);
  process.exit(1);
}

if (warnings.length > 0) {
  for (const w of warnings) console.warn(`[check-env] WARN: ${w}`);
}

console.log(
  `[check-env] OK — data mode: ${dataMode}${requireProd ? " (prod check)" : ""}`
);
