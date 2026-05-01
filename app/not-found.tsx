import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Compass className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That URL doesn't exist in the Advantage portal. Try the dashboard or
          your board.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90"
          >
            Back to dashboard
          </Link>
          <Link
            href="/board"
            className="inline-flex items-center rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
          >
            Open board
          </Link>
        </div>
      </div>
    </div>
  );
}
