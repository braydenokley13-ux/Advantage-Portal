"use client";

/**
 * Public Writers League submission form.
 *
 * Posts to /api/league/submissions, which upserts the writer, assigns a board
 * editor by rotation, records the piece as "under review", and fires the
 * confirmation + notification emails. No sign-in required — any student writer
 * can submit.
 */
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  name: string;
  email: string;
  school: string;
  grade: string;
  articleTitle: string;
  googleDocLink: string;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  school: "",
  grade: "",
  articleTitle: "",
  googleDocLink: "",
};

export default function SubmitPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ assignedEditor: string } | null>(null);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/league/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone({ assignedEditor: json.assignedEditor ?? "an editor" });
    } catch {
      setError("Couldn't reach the league. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="container max-w-xl py-12 md:py-16">
        <Card>
          <CardContent className="px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight">
              Submission received!
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Thanks, {form.name.split(" ")[0] || "writer"}! Your piece is in the
              review queue with{" "}
              <strong className="text-foreground">{done.assignedEditor}</strong>.
              We&apos;ve emailed you a confirmation with what happens next.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild variant="gradient">
                <Link href="/league">View the leaderboard</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setForm(EMPTY);
                  setDone(null);
                }}
              >
                Submit another piece
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-xl py-10 md:py-14">
      <div className="mb-6 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white">
          <Trophy className="h-5 w-5" />
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Submit to the Writers League
        </h1>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Share your piece with the editorial board. Published work earns 100
          league points and a spot on the public leaderboard.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="name"
                label="Full name"
                value={form.name}
                onChange={(v) => update("name", v)}
                required
                placeholder="Jordan Rivera"
                autoComplete="name"
              />
              <Field
                id="email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
                required
                placeholder="you@school.edu"
                autoComplete="email"
              />
              <Field
                id="school"
                label="School"
                value={form.school}
                onChange={(v) => update("school", v)}
                placeholder="Lincoln High School"
              />
              <Field
                id="grade"
                label="Grade"
                value={form.grade}
                onChange={(v) => update("grade", v)}
                placeholder="11th"
              />
            </div>
            <Field
              id="articleTitle"
              label="Article title"
              value={form.articleTitle}
              onChange={(v) => update("articleTitle", v)}
              required
              placeholder="The case for a four-day school week"
            />
            <Field
              id="googleDocLink"
              label="Google Doc link"
              type="url"
              value={form.googleDocLink}
              onChange={(v) => update("googleDocLink", v)}
              required
              placeholder="https://docs.google.com/document/d/…"
              hint="Make sure sharing is set so the editor can open it."
            />

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit my piece"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By submitting, you agree to let The Advantage Journal review and,
              if selected, publish your work.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
