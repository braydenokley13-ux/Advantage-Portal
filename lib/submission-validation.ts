/**
 * Client-side validation for the writer submission form.
 *
 * These helpers are the SINGLE gate on submission input: the API adapter
 * (`createSubmission`) inserts straight into the database without re-parsing
 * the payload, so whatever the form lets through is what gets persisted. Keep
 * the rules here in sync with the copy shown in `SubmissionForm`.
 */

/** Hard ceiling for a file submission. Mirrors the "up to 25MB" form copy. */
export const MAX_SUBMISSION_FILE_BYTES = 25 * 1024 * 1024;

/**
 * File extensions a writer may attach. Mirrors the "PDF, DOCX, MD" form copy,
 * plus the closely-related plain-text/rich-text formats a draft is likely to
 * arrive in. Used both for the `accept` hint and for hard validation.
 */
export const ACCEPTED_SUBMISSION_FILE_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".md",
  ".markdown",
  ".txt",
  ".rtf",
] as const;

/** Value for an `<input type="file" accept>` attribute. */
export const SUBMISSION_FILE_ACCEPT =
  ACCEPTED_SUBMISSION_FILE_EXTENSIONS.join(",");

export type FileValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validate a chosen file before it becomes a submission. Rejects empty files,
 * oversized files, and unsupported types so the form never submits metadata
 * that contradicts what the UI promised.
 */
export function validateSubmissionFile(file: {
  name: string;
  size: number;
}): FileValidationResult {
  const name = file.name.trim();
  if (name.length === 0) {
    return { ok: false, error: "That file doesn't have a name." };
  }

  // `size` can be NaN/negative for malformed File objects — treat anything
  // that isn't a real positive byte count as an empty/unreadable file.
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      ok: false,
      error: "That file is empty. Choose a file with content.",
    };
  }

  if (file.size > MAX_SUBMISSION_FILE_BYTES) {
    return {
      ok: false,
      error: "That file is over the 25MB limit. Choose a smaller file.",
    };
  }

  const lower = name.toLowerCase();
  const accepted = ACCEPTED_SUBMISSION_FILE_EXTENSIONS.some((ext) =>
    lower.endsWith(ext)
  );
  if (!accepted) {
    return {
      ok: false,
      error: "Unsupported file type. Upload a PDF, DOCX, MD, or TXT file.",
    };
  }

  return { ok: true };
}

/**
 * Whether a string is an acceptable submission link. Accepts only absolute
 * http(s) URLs. Trims first so a pasted link with stray whitespace validates
 * the same way the trimmed value is ultimately stored.
 */
export function isAcceptableSubmissionUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
