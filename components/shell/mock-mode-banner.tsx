import { AlertTriangle, Check, RefreshCcw, X } from "lucide-react";
import { getDataModeDiagnostics } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/**
 * Deliberately hard-to-miss banner shown on /login whenever the app
 * resolves to mock data mode. It explains that Supabase is not active
 * and — critically — that NEXT_PUBLIC_* env vars are baked into the
 * bundle at build time, so a Vercel deploy needs a fresh, cache-free
 * rebuild to pick them up.
 *
 * Renders nothing when Supabase mode is active.
 */
export function MockModeBanner() {
  const diag = getDataModeDiagnostics();
  if (diag.resolvedMode === "supabase") return null;

  const {
    downgraded,
    reason,
    requestedMode,
    hasUrl,
    hasAnonKey,
    urlLooksValid,
  } = diag;

  return (
    <section
      role="alert"
      className="overflow-hidden rounded-xl border-2 border-amber-400 bg-amber-50 shadow-soft"
    >
      <header className="flex items-start gap-3 border-b border-amber-200 bg-amber-100 px-4 py-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-soft">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {downgraded
              ? "Supabase was requested, but it is not active"
              : "Demo mode — Supabase is not connected"}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-amber-800">
            This deployment is running on <strong>demo / mock data</strong>.
            The accounts below are seeded examples and every change resets on
            reload. Real sign-in and the live database are switched off.
          </p>
        </div>
      </header>

      <div className="space-y-3 px-4 py-3.5">
        {downgraded && reason && (
          <p className="rounded-md border border-amber-300 bg-amber-100 px-2.5 py-2 text-xs leading-snug text-amber-900">
            <span className="font-semibold">Why this happened: </span>
            {reason}
          </p>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Environment detected in this build
          </p>
          <ul className="space-y-1">
            <DiagRow
              label="NEXT_PUBLIC_DATA_MODE"
              ok={requestedMode === "supabase"}
              detail={requestedMode}
            />
            <DiagRow
              label="NEXT_PUBLIC_SUPABASE_URL"
              ok={hasUrl && urlLooksValid}
              detail={
                !hasUrl
                  ? "not set"
                  : urlLooksValid
                    ? "set"
                    : "set, but not a Supabase URL"
              }
            />
            <DiagRow
              label="NEXT_PUBLIC_SUPABASE_ANON_KEY"
              ok={hasAnonKey}
              detail={hasAnonKey ? "set" : "not set"}
            />
          </ul>
        </div>

        <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <RefreshCcw className="h-3.5 w-3.5" />
            How to switch this deployment to Supabase
          </p>
          <ol className="mt-2 space-y-1.5 text-xs leading-snug text-amber-800">
            <FixStep n={1}>
              In Vercel, open{" "}
              <strong>Project → Settings → Environment Variables</strong> and
              set <Code>NEXT_PUBLIC_DATA_MODE=supabase</Code> along with{" "}
              <Code>NEXT_PUBLIC_SUPABASE_URL</Code> and{" "}
              <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code>. Add them to the
              environment you are deploying — Production, Preview, or
              Development.
            </FixStep>
            <FixStep n={2}>
              Every <Code>NEXT_PUBLIC_*</Code> value is compiled into the
              JavaScript bundle at <strong>build time</strong>. A deployment
              that is already live will not pick up dashboard changes.
            </FixStep>
            <FixStep n={3}>
              Trigger a fresh redeploy:{" "}
              <strong>Deployments → … → Redeploy</strong>, and turn{" "}
              <strong>off</strong> the{" "}
              <strong>Use existing Build Cache</strong> option.
            </FixStep>
            <FixStep n={4}>
              A restart, instant rollback, or cache-reused redeploy is not
              enough — it must be a brand-new build for the new values to
              take effect.
            </FixStep>
          </ol>
        </div>

        <p className="text-[11px] leading-snug text-amber-700">
          Mock mode is intentional for offline demos. If that is what you
          want, you can ignore this notice and sign in with any account
          below.
        </p>
      </div>
    </section>
  );
}

function DiagRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white",
          ok ? "bg-emerald-600" : "bg-red-500"
        )}
      >
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <code className="text-[11px] font-medium text-amber-900">{label}</code>
      <span className="ml-auto truncate pl-2 text-[11px] text-amber-700">
        {detail}
      </span>
    </li>
  );
}

function FixStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-900">
      {children}
    </code>
  );
}
