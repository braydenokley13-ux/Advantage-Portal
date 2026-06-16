import { describe, expect, it } from "vitest";
import {
  archiveStats,
  articlesToCsv,
  buildArticleArchive,
  excerptFrom,
  filterArticles,
  searchArticles,
  sortArticles,
} from "./article-archive";
import { makeTask, makeUser } from "./test-fixtures";
import type { Issue, Section, Submission } from "./types";

const writer = makeUser({ id: "writer-1", name: "Ada Reporter", role: "writer" });
const editor = makeUser({ id: "editor-1", name: "Ben Editor", role: "editor" });

const sections: Section[] = [
  { id: "sec-news", slug: "news", name: "News", description: "", accent: "sky" },
  {
    id: "sec-opinion",
    slug: "opinion",
    name: "Opinion",
    description: "",
    accent: "amber",
  },
];

const publishedIssue: Issue = {
  id: "iss-1",
  number: 42,
  name: "Issue #42 — Spring",
  publishDate: "2026-04-01T00:00:00.000Z",
  status: "published",
};

function inlineSub(overrides: Partial<Submission> & { taskId: string }): Submission {
  return {
    id: overrides.id ?? `sub-${overrides.taskId}`,
    taskId: overrides.taskId,
    type: overrides.type ?? "inline",
    version: overrides.version ?? 1,
    content: overrides.content ?? "",
    createdAt: overrides.createdAt ?? "2026-03-01T00:00:00.000Z",
    isCurrent: overrides.isCurrent ?? true,
    file: overrides.file,
  };
}

describe("excerptFrom", () => {
  it("strips markdown and collapses whitespace", () => {
    expect(excerptFrom("# Heading\n\n**Bold** and [a link](http://x)")).toBe(
      "Heading Bold and a link"
    );
  });

  it("truncates on a word boundary with an ellipsis", () => {
    const out = excerptFrom("one two three four five", 11);
    expect(out).toBe("one two…");
    expect(out.length).toBeLessThanOrEqual(12);
  });
});

describe("buildArticleArchive", () => {
  it("joins section, issue, author, and editor context", () => {
    const task = makeTask({
      id: "t1",
      title: "City budget passes",
      writerId: "writer-1",
      editorId: "editor-1",
      sectionId: "sec-news",
      issueId: "iss-1",
      status: "complete",
    });
    const [article] = buildArticleArchive({
      tasks: [task],
      submissions: [],
      sections,
      issues: [publishedIssue],
      users: [writer, editor],
    });
    expect(article).toMatchObject({
      taskId: "t1",
      title: "City budget passes",
      sectionName: "News",
      authorName: "Ada Reporter",
      editorName: "Ben Editor",
      issueName: "Issue #42 — Spring",
      issueNumber: 42,
      publishedAt: "2026-04-01T00:00:00.000Z",
    });
  });

  it("counts words from the current inline draft and derives reading time", () => {
    const task = makeTask({ id: "t2", currentSubmissionId: "sub-t2" });
    const content = Array.from({ length: 400 }, () => "word").join(" ");
    const [article] = buildArticleArchive({
      tasks: [task],
      submissions: [inlineSub({ id: "sub-t2", taskId: "t2", content })],
      sections,
      issues: [],
      users: [writer],
    });
    expect(article.wordCount).toBe(400);
    expect(article.readingMinutes).toBe(2); // 400 / 200 wpm
    expect(article.submissionType).toBe("inline");
  });

  it("prefers the logged actual word count over the inline count", () => {
    const task = makeTask({
      id: "t3",
      currentSubmissionId: "sub-t3",
      wordCountActual: 950,
    });
    const [article] = buildArticleArchive({
      tasks: [task],
      submissions: [inlineSub({ id: "sub-t3", taskId: "t3", content: "a b c" })],
      sections,
      issues: [],
      users: [writer],
    });
    expect(article.wordCount).toBe(950);
  });

  it("falls back to instructions for the excerpt when not inline", () => {
    const task = makeTask({
      id: "t4",
      instructions: "Cover the spring concert in detail.",
      currentSubmissionId: "sub-t4",
    });
    const [article] = buildArticleArchive({
      tasks: [task],
      submissions: [
        inlineSub({
          id: "sub-t4",
          taskId: "t4",
          type: "google_doc",
          content: "https://docs.google.com/document/d/abc/edit",
        }),
      ],
      sections,
      issues: [],
      users: [writer],
    });
    expect(article.excerpt).toBe("Cover the spring concert in detail.");
    expect(article.wordCount).toBe(0);
  });

  it("marks an active sensitive flag", () => {
    const task = makeTask({
      id: "t5",
      sensitive: {
        id: "f1",
        taskId: "t5",
        reason: "allegations",
        notes: "n",
        status: "holding",
        raisedById: "editor-1",
        raisedAt: "2026-03-01T00:00:00.000Z",
      },
    });
    const [article] = buildArticleArchive({
      tasks: [task],
      submissions: [],
      sections,
      issues: [],
      users: [writer],
    });
    expect(article.hasSensitiveFlag).toBe(true);
  });

  it("falls back gracefully for unsectioned / unknown author tasks", () => {
    const task = makeTask({ id: "t6", writerId: "ghost" });
    const [article] = buildArticleArchive({
      tasks: [task],
      submissions: [],
      sections,
      issues: [],
      users: [],
    });
    expect(article.sectionName).toBe("Unsectioned");
    expect(article.authorName).toBe("Unknown");
  });
});

