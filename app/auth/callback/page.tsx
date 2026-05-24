"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      router.replace("/login?error=auth_callback_failed");
      return;
    }

    const next = searchParams.get("next") ?? "/dashboard";
    const code = searchParams.get("code");

    if (code) {
      // PKCE flow — exchange the code for a session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? "/login?error=auth_callback_failed" : next);
      });
      return;
    }

    // Implicit flow — tokens arrive as a URL hash fragment (#access_token=...).
    // The Supabase browser client automatically reads and stores the session
    // from the hash when getSession() is called. Retry a few times since the
    // client may need a tick to process the fragment.
    if (window.location.hash.includes("access_token")) {
      let attempts = 0;
      const poll = () => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            router.replace(next);
          } else if (attempts++ < 8) {
            setTimeout(poll, 250);
          } else {
            router.replace("/login?error=auth_callback_failed");
          }
        });
      };
      poll();
      return;
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
