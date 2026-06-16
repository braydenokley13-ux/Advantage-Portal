"use client";

/**
 * The Archive — a searchable, filterable database of every story the newsroom
 * has produced. Reads the store's already-hydrated collections, derives one
 * article per task (see lib/article-archive.ts), and scopes the set to what
 * the current user is allowed to see (same rule as the board & calendar).
 *
 * Clicking any article opens the existing TaskDrawer for the full reader /
 * editorial experience, so the archive stays a thin, fast browsing layer.
 */
import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Download,
  FileText,
  Filter,
  LayoutGrid,
  Library,
  List,
  Newspaper,
  Search,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, SkeletonCard } from "@/components/ui/states";
import { TaskDrawer } from "@/components/task/task-drawer";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { visibleTasks } from "@/lib/visibility";
import { STAGE_DEFINITIONS, STAGE_ORDER } from "@/lib/newsroom-stage";
import {
  archiveStats,
  articlesToCsv,
  buildArticleArchive,
  filterArticles,
  searchArticles,
  sortArticles,
  type ArchiveArticle,
  type ArticleFilter,
  type ArticleSort,
} from "@/lib/article-archive";
import { cn } from "@/lib/utils";
import type { StoryStage } from "@/lib/types";
import { format } from "date-fns";

const SORT_LABELS: Record<ArticleSort, string> = {
  newest: "Most recent",
  oldest: "Oldest first",
  title: "Title (A–Z)",
  words_desc: "Longest",
  words_asc: "Shortest",
  reading: "Longest read",
};

