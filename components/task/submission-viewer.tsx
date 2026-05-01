"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Submission } from "@/lib/types";

export function SubmissionViewer({ submission }: { submission: Submission }) {
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
    return (
      <a
        href={submission.content}
        target="_blank"
        rel="noreferrer"
        className="block rounded-lg border border-border bg-card p-4 hover:bg-accent transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Google Doc · v{submission.version}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[28rem]">
                {submission.content}
              </p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </div>
      </a>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-secondary text-muted-foreground flex items-center justify-center">
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{submission.content}</p>
          <p className="text-xs text-muted-foreground">
            File · v{submission.version}
          </p>
        </div>
      </div>
    </div>
  );
}
