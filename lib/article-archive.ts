/**
 * The Archive — a derived, queryable catalogue of every story the newsroom
 * has produced.
 *
 * An "article" is a `Task` viewed through the lens of its published body of
 * work: who wrote it, what section and issue it ran in, how long it is, and
 * where it sits on the publication conveyor belt. The shape mirrors the
 * `public.article_archive` SQL view (migrations/0015) so the same record can
 * be read either client-side from the store or directly from Postgres.
 *
 * Everything here is pure and dependency-light so it can be unit-tested and
 * reused by any analytics / export surface.
 */
import { deriveStoryStage } from "./newsroom-stage";
import { countWords, readingTimeMinutes } from "./word-count";
import type {
  EditorialChecklist,
  Issue,
  Section,
  StoryStage,
  Submission,
  SubmissionType,
  Task,
  TaskStatus,
  User,
} from "./types";

/** One row of the archive — a story plus its denormalised context. */
export interface ArchiveArticle {
  taskId: string;
  title: string;
  slug?: string;
  status: TaskStatus;
  /** Derived publication stage (pitch … published). */
  stage: StoryStage;
  sectionId?: string;
  sectionName: string;
  sectionAccent: string;
  authorId: string;
  authorName: string;
  editorId?: string;
  editorName?: string;
  issueId?: string;
  issueName?: string;
  issueNumber?: number;
  /** When the story ran, if its issue has been published. */
  publishedAt?: string;
  deadline: string;
  createdAt: string;
  /** Latest submission timestamp, falling back to the task's creation date. */
  updatedAt: string;
  /** Best-known length: logged actual, else counted from an inline draft. */
  wordCount: number;
  readingMinutes: number;
  citationsRequired: boolean;
  /** True while a sensitive flag is open or holding. */
  hasSensitiveFlag: boolean;
  currentSubmissionId?: string;
  submissionType?: SubmissionType;
  /** A short, plain-text teaser pulled from the latest inline draft. */
  excerpt: string;
}

export type ArticleSort =
  | "newest"
  | "oldest"
  | "title"
  | "words_desc"
  | "words_asc"
  | "reading";

export interface ArticleFilter {
  sectionId?: string;
  authorId?: string;
  issueId?: string;
  stage?: StoryStage;
  /** When true, only stories whose issue has shipped. */
  publishedOnly?: boolean;
}

export interface ArchiveStats {
  total: number;
  published: number;
  /** Stories not yet published (still moving through the pipeline). */
  inProgress: number;
  totalWords: number;
  totalReadingMinutes: number;
  /** Distinct sections represented in the set. */
  sections: number;
  /** Distinct authors represented in the set. */
  authors: number;
}

const UNSECTIONED = "Unsectioned";

