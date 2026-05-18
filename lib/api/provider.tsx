"use client";

/**
 * ApiClientProvider — exposes the active `ApiClient` to React.
 *
 * Selects between two adapters based on `NEXT_PUBLIC_DATA_MODE`:
 *   - "mock"     (default) → in-memory MockAdapter, fully offline
 *   - "supabase"           → SupabaseAdapter against the configured project
 *
 * If supabase mode is requested but credentials are missing or invalid,
 * `resolveDataMode()` downgrades silently to mock and we surface that on
 * the console via the warning ref, then continue with the mock client so
 * the app stays usable.
 */
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { ApiAdapterMode, ApiClient } from "./client";
import { useMockApiClient } from "./mock-adapter";
import { SupabaseApiClient } from "./supabase-adapter";
import { useSession } from "@/lib/session";
import { resolveDataMode } from "@/lib/supabase/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ApiContextValue = {
  client: ApiClient;
  mode: ApiAdapterMode;
  /** Populated when supabase mode was requested but downgraded to mock. */
  fallbackReason?: string;
};

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useSession();
  const mockClient = useMockApiClient(currentUser?.id ?? null);

  const resolved = resolveDataMode();
  const sbClient = resolved.mode === "supabase" ? getSupabaseBrowserClient() : null;

  const value = useMemo<ApiContextValue>(() => {
    if (resolved.mode === "supabase" && sbClient) {
      return {
        client: new SupabaseApiClient(sbClient, currentUser?.id ?? null),
        mode: "supabase",
      };
    }
    return {
      client: mockClient,
      mode: "mock",
      fallbackReason: resolved.reason,
    };
  }, [mockClient, sbClient, resolved.mode, resolved.reason, currentUser?.id]);

  // Surface the fallback reason exactly once per page load so devs notice
  // when supabase mode was requested but the app is actually running mock.
  const warned = useRef(false);
  useEffect(() => {
    if (!warned.current && value.fallbackReason) {
      warned.current = true;
      // eslint-disable-next-line no-console
      console.warn(`[advantage-portal] ${value.fallbackReason}`);
    }
  }, [value.fallbackReason]);

  return (
    <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error("useApiClient must be used within ApiClientProvider");
  }
  return ctx.client;
}

export function useApiMode(): ApiAdapterMode {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error("useApiMode must be used within ApiClientProvider");
  }
  return ctx.mode;
}

export function useApiFallbackReason(): string | undefined {
  return useContext(ApiContext)?.fallbackReason;
}
