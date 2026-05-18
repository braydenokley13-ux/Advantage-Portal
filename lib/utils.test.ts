import { describe, expect, it } from "vitest";
import {
  formatBytes,
  googleDocId,
  googleDocPreviewUrl,
  inferFileKind,
  initials,
} from "./utils";

describe("formatBytes", () => {
  it("renders raw bytes below 1 KB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("scales into KB / MB / GB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe("5.0 GB");
  });

  it("drops the decimal once the value reaches 10", () => {
    expect(formatBytes(15 * 1024)).toBe("15 KB");
  });

  it("returns an em dash for invalid input", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(NaN)).toBe("—");
  });
});

describe("inferFileKind", () => {
  it("detects pdf by extension or mime", () => {
    expect(inferFileKind("draft.pdf")).toBe("pdf");
    expect(inferFileKind("draft", "application/pdf")).toBe("pdf");
  });

  it("detects docx", () => {
    expect(inferFileKind("essay.docx")).toBe("docx");
    expect(inferFileKind("essay.doc")).toBe("docx");
  });

  it("detects images and text", () => {
    expect(inferFileKind("photo.PNG")).toBe("image");
    expect(inferFileKind("notes.md")).toBe("text");
    expect(inferFileKind("x", "text/plain")).toBe("text");
  });

  it("falls back to other for unknown kinds", () => {
    expect(inferFileKind("archive.zip")).toBe("other");
  });
});

describe("googleDocId", () => {
  it("extracts the doc id from a standard edit URL", () => {
    expect(
      googleDocId("https://docs.google.com/document/d/ABC123/edit")
    ).toBe("ABC123");
  });

  it("returns null for a non-Doc URL", () => {
    expect(googleDocId("https://example.com/page")).toBeNull();
  });
});

describe("googleDocPreviewUrl", () => {
  it("returns the /preview URL for a valid Google Doc link", () => {
    expect(
      googleDocPreviewUrl("https://docs.google.com/document/d/ABC123/edit")
    ).toBe("https://docs.google.com/document/d/ABC123/preview");
  });

  it("returns null for a non-Doc URL", () => {
    expect(googleDocPreviewUrl("https://example.com/not-a-doc")).toBeNull();
  });
});

describe("initials", () => {
  it("takes up to two uppercase initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("cher")).toBe("C");
  });
});
