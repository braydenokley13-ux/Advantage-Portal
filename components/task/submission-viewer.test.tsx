import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubmissionViewer } from "./submission-viewer";
import type { Submission } from "@/lib/types";

function makeSubmission(overrides: Partial<Submission>): Submission {
  return {
    id: "sub-1",
    taskId: "task-1",
    type: "google_doc",
    version: 1,
    content: "",
    createdAt: "2026-05-18T12:00:00.000Z",
    isCurrent: true,
    ...overrides,
  };
}

describe("SubmissionViewer — google_doc", () => {
  it("renders a preview iframe for a valid Google Doc URL", () => {
    render(
      <SubmissionViewer
        submission={makeSubmission({
          type: "google_doc",
          content: "https://docs.google.com/document/d/ABC123/edit",
        })}
      />
    );
    const iframe = screen.getByTitle("Google Doc preview");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://docs.google.com/document/d/ABC123/preview"
    );
  });

  it("shows the fallback for an unrecognised URL", () => {
    render(
      <SubmissionViewer
        submission={makeSubmission({
          type: "google_doc",
          content: "https://example.com/not-a-doc",
        })}
      />
    );
    expect(screen.getByText("Link not recognised")).toBeInTheDocument();
    expect(screen.queryByTitle("Google Doc preview")).not.toBeInTheDocument();
  });
});

describe("SubmissionViewer — file", () => {
  it("renders the file metadata note", () => {
    render(
      <SubmissionViewer
        submission={makeSubmission({
          type: "file",
          content: "report.pdf",
          file: {
            filename: "report.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
          },
        })}
      />
    );
    expect(screen.getAllByText("report.pdf").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/records the file’s details only/i)
    ).toBeInTheDocument();
  });
});
