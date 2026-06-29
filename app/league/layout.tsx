import Link from "next/link";
import { Trophy } from "lucide-react";

/**
 * Public chrome for The Advantage Writers League. This layout sits OUTSIDE the
 * authenticated `(app)` group, so the leaderboard and submission form are
 * reachable by anyone — no sign-in, no app shell. (The /admin/league board
 * surface lives inside the protected app instead.)
 */
export default function LeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/league" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white">
              <Trophy className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-tight">
                The Advantage Journal
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Writers League
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link
              href="/league"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Leaderboard
            </Link>
            <Link
              href="/league/submit"
              className="rounded-md bg-brand-gradient px-3 py-1.5 text-white transition-opacity hover:opacity-95"
            >
              Submit your work
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
