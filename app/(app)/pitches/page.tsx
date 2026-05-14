"use client";

import { useMemo, useState } from "react";
import {
  Lightbulb,
  CheckCircle2,
  XCircle,
  Send,
  CornerUpRight,
  Inbox,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useStore } from "@/lib/store";
import { useApiClient } from "@/lib/api/provider";
import { useIssues, usePitches, useSections } from "@/lib/hooks";
import { useRole } from "@/lib/role-context";
import { initials } from "@/lib/utils";
import type { Pitch } from "@/lib/types";
import { format } from "date-fns";

const STATUS_TONE: Record<
  Pitch["status"],
  "default" | "secondary" | "warning" | "success" | "danger"
> = {
  submitted: "warning",
  accepted: "success",
  declined: "danger",
  converted: "default",
};

const STATUS_LABEL: Record<Pitch["status"], string> = {
  submitted: "Awaiting decision",
  accepted: "Accepted",
  declined: "Declined",
  converted: "Assigned",
};

export default function PitchesPage() {
  const { user, role } = useRole();
  // Source-of-truth reads via hooks (mock or supabase).
  const { data: sectionsData } = useSections();
  const { data: pitchesData, refetch: refetchPitches } = usePitches();
  const { data: issuesData } = useIssues();
  // Users + tasks stay on the store as a sync cache for cross-entity
  // lookups (writer names, pitch → task → issue resolution).
  const { users, tasks: tasksForLookup } = useStore();

  const sections = sectionsData ?? [];
  const pitches = pitchesData ?? [];
  const issues = issuesData ?? [];

  const isReviewer =
    role === "editor" || role === "leader" || role === "admin";
  const [tab, setTab] = useState<"submit" | "mine" | "queue">(
    isReviewer ? "queue" : "submit"
  );

  const myPitches = useMemo(
    () =>
      pitches
        .filter((p) => p.writerId === user.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [pitches, user.id]
  );

  const reviewQueue = useMemo(
    () =>
      pitches
        .filter((p) => p.status === "submitted")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [pitches]
  );

  const decided = useMemo(
    () => pitches.filter((p) => p.status !== "submitted"),
    [pitches]
  );

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Pitches"
        description={
          isReviewer
            ? "Decide what makes it onto the next issue. Accept, decline, or assign."
            : "Pitch a story. Editors will accept, decline, or convert your pitch into an assignment."
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {isReviewer && (
            <TabsTrigger value="queue">
              <Inbox className="h-3.5 w-3.5 mr-1.5" /> Queue
              {reviewQueue.length > 0 && (
                <span className="ml-1.5 text-[10px] rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5">
                  {reviewQueue.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="submit">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Submit a pitch
          </TabsTrigger>
          <TabsTrigger value="mine">
            <Lightbulb className="h-3.5 w-3.5 mr-1.5" /> My pitches
            {myPitches.length > 0 && (
              <span className="ml-1.5 text-[10px] rounded-full bg-secondary px-1.5 py-0.5">
                {myPitches.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {isReviewer && (
          <TabsContent value="queue" className="mt-4 space-y-4">
            {reviewQueue.length === 0 ? (
              <EmptyCard
                icon={Inbox}
                title="Inbox is clear"
                description="No pitches awaiting a decision right now."
              />
            ) : (
              reviewQueue.map((p) => (
                <PitchReviewCard
                  key={p.id}
                  pitch={p}
                  sections={sections}
                  issues={issues}
                  onChanged={refetchPitches}
                />
              ))
            )}

            {decided.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent decisions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {decided.slice(0, 8).map((p) => {
                      const sec = sections.find((s) => s.id === p.sectionId);
                      const writer = users.find((u) => u.id === p.writerId);
                      return (
                        <li key={p.id} className="px-4 py-3 flex items-center gap-3">
                          <Badge variant={STATUS_TONE[p.status]}>
                            {STATUS_LABEL[p.status]}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {p.proposedHeadline}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {sec?.name} · {writer?.name}
                              {p.editorNote ? ` · "${p.editorNote.slice(0, 60)}"` : ""}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="submit" className="mt-4">
          <PitchForm sections={sections} onSubmitted={refetchPitches} />
        </TabsContent>

        <TabsContent value="mine" className="mt-4 space-y-3">
          {myPitches.length === 0 ? (
            <EmptyCard
              icon={Lightbulb}
              title="No pitches yet"
              description="Submit a pitch and it'll show up here once an editor sees it."
            />
          ) : (
            myPitches.map((p) => {
              const sec = sections.find((s) => s.id === p.sectionId);
              // Pitches don't carry an `issueId` directly — they carry the
              // converted task id once accepted. Resolve issue via that
              // task so the My-pitches card shows the right edition.
              const issue = p.taskId
                ? (() => {
                    const t = tasksForLookup.find((x) => x.id === p.taskId);
                    return t?.issueId
                      ? issues.find((i) => i.id === t.issueId)
                      : undefined;
                  })()
                : undefined;
              return (
                <Card key={p.id}>
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {p.proposedHeadline}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {sec?.name} · submitted{" "}
                        {format(new Date(p.createdAt), "MMM d")}
                        {issue ? ` · ${issue.name}` : ""}
                      </p>
                    </div>
                    <Badge variant={STATUS_TONE[p.status]}>
                      {STATUS_LABEL[p.status]}
                    </Badge>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-2 text-sm">
                    <p className="text-foreground">{p.angle}</p>
                    {p.editorNote && (
                      <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
                        <p className="font-medium text-foreground mb-0.5">
                          Editor note
                        </p>
                        <p>{p.editorNote}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PitchForm({
  sections,
  onSubmitted,
}: {
  sections: { id: string; name: string }[];
  onSubmitted: () => void;
}) {
  const api = useApiClient();
  const { user } = useRole();

  const [headline, setHeadline] = useState("");
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [angle, setAngle] = useState("");
  const [whyNow, setWhyNow] = useState("");
  const [sources, setSources] = useState("");
  const [wordCount, setWordCount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    headline.trim().length > 6 &&
    angle.trim().length > 6 &&
    whyNow.trim().length >= 8 &&
    sectionId.length > 0;

  const todayIso = new Date().toISOString().slice(0, 10);

  async function handleSubmit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.createPitch({
        proposedHeadline: headline.trim(),
        sectionId,
        angle: angle.trim(),
        whyNow: whyNow.trim(),
        proposedSources: sources
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        expectedWordCount: wordCount
          ? Math.max(1, Number(wordCount))
          : undefined,
        deadlinePref: deadline ? new Date(deadline).toISOString() : undefined,
        writerNote: note.trim() || undefined,
        writerId: user.id,
      });
      onSubmitted();
      setSubmitted(true);
      setHeadline("");
      setAngle("");
      setWhyNow("");
      setSources("");
      setWordCount("");
      setDeadline("");
      setNote("");
      setTimeout(() => setSubmitted(false), 2400);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't send that pitch. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pitch a story</CardTitle>
        <p className="text-xs text-muted-foreground">
          Strong pitches name the story, the angle, and why now. The more
          honest you are about sources, the easier the editor's job.
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="p-headline">Proposed headline</Label>
          <Input
            id="p-headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="The story in one sentence"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Section</Label>
            <Select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-words">
              Expected word count{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="p-words"
              type="number"
              min={1}
              step={50}
              value={wordCount}
              onChange={(e) => setWordCount(e.target.value)}
              placeholder="e.g. 1200"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-angle">Angle / thesis</Label>
          <Textarea
            id="p-angle"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="What is this story actually about? One or two sentences."
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-why">Why now?</Label>
          <Textarea
            id="p-why"
            value={whyNow}
            onChange={(e) => setWhyNow(e.target.value)}
            placeholder="What is the peg? What changed this week or month?"
            className="min-h-[60px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-sources">Proposed sources (one per line)</Label>
          <Textarea
            id="p-sources"
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            placeholder={"Two named teachers\nDistrict policy doc\nFederal data set"}
            className="min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-deadline">
              Preferred deadline{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="p-deadline"
              type="date"
              min={todayIso}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-note">
              Note to editor{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="p-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else they should know?"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-[11px] text-muted-foreground">
            Editors decide together. You'll get a notification when there's
            news on this pitch.
          </p>
          <Button
            variant="gradient"
            disabled={!valid || busy}
            onClick={handleSubmit}
          >
            <Send className="h-4 w-4" /> {busy ? "Sending…" : "Submit pitch"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {submitted && (
          <p className="text-xs text-emerald-700">
            Pitch sent to the editor queue. You'll see it in &ldquo;My pitches.&rdquo;
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PitchReviewCard({
  pitch,
  sections,
  issues,
  onChanged,
}: {
  pitch: Pitch;
  sections: { id: string; name: string }[];
  issues: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const api = useApiClient();
  const { users } = useStore();
  const { user, role } = useRole();
  const sec = sections.find((s) => s.id === pitch.sectionId);
  const writer = users.find((u) => u.id === pitch.writerId);
  const editors = users.filter(
    (u) => u.role === "editor" && u.active !== false
  );

  const [note, setNote] = useState("");
  const [showConvert, setShowConvert] = useState(false);
  const [editorId, setEditorId] = useState(editors[0]?.id ?? "");
  const [issueId, setIssueId] = useState<string>("");
  const [deadline, setDeadline] = useState<string>(() => {
    const d = pitch.deadlinePref ? new Date(pitch.deadlinePref) : new Date();
    if (!pitch.deadlinePref) d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(accept: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.decidePitch({
        pitchId: pitch.id,
        decidedById: user.id,
        accept,
        note: note.trim() || undefined,
      });
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't save that decision. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.convertPitch({
        pitchId: pitch.id,
        editorId: editorId || undefined,
        deadline: new Date(`${deadline}T17:00:00`).toISOString(),
        leaderId: user.id,
        issueId: issueId || undefined,
      });
      setShowConvert(false);
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't convert this pitch. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const canDecide =
    role === "editor" || role === "leader" || role === "admin";
  const canConvert = role === "leader" || role === "admin";

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base truncate">
            {pitch.proposedHeadline}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{sec?.name ?? "Unsectioned"}</Badge>
            {writer && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px]">
                    {initials(writer.name)}
                  </AvatarFallback>
                </Avatar>
                {writer.name}
              </span>
            )}
            <span>· submitted {format(new Date(pitch.createdAt), "MMM d")}</span>
            {pitch.expectedWordCount && (
              <span>· ~{pitch.expectedWordCount.toLocaleString()} words</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Angle
          </p>
          <p>{pitch.angle}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Why now
          </p>
          <p>{pitch.whyNow}</p>
        </div>
        {pitch.proposedSources.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Proposed sources
            </p>
            <ul className="list-disc pl-5 text-xs space-y-0.5">
              {pitch.proposedSources.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {pitch.writerNote && (
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
            <p className="font-medium text-foreground mb-0.5">Writer note</p>
            <p>{pitch.writerNote}</p>
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          {canDecide ? (
            <>
              <Textarea
                placeholder="Optional note for the writer (will be shared on accept/decline)."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[60px]"
                disabled={busy}
              />
              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => decide(true)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  <XCircle className="h-3.5 w-3.5" /> Decline
                </Button>
                {canConvert && (
                  <Button
                    variant="gradient"
                    size="sm"
                    disabled={busy}
                    onClick={() => setShowConvert((v) => !v)}
                  >
                    <CornerUpRight className="h-3.5 w-3.5" /> Convert to assignment
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only editors, leaders, and admins can decide on pitches.
            </p>
          )}

          {canConvert && showConvert && (
            <div className="rounded-lg border border-border bg-card p-3 grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Editor</Label>
                <Select
                  value={editorId}
                  onChange={(e) => setEditorId(e.target.value)}
                >
                  <option value="">No editor</option>
                  {editors.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Issue</Label>
                <Select
                  value={issueId}
                  onChange={(e) => setIssueId(e.target.value)}
                >
                  <option value="">No issue yet</option>
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Deadline</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <Button
                  variant="gradient"
                  size="sm"
                  disabled={!deadline || busy}
                  onClick={convert}
                >
                  Create assignment
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-10 flex flex-col items-center text-center">
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </CardContent>
    </Card>
  );
}
