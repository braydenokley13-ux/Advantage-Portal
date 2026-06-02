import { timingSafeEqual } from "crypto";

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Pull the token out of an `Authorization: Bearer <token>` header. */
export function extractBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Authorize a cron invocation. Accepts the secret either as a Bearer token
 * (how Vercel Cron sends `CRON_SECRET`) or as a `?secret=` query param (so a
 * free external scheduler that can't set headers — GitHub Actions, cron-job.org
 * — can still call it). Returns false when no secret is configured, so the
 * endpoint is never left open by accident.
 */
export function isCronAuthorized(opts: {
  authorization?: string | null;
  querySecret?: string | null;
  expectedSecret?: string | null;
}): boolean {
  const expected = opts.expectedSecret?.trim();
  if (!expected) return false;

  const bearer = extractBearer(opts.authorization);
  if (bearer && safeEqual(bearer, expected)) return true;

  const query = opts.querySecret?.trim();
  if (query && safeEqual(query, expected)) return true;

  return false;
}
