"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { normalizeEmailOtpType, safeNextPath } from "@/lib/auth/redirects";
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
    const next = safeNextPath(searchParams.get("next"), "/dashboard");
    let active = true;

    function loginPath(error: string) {
      const url = new URL("/login", window.location.origin);
      url.searchParams.set("error", error);
      if (next !== "/dashboard") url.searchParams.set("next", next);
      return `${url.pathname}${url.search}`;
    }

    function errorCode(value: unknown) {
      const message =
        value instanceof Error
          ? value.message
          : typeof value === "string"
            ? value
            : "";
      return /expired|invalid|otp|token|code|verifier|link/i.test(message)
        ? "auth_link_invalid"
        : "auth_callback_failed";
    }

    async function completeAuth() {
      if (!supabase) {
        router.replace(loginPath("auth_not_configured"));
        return;
      }

      const queryError =
        searchParams.get("error_description") ?? searchParams.get("error");
      if (queryError) {
        router.replace(loginPath(errorCode(queryError)));
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const tokenType = normalizeEmailOtpType(searchParams.get("type"));

      if (tokenHash || searchParams.get("type")) {
        if (!tokenHash || !tokenType) {
          router.replace(loginPath("auth_link_incomplete"));
          return;
        }
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tokenType,
        });
        if (!active) return;
        router.replace(error ? loginPath(errorCode(error)) : next);
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        router.replace(error ? loginPath(errorCode(error)) : next);
        return;
      }

      const hash = new URLSearchParams(window.location.hash.slice(1));
      const hashError = hash.get("error_description") ?? hash.get("error");
      if (hashError) {
        router.replace(loginPath(errorCode(hashError)));
        return;
      }

      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (!active) return;
        router.replace(error ? loginPath(errorCode(error)) : next);
        return;
      }

      router.replace(loginPath("auth_link_incomplete"));
    }

    completeAuth().catch((err) => {
      if (active) router.replace(loginPath(errorCode(err)));
    });

    return () => {
      active = false;
    };
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
