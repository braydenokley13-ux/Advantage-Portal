"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Feather,
  KanbanSquare,
  Lightbulb,
  Loader2,
  MessageSquare,
  Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/lib/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { markOnboarded } from "@/lib/onboarding";
import { initials } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLE_BLURB: Record<Role, string> = {
  writer:
    "You'll pitch story ideas, pick up assignments, and submit drafts for editorial review.",
  editor:
    "You'll review submissions, run the copy and fact-check desks, and move stories toward publication.",
  leader:
    "You'll plan issues, set deadlines, and keep every story on track across the newsroom.",
  admin:
    "You have full access — manage the team, moderation, and editorial escalations.",
};

const HIGHLIGHTS = [
  {
    icon: KanbanSquare,
    title: "Track every story",
    text: "Watch each piece move from pitch to published on the board.",
  },
  {
    icon: Lightbulb,
    title: "Pitch ideas",
    text: "Propose stories and get editorial decisions in one place.",
  },
  {
    icon: MessageSquare,
    title: "Stay in sync",
    text: "Message your team and never miss a deadline.",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const session = useSession();
  const { currentUser, isReady, isAuthenticated, mode } = session;

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seeded = useRef(false);

  // Redirect guards: must be a signed-in Supabase user to onboard.
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/login?next=%2Fwelcome");
      return;
    }
    if (mode !== "supabase") {
      router.replace("/dashboard");
    }
  }, [isReady, isAuthenticated, mode, router]);

  // Seed the form from the resolved profile, once.
  useEffect(() => {
    if (currentUser && !seeded.current) {
      seeded.current = true;
      setName(currentUser.name ?? "");
      setAvatarUrl(currentUser.avatarUrl ?? "");
    }
  }, [currentUser]);

  if (!isReady || !isAuthenticated || mode !== "supabase" || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firstName = (name || currentUser.name || "there").split(" ")[0];

  async function handleUpload(file: File) {
    setUploadNote(null);
    if (!file.type.startsWith("image/")) {
      setUploadNote("Pick an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadNote("Image must be under 2 MB.");
      return;
    }
    const sb = getSupabaseBrowserClient();
    if (!sb || !currentUser) {
      setUploadNote("Not connected.");
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${currentUser.id}/avatar.${ext}`;
    const { error: upErr } = await sb.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      setUploadNote(
        "Couldn't upload the photo — you can add one later once the storage bucket is set up."
      );
      return;
    }
    const { data } = sb.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
    setUploading(false);
  }

  async function finish() {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    const res = await session.updateProfile({
      name: name.trim() || currentUser.name,
      avatarUrl: avatarUrl || undefined,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    markOnboarded(currentUser.id);
    router.replace("/dashboard?tour=1");
  }

  function skip() {
    if (!currentUser) return;
    markOnboarded(currentUser.id);
    router.replace("/dashboard?tour=1");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-soft">
            <Feather className="h-6 w-6" />
          </div>
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={
                  i === step
                    ? "h-1.5 w-6 rounded-full bg-primary"
                    : "h-1.5 w-6 rounded-full bg-border"
                }
              />
            ))}
          </div>
        </div>

        {step === 0 && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5 text-center">
                <h1 className="text-xl font-semibold tracking-tight">
                  Welcome to Advantage Portal, {firstName}.
                </h1>
                <p className="text-sm text-muted-foreground">
                  This is where the Advantage newsroom plans, writes, and ships
                  every story.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Your role
                </p>
                <p className="mt-0.5 text-sm font-medium capitalize">
                  {currentUser.role}
                </p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {ROLE_BLURB[currentUser.role]}
                </p>
              </div>

              <ul className="space-y-3">
                {HIGHLIGHTS.map((h) => (
                  <li key={h.title} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                      <h.icon className="h-4 w-4 text-foreground" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{h.title}</p>
                      <p className="text-xs leading-snug text-muted-foreground">
                        {h.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <Button className="w-full" onClick={() => setStep(1)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5 text-center">
                <h1 className="text-xl font-semibold tracking-tight">
                  Set up your profile
                </h1>
                <p className="text-sm text-muted-foreground">
                  This is how your teammates will see you.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-20 w-20">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
                  <AvatarFallback className="text-lg">
                    {initials(name || currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {avatarUrl ? "Change photo" : "Upload photo"}
                </Button>
                {uploadNote && (
                  <p className="max-w-xs text-center text-[11px] text-muted-foreground">
                    {uploadNote}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(0)}
                  disabled={busy}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={finish}
                  disabled={busy || uploading}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Finish setup
                </Button>
              </div>

              <button
                type="button"
                onClick={skip}
                disabled={busy}
                className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip for now
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
