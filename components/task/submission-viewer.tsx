"use client";

import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  FileType2,
  Image as ImageIcon,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineMarkdownViewer } from "./inline-markdown-viewer";
import {
  cn,
  formatBytes,
  googleDocId,
  inferFileKind,
} from "@/lib/utils";
import { format } from "date-fns";
import type { Submission, SubmissionFileMeta, Task } from "@/lib/types";

const FILE_KIND_TONE: Record<
  ReturnType<typeof inferFileKind>,
  { tone: string; label: string; icon: typeof FileText }
> = {
  pdf: { tone: "bg-red-100 text-red-700", label: "PDF", icon: FileText },
  docx: { tone: "bg-blue-100 text-blue-700", label: "DOCX", icon: FileType2 },
  image: { tone: "bg-emerald-100 text-emerald-700", label: "Image", icon: ImageIcon },
  text: { tone: "bg-slate-100 text-slate-700", label: "Text", icon: FileText },
  other: { tone: "bg-secondary text-muted-foreground", label: "File", icon: FileText },
};

export function SubmissionViewer({
  submission,
  task,
}: {
  submission: Submission;
  task?: Task;
}) {
  if (submission.type === "inline" && task) {
    return <InlineMarkdownViewer submission={submission} task={task} />;
  }

  if (submission.type === "inline") {
    return (
      <article className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <Badge variant="secondary">Inline · v{submission.version}</Badge>
        </div>
        <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-foreground">
          {submission.content}
        </pre>
      </article>
    );
  }

  if (submission.type === "google_doc") {
    return <GoogleDocCard submission={submission} />;
  }

  return <FileCard submission={submission} />;
}

function FileCard({ submission }: { submission: Submission }) {
  const meta: SubmissionFileMeta = submission.file ?? {
    filename: submission.content,
    mimeType: "application/octet-stream",
    sizeBytes: 0,
  };
  const kind = inferFileKind(meta.filename, meta.mimeType);
  const tone = FILE_KIND_TONE[kind];
  const Icon = tone.icon;

  return (
    <article className="rounded-lg border border-border bg-card overflow-hidden shadow-soft">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "h-10 w-10 shrink-0 rounded-md flex items-center justify-center",
              tone.tone
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{meta.filename}</p>
            <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{tone.label}</span>
              <span>·</span>
              <span>{formatBytes(meta.sizeBytes)}</span>
              <span>·</span>
              <span>v{submission.version}</span>
              <span>·</span>
              <span>
                Uploaded{" "}
                {format(new Date(submission.createdAt), "MMM d, h:mm a")}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              alert("Download is mocked — no file is actually fetched.");
            }}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.preventDefault();
              alert("Open is mocked — no preview is rendered.");
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </Button>
        </div>
      </header>
      <FilePreviewPlaceholder kind={kind} filename={meta.filename} />
    </article>
  );
}

function FilePreviewPlaceholder({
  kind,
  filename,
}: {
  kind: ReturnType<typeof inferFileKind>;
  filename: string;
}) {
  const message =
    kind === "pdf"
      ? "PDF preview placeholder. In production, an embedded reader would render here."
      : kind === "docx"
        ? "DOCX preview placeholder. In production, this would render a rich rendition of the document."
        : kind === "image"
          ? "Image preview placeholder."
          : kind === "text"
            ? "Plain-text preview placeholder."
            : "Preview not available for this file type.";

  return (
    <div className="bg-secondary/40 px-4 py-10">
      <div className="mx-auto max-w-md rounded-lg border border-dashed border-border bg-background px-5 py-8 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {kind} preview
        </p>
        <p className="mt-1.5 text-sm font-medium truncate" title={filename}>
          {filename}
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}

function GoogleDocCard({ submission }: { submission: Submission }) {
  const url = submission.content;
  const docId = googleDocId(url);

  return (
    <article className="rounded-lg border border-border bg-card overflow-hidden shadow-soft">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              Google Doc · v{submission.version}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {url}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a href={url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </Button>
          </a>
        </div>
      </header>

      <div className="bg-secondary/40 px-4 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-dashed border-border bg-background px-5 py-8 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Google Doc embed
          </p>
          <p className="mt-1.5 text-sm font-medium">
            {docId ? `doc/${docId.slice(0, 12)}…` : "Embed placeholder"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            In production, an inline iframe preview would render here. This MVP
            does not perform external fetches.
          </p>
        </div>
      </div>

      <div className="border-t border-border bg-amber-50/60 px-4 py-2.5 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-[11.5px] text-amber-900 leading-relaxed">
          <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />
          Private Google Docs may not be previewable. Make sure share
          permissions allow your reviewer to view the document.
        </p>
      </div>
    </article>
  );
}
