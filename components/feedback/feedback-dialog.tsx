"use client";

import { useState } from "react";
import { MessageSquarePlus, Loader2, Check, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useApiClient } from "@/lib/api/provider";
import { useRole } from "@/lib/role-context";
import { useStore } from "@/lib/store";
import { useSiteConfig } from "@/lib/site-config";
import { emailOnFeedbackSubmitted } from "@/lib/email/workflow";
import { cn } from "@/lib/utils";
import type { FeedbackCategory } from "@/lib/types";

/** A topbar button that opens the "send feedback" dialog. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function FeedbackDialog({
  open,
  onOpenChange,
  /** Optionally attach the feedback to a specific thing. */
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target?: { kind: string; id?: string; label: string };
}) {
  const api = useApiClient();
  const { user } = useRole();
  const { users } = useStore();
  const { config } = useSiteConfig();
  const categories = config.feedbackCategories;

  const [category, setCategory] = useState<FeedbackCategory>(
    (categories[0]?.value as FeedbackCategory) ?? "general"
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function reset() {
    setCategory((categories[0]?.value as FeedbackCategory) ?? "general");
    setSubject("");
    setMessage("");
    setRating(null);
    setError(null);
    setSent(false);
    setBusy(false);
  }

  function close() {
    onOpenChange(false);
    // Let the close animation finish before clearing the form.
    setTimeout(reset, 200);
  }

  async function submit() {
    if (busy) return;
    if (!subject.trim() || !message.trim()) {
      setError("Add a short subject and a message.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createFeedback({
        authorId: user.id,
        category,
        subject: subject.trim(),
        message: message.trim(),
        rating: rating ?? undefined,
        targetKind: target?.kind,
        targetId: target?.id,
        targetLabel: target?.label,
      });
      emailOnFeedbackSubmitted(users, subject.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send feedback.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            {target
              ? `About: ${target.label}`
              : "Tell us about anything — the portal, a story, the competition, or an idea."}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="px-5 py-10 flex flex-col items-center text-center">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold">Thanks for the feedback!</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              The team will see it in the feedback queue. We read every note.
            </p>
            <Button className="mt-4" variant="outline" size="sm" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fb-category">What is this about?</Label>
                <Select
                  id="fb-category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as FeedbackCategory)
                  }
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fb-subject">Subject</Label>
                <Input
                  id="fb-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="A short summary"
                  maxLength={120}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fb-message">Details</Label>
                <Textarea
                  id="fb-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened, what you'd change, or your idea…"
                  className="min-h-[110px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label>How was your experience? (optional)</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      onClick={() => setRating((r) => (r === n ? null : n))}
                      className="p-0.5 text-amber-400 transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          rating && n <= rating
                            ? "fill-amber-400"
                            : "fill-transparent text-muted-foreground"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send feedback"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
