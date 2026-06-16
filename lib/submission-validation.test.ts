import { describe, expect, it } from "vitest";
import {
  MAX_SUBMISSION_FILE_BYTES,
  isAcceptableSubmissionUrl,
  validateSubmissionFile,
} from "./submission-validation";

describe("validateSubmissionFile", () => {
  it("accepts a normal in-range supported file", () => {
    expect(
      validateSubmissionFile({ name: "draft.pdf", size: 2048 })
    ).toEqual({ ok: true });
  });

  it("accepts each documented extension, case-insensitively", () => {
    for (const name of [
      "a.PDF",
      "a.doc",
      "a.docx",
      "a.md",
      "a.markdown",
      "a.txt",
      "a.RTF",
    ]) {
      expect(validateSubmissionFile({ name, size: 10 }).ok).toBe(true);
    }
  });

  it("rejects an empty (0-byte) file", () => {
    const r = validateSubmissionFile({ name: "draft.pdf", size: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/empty/i);
  });

  it("rejects a file with a non-finite or negative size", () => {
    expect(validateSubmissionFile({ name: "a.pdf", size: NaN }).ok).toBe(false);
    expect(validateSubmissionFile({ name: "a.pdf", size: -5 }).ok).toBe(false);
  });

  it("accepts a file exactly at the 25MB limit but rejects one byte over", () => {
    expect(
      validateSubmissionFile({
        name: "a.pdf",
        size: MAX_SUBMISSION_FILE_BYTES,
      }).ok
    ).toBe(true);
    const over = validateSubmissionFile({
      name: "a.pdf",
      size: MAX_SUBMISSION_FILE_BYTES + 1,
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/25MB/i);
  });

  it("rejects an unsupported file type", () => {
    const r = validateSubmissionFile({ name: "malware.exe", size: 1024 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unsupported/i);
  });

  it("rejects a blank filename", () => {
    expect(validateSubmissionFile({ name: "   ", size: 1024 }).ok).toBe(false);
  });
});

describe("isAcceptableSubmissionUrl", () => {
  it("accepts http and https URLs", () => {
    expect(
      isAcceptableSubmissionUrl("https://docs.google.com/document/d/X/edit")
    ).toBe(true);
    expect(isAcceptableSubmissionUrl("http://example.com")).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(
      isAcceptableSubmissionUrl("  https://docs.google.com/document/d/X  ")
    ).toBe(true);
  });

  it("rejects empty, non-URL, and non-http schemes", () => {
    expect(isAcceptableSubmissionUrl("")).toBe(false);
    expect(isAcceptableSubmissionUrl("   ")).toBe(false);
    expect(isAcceptableSubmissionUrl("not a url")).toBe(false);
    expect(isAcceptableSubmissionUrl("javascript:alert(1)")).toBe(false);
    expect(isAcceptableSubmissionUrl("ftp://example.com")).toBe(false);
    expect(isAcceptableSubmissionUrl("mailto:a@b.com")).toBe(false);
  });
});