describe("searchArticles / filterArticles", () => {
  const base = buildArticleArchive({
    tasks: [
      makeTask({ id: "a", title: "Market rally", sectionId: "sec-news", writerId: "writer-1", issueId: "iss-1", status: "complete" }),
      makeTask({ id: "b", title: "Op-ed: school lunches", sectionId: "sec-opinion", writerId: "editor-1" }),
    ],
    submissions: [],
    sections,
    issues: [publishedIssue],
    users: [writer, editor],
  });

  it("searches across title, author, and section", () => {
    expect(searchArticles(base, "rally").map((a) => a.taskId)).toEqual(["a"]);
    expect(searchArticles(base, "ben").map((a) => a.taskId)).toEqual(["b"]);
    expect(searchArticles(base, "opinion").map((a) => a.taskId)).toEqual(["b"]);
    expect(searchArticles(base, "").length).toBe(2);
  });

  it("filters by section, author, and published-only", () => {
    expect(filterArticles(base, { sectionId: "sec-opinion" }).map((a) => a.taskId)).toEqual(["b"]);
    expect(filterArticles(base, { authorId: "writer-1" }).map((a) => a.taskId)).toEqual(["a"]);
    expect(filterArticles(base, { publishedOnly: true }).map((a) => a.taskId)).toEqual(["a"]);
  });
});

describe("sortArticles", () => {
  const articles = buildArticleArchive({
    tasks: [
      makeTask({ id: "x", title: "Zebra", currentSubmissionId: "s-x" }),
      makeTask({ id: "y", title: "Alpha", currentSubmissionId: "s-y" }),
    ],
    submissions: [
      inlineSub({ id: "s-x", taskId: "x", content: "one two three", createdAt: "2026-01-01T00:00:00.000Z" }),
      inlineSub({ id: "s-y", taskId: "y", content: "one", createdAt: "2026-02-01T00:00:00.000Z" }),
    ],
    sections,
    issues: [],
    users: [writer],
  });

  it("sorts by title and by word count", () => {
    expect(sortArticles(articles, "title").map((a) => a.title)).toEqual(["Alpha", "Zebra"]);
    expect(sortArticles(articles, "words_desc").map((a) => a.taskId)).toEqual(["x", "y"]);
    expect(sortArticles(articles, "words_asc").map((a) => a.taskId)).toEqual(["y", "x"]);
  });

  it("sorts by recency without mutating the input", () => {
    const before = articles.map((a) => a.taskId);
    expect(sortArticles(articles, "newest").map((a) => a.taskId)).toEqual(["y", "x"]);
    expect(sortArticles(articles, "oldest").map((a) => a.taskId)).toEqual(["x", "y"]);
    expect(articles.map((a) => a.taskId)).toEqual(before);
  });
});

describe("archiveStats", () => {
  it("aggregates totals, distinct sections, and published count", () => {
    const articles = buildArticleArchive({
      tasks: [
        makeTask({ id: "a", sectionId: "sec-news", writerId: "writer-1", issueId: "iss-1", currentSubmissionId: "s-a", status: "complete" }),
        makeTask({ id: "b", sectionId: "sec-news", writerId: "editor-1", currentSubmissionId: "s-b" }),
      ],
      submissions: [
        inlineSub({ id: "s-a", taskId: "a", content: "one two three four" }),
        inlineSub({ id: "s-b", taskId: "b", content: "one two" }),
      ],
      sections,
      issues: [publishedIssue],
      users: [writer, editor],
    });
    const stats = archiveStats(articles);
    expect(stats.total).toBe(2);
    expect(stats.published).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.totalWords).toBe(6);
    expect(stats.sections).toBe(1);
    expect(stats.authors).toBe(2);
  });
});

describe("articlesToCsv", () => {
  it("emits a header plus escaped rows", () => {
    const articles = buildArticleArchive({
      tasks: [makeTask({ id: "a", title: 'Quote "war", comma', writerId: "writer-1" })],
      submissions: [],
      sections,
      issues: [],
      users: [writer],
    });
    const csv = articlesToCsv(articles);
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("Title,Slug,Section");
    expect(lines[1]).toContain('"Quote ""war"", comma"');
  });
});
