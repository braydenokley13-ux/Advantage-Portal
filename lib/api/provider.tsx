"use client";

/**
 * ApiClientProvider — exposes the active `ApiClient` to React.
 *
 * The portal is Supabase-only: this always builds a `SupabaseApiClient`
 * against the configured project. When credentials are missing it provides a
 * fail-loud client whose every method rejects with a clear error, so the app
 * surfaces the misconfiguration instead of silently serving throwaway data.
 */
import { createContext, useContext, useMemo } from "react";
import { ApiError, type ApiClient } from "./client";
import { SupabaseApiClient } from "./supabase-adapter";
import { useSession } from "@/lib/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const ApiContext = createContext<ApiClient | null>(null);

export function ApiClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useSession();

  const client = useMemo<ApiClient>(() => {
    const sb = getSupabaseBrowserClient();
    if (sb) return new SupabaseApiClient(sb, currentUser?.id ?? null);
    // Unconfigured: every call rejects with a clear error.
    return new Proxy({} as ApiClient, {
      get:
        () =>
        async () => {
          throw new ApiError(
            "The portal backend is not configured. Check the Supabase environment variables.",
            503
          );
        },
    });
  }, [currentUser?.id]);

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApiClient(): ApiClient {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error("useApiClient must be used within ApiClientProvider");
  }
  return ctx;
}
