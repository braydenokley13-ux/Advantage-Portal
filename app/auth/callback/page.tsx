"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/auth/redirects";
import { resolveDataMode } from "@/lib/supabase/env";

// Always create a fresh client here so it reads the current URL hash.
// The singleton in browser.ts may have been cached before the hash existed.
function makeFreshClient() {
  const resolved = resolveDataMode();
  if (resolved.mode !== "supabase" || !resolved.config) return null;
  return createBrowserClient(resolved.config.url, resolved.config.anonKey);
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = makeFreshClient();
    if (!supabase) {
      router.replace("/login?error=auth_callback_failed");
      return;
    }

    const next = safeNextPath(searchParams.get("next"), "/dashboard");
    const code = searchParams.get("code");
    const queryError = searchParams.get("error_description") ?? searchParams.get("error");

    if (queryError) {
      router.replace("/login?error=auth_callback_failed");
      return;
    }

    // ── PKCE flow (code param) ─────────────────────────────────────────────
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? "/login?error=auth_callback_failed" : next);
      });
      return;
    }

    // ── Implicit flow (tokens in URL hash) ────────────────────────────────
    // Parse access_token + refresh_token from the fragment and set the session
    // directly — more reliable than waiting for the client to auto-detect.
    const hash = window.location.hash.slice(1);
    if (hash.includes("error")) {
      router.replace("/login?error=auth_callback_failed");
      return;
    }

    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          router.replace(error ? "/login?error=auth_callback_failed" : next);
        });
        return;
      }
    }

    router.replace("/login?error=auth_callback_failed");
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
