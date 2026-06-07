"use client";

import { useState } from "react";
import { FileUp, Link2, Type, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiClient } from "@/lib/api/provider";
import { emailOnSubmission } from "@/lib/email/workflow";
import { useRole } from "@/lib/role-context";
import { canSubmit } from "@/lib/permissions";
import type { SubmissionFileMeta, SubmissionType, Task } from "@/lib/types";

export function SubmissionForm({
  task,
  onSubmitted,
}: {
  task: Task;
  onSubmitted?: () => void;
}) {
  const { user } = useRole();
  const api = useApiClient();

  const allowed = canSubmit({ task, user });

  const [tab, setTab] = useState<SubmissionType>("inline");
  const [inline, setInline] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileMeta, setFileMeta] = useState<SubmissionFileMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!allowed) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-center">
        <p className="text-sm font-medium">Submission unavailable</p>
        <p className="text-xs text-muted-foreground mt-1">
          {user.role !== "writer"
            ? "Only the assigned writer can submit work."
            : task.writerId !== user.id
              ? "You can only submit work for your own tasks."
              : "This task is complete and locked."}
        </p>
      </div>
    );
  }

  function disabled() {
    if (tab === "inline") return inline.trim().length === 0;
    if (tab === "google_doc") {
      try {
        const u = new URL(docUrl);
        return !u.protocol.startsWith("http");
      } catch {
        return true;
      }
    }
    if (tab === "file") return fileName.length === 0;
    return true;
  }

  async function handleSubmit() {
    if (busy || disabled()) return;
    setBusy(true);
    setError(null);
    try {
      const content =
        tab === "inline"
          ? inline.trim()
          : tab === "google_doc"
            ? docUrl.trim()
            : fileName;
      const submission = await api.createSubmission({
        taskId: task.id,
        authorId: user.id,
        type: tab,
        content,
        file: tab === "file" && fileMeta ? fileMeta : undefined,
      });
      emailOnSubmission(task, submission.version);
      setInline("");
      setDocUrl("");
      setFileName("");
      setFileMeta(null);
      onSubmitted?.();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't save that submission. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SubmissionType)}>
        <TabsList>
          <TabsTrigger value="inline">
            <Type className="h-3.5 w-3.5 mr-1.5" /> Inline
          </TabsTrigger>
          <TabsTrigger value="google_doc">
            <Link2 className="h-3.5 w-3.5 mr-1.5" /> Google Doc
          </TabsTrigger>
          <TabsTrigger value="file">
            <FileUp className="h-3.5 w-3.5 mr-1.5" /> File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inline" className="mt-3">
          <Textarea
            value={inline}
            onChange={(e) => setInline(e.target.value)}
            placeholder="Paste or write your draft here. Markdown supported."
            className="min-h-[180px] font-mono text-[13px]"
          />
        </TabsContent>

        <TabsContent value="google_doc" className="mt-3 space-y-2">
          <Input
            type="url"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/…"
          />
          <p className="text-xs text-muted-foreground">
            Make sure share permissions allow your editor to view the doc.
          </p>
        </TabsContent>

        <TabsContent value="file" className="mt-3">
          <label
            htmlFor="file-input"
            className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-8 text-center cursor-pointer hover:bg-secondary transition-colors"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium mt-2">
              {fileName || "Click to choose a file"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF, DOCX, MD up to 25MB
            </p>
            <input
              id="file-input"
              type="file"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFileName(f.name);
                  setFileMeta({
                    filename: f.name,
                    mimeType: f.type || "application/octet-stream",
                    sizeBytes: f.size,
                  });
                }
              }}
            />
          </label>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-muted-foreground">
          Submitting creates a new version and sends it to your editor.
          {tab === "file" && (
            <>
              {" "}
              File uploads aren&apos;t persisted yet — your editor sees
              the file name and metadata only.
            </>
          )}
        </p>
        <Button
          variant="gradient"
          onClick={handleSubmit}
          disabled={disabled() || busy}
        >
          {busy ? "Submitting…" : "Submit work"}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600 pt-1">{error}</p>
      )}
    </div>
  );
}
