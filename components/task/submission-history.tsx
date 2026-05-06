"use client";

import { FileText, Link2, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSubmissions } from "@/lib/hooks";
import { format } from "date-fns";
import { cn, formatBytes } from "@/lib/utils";
import type { Submission, SubmissionType } from "@/lib/types";

const KIND_ICON: Record<SubmissionType, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  google_doc: Link2,
  inline: Type,
};

export function SubmissionHistory({
  taskId,
  onSelect,
  selectedId,
}: {
  taskId: string;
  onSelect?: (s: Submission) => void;
  selectedId?: string;
}) {
  const { data: submissions } = useSubmissions(taskId);
  const items = (submissions ?? [])
    .slice()
    .sort((a, b) => b.version - a.version);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No submissions yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((s) => {
        const Icon = KIND_ICON[s.type];
        const active = selectedId === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect?.(s)}
              className={cn(
                "w-full flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent",
                active && "ring-2 ring-primary/40 border-primary/40"
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Version {s.version}</p>
                  {s.isCurrent && (
                    <Badge variant="success" className="h-5">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {format(new Date(s.createdAt), "MMM d, h:mm a")} ·{" "}
                  {kindLabel(s.type)}
                  {s.file ? ` · ${formatBytes(s.file.sizeBytes)}` : ""}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function kindLabel(kind: SubmissionType) {
  if (kind === "google_doc") return "Google Doc";
  if (kind === "file") return "File";
  return "Inline";
}
