import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function inferFileKind(
  filename: string,
  mimeType?: string
): "pdf" | "docx" | "image" | "text" | "other" {
  const lower = filename.toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("officedocument.wordprocessingml") ||
    mime === "application/msword" ||
    lower.endsWith(".docx") ||
    lower.endsWith(".doc")
  )
    return "docx";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(lower))
    return "image";
  if (
    mime.startsWith("text/") ||
    /\.(md|markdown|txt|rtf)$/.test(lower)
  )
    return "text";
  return "other";
}

export function googleDocId(url: string): string | null {
  const m = url.match(/\/document\/d\/([^/]+)/);
  return m ? m[1] : null;
}

/**
 * Embeddable preview URL for a Google Doc link, or null when the URL isn't a
 * recognisable Doc. The `/preview` endpoint renders read-only in an iframe
 * for any doc the viewer is allowed to open.
 */
export function googleDocPreviewUrl(url: string): string | null {
  const id = googleDocId(url);
  return id ? `https://docs.google.com/document/d/${id}/preview` : null;
}
