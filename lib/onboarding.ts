/**
 * Onboarding progress is a client-side UX concern (the welcome flow and the
 * dashboard tour), so it is tracked per-user in localStorage rather than in
 * the database. Reads default to "done" on the server / when storage is
 * unavailable so a user is never trapped in a redirect loop.
 */
const ONBOARDED_PREFIX = "advantage-portal:onboarded:";
const TOUR_PREFIX = "advantage-portal:tour-seen:";

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function writeFlag(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore — private mode / storage disabled
  }
}

export function isOnboarded(userId: string): boolean {
  return readFlag(ONBOARDED_PREFIX + userId);
}

export function markOnboarded(userId: string): void {
  writeFlag(ONBOARDED_PREFIX + userId);
}

export function isTourSeen(userId: string): boolean {
  return readFlag(TOUR_PREFIX + userId);
}

export function markTourSeen(userId: string): void {
  writeFlag(TOUR_PREFIX + userId);
}