/** Strip light markdown / collapse whitespace into a plain-text teaser. */
export function excerptFrom(text: string, max = 180): string {
  const plain = text
    .replace(/`{1,3}[^`]*`{1,3}/g, " ") // code spans / fences
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → label
    .replace(/[#>*_~|-]+/g, " ") // markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  // Cut on a word boundary so we don't slice a word in half.
  return `${plain.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/**
 * Build the archive from the store's collections. One article per task; the
 * "current" submission (or the highest version) supplies length and excerpt.
 */
export function buildArticleArchive(args: {
  tasks: Task[];
  submissions: Submission[];
  sections: Section[];
  issues: Issue[];
  users: User[];
  checklists?: EditorialChecklist[];
}): ArchiveArticle[] {
  const { tasks, submissions, sections, issues, users, checklists = [] } = args;

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const issueById = new Map(issues.map((i) => [i.id, i]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const checklistByTask = new Map(checklists.map((c) => [c.taskId, c]));

  // Group submissions by task once so per-article lookups are cheap.
  const subsByTask = new Map<string, Submission[]>();
  for (const s of submissions) {
    const arr = subsByTask.get(s.taskId) ?? [];
    arr.push(s);
    subsByTask.set(s.taskId, arr);
  }

  return tasks.map((task) => {
    const section = task.sectionId ? sectionById.get(task.sectionId) : undefined;
    const issue = task.issueId ? issueById.get(task.issueId) : undefined;
    const author = userById.get(task.writerId);
    const editor = task.editorId ? userById.get(task.editorId) : undefined;

    const taskSubs = subsByTask.get(task.id) ?? [];
    const current = pickCurrentSubmission(taskSubs, task.currentSubmissionId);
    const latest = taskSubs.reduce<Submission | undefined>(
      (acc, s) => (!acc || s.version > acc.version ? s : acc),
      undefined
    );

    const wordCount = resolveWordCount(task, current);
    const stage = deriveStoryStage({
      task,
      checklist: checklistByTask.get(task.id),
      issue,
    }).stage;

    const excerpt =
      current?.type === "inline" && current.content
        ? excerptFrom(current.content)
        : excerptFrom(task.instructions || "");

    return {
      taskId: task.id,
      title: task.title,
      slug: task.slug,
      status: task.status,
      stage,
      sectionId: task.sectionId,
      sectionName: section?.name ?? UNSECTIONED,
      sectionAccent: section?.accent ?? "slate",
      authorId: task.writerId,
      authorName: author?.name ?? "Unknown",
      editorId: task.editorId,
      editorName: editor?.name,
      issueId: task.issueId,
      issueName: issue?.name,
      issueNumber: issue?.number,
      publishedAt:
        issue?.status === "published" ? issue.publishDate : undefined,
      deadline: task.deadline,
      createdAt: task.createdAt,
      updatedAt: latest?.createdAt ?? task.createdAt,
      wordCount,
      readingMinutes: readingTimeMinutes(wordCount),
      citationsRequired: task.citationsRequired ?? false,
      hasSensitiveFlag:
        task.sensitive?.status === "open" ||
        task.sensitive?.status === "holding",
      currentSubmissionId: current?.id,
      submissionType: current?.type,
      excerpt,
    };
  });
}

/** The current submission, or the highest version as a fallback. */
function pickCurrentSubmission(
  subs: Submission[],
  currentId?: string
): Submission | undefined {
  if (currentId) {
    const match = subs.find((s) => s.id === currentId);
    if (match) return match;
  }
  return subs.reduce<Submission | undefined>(
    (acc, s) => {
      if (s.isCurrent) return s;
      if (!acc || s.version > acc.version) return s;
      return acc;
    },
    undefined
  );
}

/** Logged actual word count wins; otherwise count an inline draft. */
function resolveWordCount(task: Task, current?: Submission): number {
  if (typeof task.wordCountActual === "number" && task.wordCountActual > 0) {
    return task.wordCountActual;
  }
  if (current?.type === "inline" && current.content) {
    return countWords(current.content);
  }
  return 0;
}

/** Case-insensitive search across title, slug, author, section, and excerpt. */
export function searchArticles(
  articles: ArchiveArticle[],
  query: string
): ArchiveArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return articles;
  return articles.filter((a) =>
    [
      a.title,
      a.slug ?? "",
      a.authorName,
      a.editorName ?? "",
      a.sectionName,
      a.issueName ?? "",
      a.excerpt,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

export function filterArticles(
  articles: ArchiveArticle[],
  filter: ArticleFilter
): ArchiveArticle[] {
  return articles.filter((a) => {
    if (filter.sectionId && a.sectionId !== filter.sectionId) return false;
    if (filter.authorId && a.authorId !== filter.authorId) return false;
    if (filter.issueId && a.issueId !== filter.issueId) return false;
    if (filter.stage && a.stage !== filter.stage) return false;
    if (filter.publishedOnly && !a.publishedAt) return false;
    return true;
  });
}

export function sortArticles(
  articles: ArchiveArticle[],
  sort: ArticleSort
): ArchiveArticle[] {
  const copy = [...articles];
  const time = (s: string) => new Date(s).getTime();
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => time(a.updatedAt) - time(b.updatedAt));
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "words_desc":
      return copy.sort((a, b) => b.wordCount - a.wordCount);
    case "words_asc":
      return copy.sort((a, b) => a.wordCount - b.wordCount);
    case "reading":
      return copy.sort((a, b) => b.readingMinutes - a.readingMinutes);
    case "newest":
    default:
      return copy.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
  }
}

export function archiveStats(articles: ArchiveArticle[]): ArchiveStats {
  const sections = new Set<string>();
  const authors = new Set<string>();
  let totalWords = 0;
  let totalReadingMinutes = 0;
  let published = 0;

  for (const a of articles) {
    if (a.sectionId) sections.add(a.sectionId);
    authors.add(a.authorId);
    totalWords += a.wordCount;
    totalReadingMinutes += a.readingMinutes;
    if (a.publishedAt) published += 1;
  }

  return {
    total: articles.length,
    published,
    inProgress: articles.length - published,
    totalWords,
    totalReadingMinutes,
    sections: sections.size,
    authors: authors.size,
  };
}

const CSV_HEADERS = [
  "Title",
  "Slug",
  "Section",
  "Author",
  "Editor",
  "Issue",
  "Status",
  "Stage",
  "Words",
  "Reading (min)",
  "Deadline",
  "Published",
] as const;

/** Escape a single CSV field per RFC 4180 (quote when needed, double quotes). */
function csvField(value: string | number | undefined): string {
  const s = value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serialise the archive to a CSV document (header row + one row per article). */
export function articlesToCsv(articles: ArchiveArticle[]): string {
  const rows = articles.map((a) =>
    [
      a.title,
      a.slug ?? "",
      a.sectionName,
      a.authorName,
      a.editorName ?? "",
      a.issueName ?? "",
      a.status,
      a.stage,
      a.wordCount,
      a.readingMinutes,
      a.deadline,
      a.publishedAt ?? "",
    ]
      .map(csvField)
      .join(",")
  );
  return [CSV_HEADERS.join(","), ...rows].join("\r\n");
}
