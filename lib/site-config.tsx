"use client";

/* eslint-disable react-hooks/set-state-in-effect */

/**
 * SiteConfigProvider — loads the editable portal configuration and exposes a
 * fully-resolved {@link SiteConfig} (stored patch deep-merged over defaults).
 *
 * Branding, feature toggles, and workflow overrides all read from here via
 * `useSiteConfig()`. Reads are RLS-gated to authenticated users, so before
 * sign-in (e.g. the login page) the resolved config simply falls back to the
 * defaults — the portal still brands itself as "Advantage / Newsroom".
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useApiClient } from "./api/provider";
import { useSession } from "./session";
import {
  DEFAULT_SITE_CONFIG,
  resolveSiteConfig,
  type SiteConfig,
} from "./site-config-defaults";
import type { SiteConfigPatchZ } from "./contracts";

type SiteConfigValue = {
  /** Fully-resolved config (defaults + stored overrides). */
  config: SiteConfig;
  /** The raw stored patch — what the settings editor edits. */
  stored: SiteConfigPatchZ;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Persist a partial patch; other tabs' values are preserved server-side. */
  save: (patch: SiteConfigPatchZ) => Promise<void>;
};

const SiteConfigContext = createContext<SiteConfigValue | null>(null);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const api = useApiClient();
  const { currentUser } = useSession();
  const [stored, setStored] = useState<SiteConfigPatchZ>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getSiteSettings();
      setStored(next ?? {});
    } catch {
      // Unconfigured backend or pre-auth read — fall back to defaults.
      setStored({});
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Re-load on sign-in/sign-out so a fresh session sees the latest config.
  useEffect(() => {
    void refresh();
  }, [refresh, currentUser?.id]);

  const config = useMemo(() => resolveSiteConfig(stored), [stored]);

  // Drive the brand gradient (bg-brand-gradient) from config so an admin can
  // recolour the portal. Fallbacks in tailwind.config keep the original look.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-from", config.brand.accentFrom);
    root.style.setProperty("--brand-to", config.brand.accentTo);
  }, [config.brand.accentFrom, config.brand.accentTo]);

  const save = useCallback(
    async (patch: SiteConfigPatchZ) => {
      const next = await api.updateSiteSettings(patch);
      setStored(next ?? {});
    },
    [api]
  );

  const value = useMemo<SiteConfigValue>(
    () => ({ config, stored, loading, refresh, save }),
    [config, stored, loading, refresh, save]
  );

  return (
    <SiteConfigContext.Provider value={value}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig(): SiteConfigValue {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) {
    throw new Error("useSiteConfig must be used within SiteConfigProvider");
  }
  return ctx;
}

export { DEFAULT_SITE_CONFIG };
