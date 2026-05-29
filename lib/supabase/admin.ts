import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleKey, resolveDataMode } from "./env";

let cached: SupabaseClient | null = null;
let cachedKey: string | null = null;

export class SupabaseAdminConfigurationError extends Error {
  constructor(message = "Supabase admin client is not configured.") {
    super(message);
    this.name = "SupabaseAdminConfigurationError";
  }
}

export function getSupabaseAdminClient(): SupabaseClient {
  const resolved = resolveDataMode();
  const serviceKey = getServiceRoleKey();

  if (resolved.mode !== "supabase" || !resolved.config) {
    throw new SupabaseAdminConfigurationError(
      "Set NEXT_PUBLIC_DATA_MODE=supabase with a valid Supabase URL and anon key."
    );
  }

  if (!serviceKey) {
    throw new SupabaseAdminConfigurationError(
      "Set SUPABASE_SERVICE_ROLE_KEY before using server-side auth email flows."
    );
  }

  const cacheKey = `${resolved.config.url}:${serviceKey}`;
  if (cached && cachedKey === cacheKey) return cached;

  cached = createClient(resolved.config.url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  cachedKey = cacheKey;
  return cached;
}

export function getSupabaseProjectUrl(): string {
  const resolved = resolveDataMode();
  if (resolved.mode !== "supabase" || !resolved.config) {
    throw new SupabaseAdminConfigurationError(
      "Set NEXT_PUBLIC_DATA_MODE=supabase with a valid Supabase URL and anon key."
    );
  }
  return resolved.config.url;
}
