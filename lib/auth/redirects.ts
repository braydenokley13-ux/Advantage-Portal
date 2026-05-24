import type { NextRequest } from "next/server";

const DEFAULT_APP_ORIGIN = "http://localhost:3000";

function clean(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function withoutTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function safeNextPath(
  value: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export function getAppOrigin(request?: NextRequest): string {
  const configured = clean(process.env.NEXT_PUBLIC_APP_URL);
  if (configured) {
    try {
      const url = new URL(configured);
      return withoutTrailingSlash(url.origin);
    } catch {
      // Fall through to request-derived origin.
    }
  }

  const host =
    request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
  if (host) {
    const protocol = request?.headers.get("x-forwarded-proto") ?? "http";
    return `${protocol}://${host}`;
  }

  return DEFAULT_APP_ORIGIN;
}

export function appUrl(path: string, request?: NextRequest): string {
  const origin = getAppOrigin(request);
  return new URL(path, `${origin}/`).toString();
}

export function authCallbackUrl(
  request: NextRequest,
  next?: string | null
): string {
  const url = new URL("/auth/callback", `${getAppOrigin(request)}/`);
  const safeNext = safeNextPath(next, "/dashboard");
  if (safeNext !== "/dashboard") url.searchParams.set("next", safeNext);
  return url.toString();
}