export default function ArchivePage() {
  const { user, role } = useRole();
  const {
    tasks,
    submissions,
    sections,
    issues,
    users,
    checklists,
    hydrated,
    hydrationError,
  } = useStore();

  const [query, setQuery] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [issueId, setIssueId] = useState("");
  const [stage, setStage] = useState<StoryStage | "">("");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [sort, setSort] = useState<ArticleSort>("newest");
  const [view, setView] = useState<"table" | "grid">("table");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Build the archive from only the tasks this user can see.
  const archive = useMemo(() => {
    const scoped = visibleTasks({ tasks, role, userId: user.id });
    return buildArticleArchive({
      tasks: scoped,
      submissions,
      sections,
      issues,
      users,
      checklists,
    });
  }, [tasks, submissions, sections, issues, users, checklists, role, user.id]);

  // Filter options reflect only what's actually present in the visible set.
  const sectionOptions = useDistinct(archive, (a) =>
    a.sectionId ? [a.sectionId, a.sectionName] : null
  );
  const authorOptions = useDistinct(archive, (a) => [a.authorId, a.authorName]);
  const issueOptions = useDistinct(archive, (a) =>
    a.issueId ? [a.issueId, a.issueName ?? a.issueId] : null
  );
  const stageOptions = useMemo(() => {
    const present = new Set(archive.map((a) => a.stage));
    return STAGE_ORDER.filter((s) => present.has(s));
  }, [archive]);

  const filter: ArticleFilter = useMemo(
    () => ({
      sectionId: sectionId || undefined,
      authorId: authorId || undefined,
      issueId: issueId || undefined,
      stage: stage || undefined,
      publishedOnly,
    }),
    [sectionId, authorId, issueId, stage, publishedOnly]
  );

  const results = useMemo(
    () => sortArticles(filterArticles(searchArticles(archive, query), filter), sort),
    [archive, query, filter, sort]
  );

  const stats = useMemo(() => archiveStats(results), [results]);

  const hasFilters =
    !!query || !!sectionId || !!authorId || !!issueId || !!stage || publishedOnly;

  function resetFilters() {
    setQuery("");
    setSectionId("");
    setAuthorId("");
    setIssueId("");
    setStage("");
    setPublishedOnly(false);
  }

  function exportCsv() {
    const csv = articlesToCsv(results);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `advantage-archive-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Archive"
        description="Every story you can access — search, filter, and revisit the newsroom's body of work."
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center rounded-md border border-border p-0.5">
              <ViewToggle
                active={view === "table"}
                onClick={() => setView("table")}
                icon={List}
                label="Table"
              />
              <ViewToggle
                active={view === "grid"}
                onClick={() => setView("grid")}
                icon={LayoutGrid}
                label="Grid"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={results.length === 0}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Articles" value={stats.total} icon={Library} />
        <StatCard
          label="Published"
          value={stats.published}
          icon={Newspaper}
          tone="positive"
          delta={`${stats.inProgress} in progress`}
        />
        <StatCard
          label="Words written"
          value={stats.totalWords.toLocaleString()}
          icon={FileText}
          delta={`${stats.sections} ${stats.sections === 1 ? "section" : "sections"}`}
        />
        <StatCard
          label="Total read time"
          value={formatMinutes(stats.totalReadingMinutes)}
          icon={Clock}
          delta={`${stats.authors} ${stats.authors === 1 ? "writer" : "writers"}`}
        />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, authors, sections…"
              className="pl-9"
              aria-label="Search the archive"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <FilterSelect
              value={sectionId}
              onChange={setSectionId}
              placeholder="All sections"
              options={sectionOptions}
            />
            <FilterSelect
              value={authorId}
              onChange={setAuthorId}
              placeholder="All writers"
              options={authorOptions}
            />
            {issueOptions.length > 0 && (
              <FilterSelect
                value={issueId}
                onChange={setIssueId}
                placeholder="All issues"
                options={issueOptions}
              />
            )}
            {stageOptions.length > 0 && (
              <Select
                value={stage}
                onChange={(e) => setStage(e.target.value as StoryStage | "")}
                className="w-auto min-w-[9rem]"
                aria-label="Filter by stage"
              >
                <option value="">All stages</option>
                {stageOptions.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_DEFINITIONS[s].label}
                  </option>
                ))}
              </Select>
            )}
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as ArticleSort)}
              className="w-auto min-w-[9rem]"
              aria-label="Sort articles"
            >
              {(Object.keys(SORT_LABELS) as ArticleSort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => setPublishedOnly((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 h-9 text-sm transition-colors",
                publishedOnly
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
              aria-pressed={publishedOnly}
            >
              <Newspaper className="h-3.5 w-3.5" /> Published only
            </button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {results.length} {results.length === 1 ? "article" : "articles"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {hydrationError ? (
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Couldn't load the archive"
            description={hydrationError}
          />
        </Card>
      ) : !hydrated ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={hasFilters ? "No articles match" : "The archive is empty"}
            description={
              hasFilters
                ? "Try broadening your search or clearing a filter."
                : "Stories will appear here as they're assigned and written."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : view === "table" ? (
        <ArticleTable articles={results} onOpen={setOpenTaskId} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((a) => (
            <ArticleCard key={a.taskId} article={a} onOpen={setOpenTaskId} />
          ))}
        </div>
      )}

      <TaskDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />
    </div>
  );
}

// ── Results: table ──────────────────────────────────────────────────────────
function ArticleTable({
  articles,
  onOpen,
}: {
  articles: ArchiveArticle[];
  onOpen: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Story</th>
              <th className="px-3 py-2.5 font-medium">Section</th>
              <th className="px-3 py-2.5 font-medium">Writer</th>
              <th className="px-3 py-2.5 font-medium">Issue</th>
              <th className="px-3 py-2.5 font-medium text-right">Words</th>
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {articles.map((a) => (
              <tr
                key={a.taskId}
                onClick={() => onOpen(a.taskId)}
                className="cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <td className="px-4 py-2.5 max-w-[22rem]">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{a.title}</p>
                    {a.hasSensitiveFlag && (
                      <ShieldAlert
                        className="h-3.5 w-3.5 text-red-600 shrink-0"
                        aria-label="Sensitive flag active"
                      />
                    )}
                  </div>
                  {a.excerpt && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {a.excerpt}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                  {a.sectionName}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                  {a.authorName}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                  {a.issueName ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {a.wordCount > 0 ? a.wordCount.toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Badge variant={STAGE_DEFINITIONS[a.stage].tone}>
                    {STAGE_DEFINITIONS[a.stage].label}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                  {format(new Date(a.updatedAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Results: grid ────────────────────────────────────────────────────────────
function ArticleCard({
  article: a,
  onOpen,
}: {
  article: ArchiveArticle;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(a.taskId)}
      className="text-left rounded-xl border border-border bg-card p-4 shadow-soft hover:bg-accent/40 transition-colors flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="capitalize">
          {a.sectionName}
        </Badge>
        <Badge variant={STAGE_DEFINITIONS[a.stage].tone}>
          {STAGE_DEFINITIONS[a.stage].label}
        </Badge>
      </div>
      <div className="flex items-start gap-2">
        <h3 className="font-semibold leading-snug line-clamp-2 flex-1">
          {a.title}
        </h3>
        {a.hasSensitiveFlag && (
          <ShieldAlert
            className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
            aria-label="Sensitive flag active"
          />
        )}
      </div>
      {a.excerpt && (
        <p className="text-xs text-muted-foreground line-clamp-3">{a.excerpt}</p>
      )}
      <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" /> {a.authorName}
        </span>
        {a.wordCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" /> {a.wordCount.toLocaleString()} words ·{" "}
            {a.readingMinutes} min
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {a.publishedAt
            ? `Ran ${format(new Date(a.publishedAt), "MMM d, yyyy")}`
            : format(new Date(a.updatedAt), "MMM d, yyyy")}
        </span>
      </div>
    </button>
  );
}

// ── Toolbar bits ─────────────────────────────────────────────────────────────
function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { id: string; name: string }[];
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-auto min-w-[9rem]"
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </Select>
  );
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${label} view`}
      className={cn(
        "inline-flex items-center justify-center rounded h-7 w-8 transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
/** Distinct [id, name] pairs present in the archive, sorted by name. */
function useDistinct(
  articles: ArchiveArticle[],
  pick: (a: ArchiveArticle) => [string, string] | null
): { id: string; name: string }[] {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const a of articles) {
      const pair = pick(a);
      if (pair) map.set(pair[0], pair[1]);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((x, y) => x.name.localeCompare(y.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles]);
}

function formatMinutes(total: number): string {
  if (total <= 0) return "0 min";
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
