"use client";

/**
 * Browser-side Supabase client. Returns null when the env vars are absent or
 * malformed so callers can short-circuit cleanly and surface the
 * misconfiguration instead of crashing deep inside @supabase/supabase-js.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveDataMode } from "./env";

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const resolved = resolveDataMode();
  if (resolved.mode !== "supabase" || !resolved.config) return null;
  if (cached) return cached;
  cached = createBrowserClient(resolved.config.url, resolved.config.anonKey);
  return cached;
}
