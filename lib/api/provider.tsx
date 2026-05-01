"use client";

/**
 * ApiClientProvider — exposes the active `ApiClient` to React.
 *
 * Today this defaults to the in-memory MockAdapter bound to the current
 * session. Once a real HTTP backend exists, swap the adapter here:
 *   <ApiClientProvider mode="http" client={new HttpApiClient(...)} />
 */
import { createContext, useContext } from "react";
import type { ApiAdapterMode, ApiClient } from "./client";
import { useMockApiClient } from "./mock-adapter";
import { useSession } from "@/lib/session";

type ApiContextValue = {
  client: ApiClient;
  mode: ApiAdapterMode;
};

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useSession();
  const client = useMockApiClient(currentUser?.id ?? null);
  return (
    <ApiContext.Provider value={{ client, mode: "mock" }}>
      {children}
    </ApiContext.Provider>
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
