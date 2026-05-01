import type {
  AssignmentBrief,
  Conversation,
  EditorialChecklist,
  Issue,
  IssueSlot,
  Message,
  Notification,
  Pitch,
  Section,
  SensitiveFlag,
  Submission,
  Task,
  User,
} from "./types";

export const users: User[] = [
  { id: "u1", name: "Alex Rivera", email: "alex@advantage.co", role: "writer" },
  { id: "u2", name: "Sam Patel", email: "sam@advantage.co", role: "writer" },
  { id: "u3", name: "Jordan Kim", email: "jordan@advantage.co", role: "writer" },
  { id: "u4", name: "Casey Lee", email: "casey@advantage.co", role: "editor" },
  { id: "u5", name: "Morgan Chen", email: "morgan@advantage.co", role: "editor" },
  { id: "u6", name: "Riley Brooks", email: "riley@advantage.co", role: "leader" },
  { id: "u7", name: "Taylor Singh", email: "taylor@advantage.co", role: "admin" },
];

const today = new Date();
const inDays = (n: number) =>
  new Date(today.getTime() + n * 86400000).toISOString();
const daysAgo = (n: number) =>
  new Date(today.getTime() - n * 86400000).toISOString();

// ── Sections ───────────────────────────────────────────────────────────────
export const sections: Section[] = [
  {
    id: "sec-news",
    slug: "news",
    name: "News",
    description: "Reporting on school, local, and national stories that affect students.",
    accent: "sky",
  },
  {
    id: "sec-opinion",
    slug: "opinion",
    name: "Opinion",
    description: "Clearly-labeled commentary, op-eds, and editorials.",
    accent: "violet",
  },
  {
    id: "sec-business",
    slug: "business",
    name: "Business",
    description: "Companies, founders, and the economics behind student life.",
    accent: "emerald",
  },
  {
    id: "sec-markets",
    slug: "markets",
    name: "Markets & Finance",
    description: "Markets explained for teen readers — never investment advice.",
    accent: "amber",
  },
  {
    id: "sec-community",
    slug: "community",
    name: "Community",
    description: "School clubs, events, and people doing things worth covering.",
    accent: "rose",
  },
  {
    id: "sec-culture",
    slug: "culture",
    name: "Culture",
    description: "Books, music, film, internet, and the way teens are living.",
    accent: "fuchsia",
  },
  {
    id: "sec-world",
    slug: "world",
    name: "World",
    description: "International news framed for student readers.",
    accent: "indigo",
  },
];

// ── Issues ─────────────────────────────────────────────────────────────────
export const issues: Issue[] = [
  {
    id: "iss-42",
    number: 42,
    name: "Issue #42 — Spring Forward",
    publishDate: inDays(6),
    status: "production",
    notes: "Cover: spring sports kickoff. Hold one Markets slot.",
  },
  {
    id: "iss-43",
    number: 43,
    name: "Issue #43 — Year-End Review",
    publishDate: inDays(27),
    status: "planning",
    notes: "Year-in-review angles. Encourage long-form features.",
  },
];

// ── Briefs (reused below) ──────────────────────────────────────────────────
const marketBrief: AssignmentBrief = {
  angle:
    "After a volatile quarter, where do major sectors actually stand for student readers?",
  mustAnswer: [
    "Which sectors moved the most this quarter and why?",
    "What does this mean for students saving for college or a first job?",
    "Where are the loudest analyst disagreements?",
  ],
  requiredSources: [
    "Two cited primary data sources (FRED, SEC filings, exchange data).",
    "One named analyst or economist quote.",
  ],
  quoteRequirements: "At least one on-the-record quote from a named analyst.",
  visualNeeds: "One chart of sector returns; pull quote from analyst.",
  publishingNotes: "House style on numbers — spell out percentages on first use.",
};

const profileBrief: AssignmentBrief = {
  angle:
    "How a high-school senior turned a side project into a real business — and what other students can learn.",
  mustAnswer: [
    "What did the founding moment actually look like?",
    "What's the first thing she'd tell another student trying to start a company?",
    "What is the business doing today, with verifiable numbers?",
  ],
  requiredSources: [
    "Two interviews with the founder (recorded).",
    "One interview with an early customer or teammate.",
  ],
  quoteRequirements: "Three on-the-record quotes minimum, named.",
  visualNeeds: "Portrait photo with permission; product screenshot if relevant.",
  publishingNotes: "Long-form feature; aim for 1,800–2,200 words.",
};

const opEdBrief: AssignmentBrief = {
  angle:
    "Why student journalists should be in the room when AI policy gets written.",
  mustAnswer: [
    "What is the policy actually proposing?",
    "Who benefits and who is left out?",
    "What's the writer's stance, and what's the strongest counterargument?",
  ],
  requiredSources: [
    "Cite the bill / policy text directly.",
    "One linked source for any factual claim.",
  ],
  quoteRequirements: "Quotes optional; if used, must be on-the-record.",
  visualNeeds: "Optional. Pull quote recommended.",
  publishingNotes: "Mark clearly as Opinion at top of piece.",
};

// ── Tasks (stories) ────────────────────────────────────────────────────────
export const tasks: Task[] = [
  {
    id: "t1",
    title: "Quarterly market outlook",
    instructions:
      "1500–2000 words. Lead with macro thesis, then sector breakdowns. Cite primary sources.",
    writerId: "u1",
    editorId: "u4",
    deadline: inDays(2),
    status: "in_progress",
    color: "amber",
    createdAt: daysAgo(3),
    wordCountTarget: 1800,
    citationsRequired: true,
    sectionId: "sec-markets",
    issueId: "iss-42",
    copyEditorId: "u5",
    factCheckerId: "u4",
    slug: "quarterly-market-outlook",
    brief: marketBrief,
  },
  {
    id: "t2",
    title: "Founder profile: Lina Wei",
    instructions:
      "Long-form profile. Conduct 2 interviews. Capture the founding-moment narrative.",
    writerId: "u2",
    editorId: "u4",
    deadline: inDays(5),
    status: "not_started",
    color: "green",
    createdAt: daysAgo(1),
    sectionId: "sec-business",
    issueId: "iss-42",
    slug: "founder-profile-lina-wei",
    brief: profileBrief,
    wordCountTarget: 2000,
  },
  {
    id: "t3",
    title: "Weekly digest — Issue #42",
    instructions: "Curate top 8 stories. 200-word intro. 80-word blurbs each.",
    writerId: "u3",
    editorId: "u5",
    deadline: inDays(1),
    status: "submitted",
    color: "amber",
    currentSubmissionId: "s1",
    createdAt: daysAgo(4),
    sectionId: "sec-news",
    issueId: "iss-42",
    slug: "weekly-digest-42",
    wordCountTarget: 900,
    wordCountActual: 920,
  },
  {
    id: "t4",
    title: "Op-ed: AI policy at the Hill",
    instructions: "Strong stance. 900 words. House style.",
    writerId: "u1",
    editorId: "u5",
    deadline: inDays(-1),
    status: "submitted",
    color: "red",
    currentSubmissionId: "s2",
    createdAt: daysAgo(6),
    sectionId: "sec-opinion",
    issueId: "iss-42",
    slug: "ai-policy-at-the-hill",
    brief: opEdBrief,
    wordCountTarget: 900,
    wordCountActual: 940,
    sensitive: {
      id: "sf1",
      taskId: "t4",
      reason: "politics",
      notes:
        "Strong stance on a contested policy. Wants a leader read before publication.",
      status: "open",
      raisedById: "u5",
      raisedAt: daysAgo(1),
    },
  },
  {
    id: "t5",
    title: "Book review: 'The New Map'",
    instructions: "Critical review, 700 words.",
    writerId: "u2",
    editorId: "u4",
    deadline: inDays(7),
    status: "complete",
    color: "green",
    currentSubmissionId: "s3",
    createdAt: daysAgo(10),
    sectionId: "sec-culture",
    slug: "book-review-the-new-map",
    wordCountTarget: 700,
    wordCountActual: 715,
  },
  {
    id: "t6",
    title: "Interview prep: Senator Ortiz",
    instructions: "20 questions. Background brief. House style.",
    writerId: "u3",
    editorId: "u5",
    deadline: inDays(4),
    status: "not_started",
    color: "green",
    createdAt: daysAgo(0),
    wordCountTarget: 600,
    sectionId: "sec-news",
    issueId: "iss-43",
    slug: "interview-prep-ortiz",
  },
  {
    id: "t7",
    title: "Newsroom guidelines refresh",
    instructions: "Compile feedback from last quarter. Draft v2.",
    writerId: "u1",
    deadline: inDays(10),
    status: "in_progress",
    color: "green",
    createdAt: daysAgo(2),
  },
];

// ── Issue slots ────────────────────────────────────────────────────────────
export const issueSlots: IssueSlot[] = [
  { id: "slot1", issueId: "iss-42", taskId: "t1", priority: "must_run" },
  { id: "slot2", issueId: "iss-42", taskId: "t3", priority: "must_run" },
  { id: "slot3", issueId: "iss-42", taskId: "t4", priority: "nice_to_run" },
  { id: "slot4", issueId: "iss-42", taskId: "t2", priority: "nice_to_run" },
  { id: "slot5", issueId: "iss-43", taskId: "t6", priority: "must_run" },
];

// ── Pitches ────────────────────────────────────────────────────────────────
export const pitches: Pitch[] = [
  {
    id: "p1",
    proposedHeadline: "Inside the school's quiet AI grading pilot",
    sectionId: "sec-news",
    angle:
      "Two teachers are using an LLM to triage essay drafts. Students didn't know.",
    whyNow:
      "Pilot quietly expanded last week — first time it's touched required coursework.",
    proposedSources: [
      "Two of the teachers running the pilot",
      "Three students whose work was graded",
      "District policy doc on AI in classrooms",
    ],
    expectedWordCount: 1200,
    deadlinePref: inDays(8),
    writerNote: "I have one teacher already willing to talk on the record.",
    writerId: "u2",
    status: "submitted",
    createdAt: daysAgo(1),
  },
  {
    id: "p2",
    proposedHeadline: "Why the cafeteria meal-plan price jumped 14%",
    sectionId: "sec-business",
    angle:
      "Track the procurement contract change that hit families this term.",
    whyNow: "Bill goes into effect next month.",
    proposedSources: [
      "District procurement filings",
      "PTA board members",
      "Two named families",
    ],
    expectedWordCount: 900,
    deadlinePref: inDays(11),
    writerId: "u1",
    status: "submitted",
    createdAt: daysAgo(2),
  },
  {
    id: "p3",
    proposedHeadline: "Markets explainer: what 'inverted yield curve' means for your first job",
    sectionId: "sec-markets",
    angle:
      "Make a scary-sounding macro signal concrete for a teen reader.",
    whyNow: "Curve un-inverted last week — first time in 18 months.",
    proposedSources: [
      "FRED data",
      "Quote from one named economist",
    ],
    expectedWordCount: 800,
    writerId: "u3",
    status: "accepted",
    editorNote: "Great hook. Keep it under 800 and avoid investment advice phrasing.",
    decidedById: "u4",
    decidedAt: daysAgo(0),
    createdAt: daysAgo(3),
  },
  {
    id: "p4",
    proposedHeadline: "Op-ed: bring back the school newspaper print run",
    sectionId: "sec-opinion",
    angle: "Argue the case for a quarterly print edition alongside the site.",
    whyNow: "Budget meeting next week.",
    proposedSources: ["Last year's circulation numbers"],
    expectedWordCount: 700,
    writerId: "u1",
    status: "declined",
    editorNote:
      "Strong voice but argument is thin without cost data. Re-pitch with numbers.",
    decidedById: "u5",
    decidedAt: daysAgo(1),
    createdAt: daysAgo(5),
  },
  {
    id: "p5",
    proposedHeadline: "Robotics team's nationals run, in their own words",
    sectionId: "sec-community",
    angle: "Oral history of the season told by five team members.",
    whyNow: "Nationals start in three weeks.",
    proposedSources: ["Five team members", "Coach"],
    expectedWordCount: 1500,
    writerId: "u3",
    status: "submitted",
    createdAt: daysAgo(0),
  },
  {
    id: "p6",
    proposedHeadline: "Every senior film of the year, ranked",
    sectionId: "sec-culture",
    angle: "Light, fun ranking of the senior thesis films, with clips.",
    whyNow: "Festival is next month.",
    proposedSources: ["Festival program", "Two film teachers"],
    expectedWordCount: 1100,
    writerId: "u2",
    status: "submitted",
    createdAt: daysAgo(0),
  },
  {
    id: "p7",
    proposedHeadline: "The week the dollar story changed",
    sectionId: "sec-world",
    angle:
      "What's actually behind the recent dollar moves and why teen savers should notice.",
    whyNow: "FX desks called it 'the most important week in months'.",
    proposedSources: [
      "Bank policy statements",
      "Two named economists",
    ],
    expectedWordCount: 1000,
    writerId: "u1",
    status: "submitted",
    createdAt: daysAgo(0),
  },
];

// ── Editorial checklists (per-task) ────────────────────────────────────────

/** Default item set seeded for any newsroom story. */
export function defaultChecklistItems(args: {
  isBusiness: boolean;
  isSensitive: boolean;
}) {
  const { isBusiness, isSensitive } = args;
  const general = [
    { key: "g_headline", label: "Headline is accurate", group: "general", required: true },
    { key: "g_lede", label: "Lede is clear and specific", group: "general", required: true },
    { key: "g_claims", label: "Claims are supported by sources", group: "general", required: true },
    { key: "g_sources", label: "Sources are linked or named", group: "general", required: true },
    { key: "g_quotes", label: "Quotes are attributed", group: "general", required: true },
    { key: "g_opinion", label: "Opinion is clearly labeled (if applicable)", group: "general", required: false },
    { key: "g_grammar", label: "Grammar / copy pass complete", group: "general", required: true },
    { key: "g_final", label: "Ready for final approval", group: "general", required: true },
  ] as const;
  const business = [
    { key: "b_finance_sources", label: "Financial claims have sources", group: "business", required: true },
    { key: "b_market_date", label: "Market data date is stated", group: "business", required: true },
    { key: "b_no_advice", label: "No investment-advice language", group: "business", required: true },
    { key: "b_terms", label: "Terms are explained for teen readers", group: "business", required: true },
  ] as const;
  const sensitive = [
    { key: "s_privacy", label: "Privacy risk reviewed", group: "sensitive", required: true },
    { key: "s_escalation", label: "Admin / leader escalation completed", group: "sensitive", required: true },
    { key: "s_language", label: "Language is fair and precise", group: "sensitive", required: true },
    { key: "s_second_editor", label: "A second editor reviewed", group: "sensitive", required: true },
  ] as const;

  const items: import("./types").ChecklistItem[] = [
    ...general.map((i) => ({ ...i, checked: false }) as import("./types").ChecklistItem),
  ];
  if (isBusiness)
    items.push(
      ...business.map((i) => ({ ...i, checked: false }) as import("./types").ChecklistItem)
    );
  if (isSensitive)
    items.push(
      ...sensitive.map((i) => ({ ...i, checked: false }) as import("./types").ChecklistItem)
    );
  return items;
}

export const checklists: EditorialChecklist[] = [
  {
    taskId: "t1",
    items: (() => {
      const items = defaultChecklistItems({ isBusiness: true, isSensitive: false });
      // Pre-mark a couple to demo progress
      for (const k of ["g_lede", "b_market_date"]) {
        const i = items.find((x) => x.key === k);
        if (i) {
          i.checked = true;
          i.checkedById = "u4";
          i.checkedAt = daysAgo(0);
        }
      }
      return items;
    })(),
    updatedAt: daysAgo(0),
  },
  {
    taskId: "t3",
    items: (() => {
      const items = defaultChecklistItems({ isBusiness: false, isSensitive: false });
      for (const k of ["g_headline", "g_lede", "g_claims", "g_sources"]) {
        const i = items.find((x) => x.key === k);
        if (i) {
          i.checked = true;
          i.checkedById = "u5";
          i.checkedAt = daysAgo(0);
        }
      }
      return items;
    })(),
    updatedAt: daysAgo(0),
  },
  {
    taskId: "t4",
    items: defaultChecklistItems({ isBusiness: false, isSensitive: true }),
    updatedAt: daysAgo(1),
  },
];

// ── Sensitive flags surfaced for the admin/leader queue. ─────────────────
export const sensitiveFlags: SensitiveFlag[] = tasks
  .filter((t) => t.sensitive)
  .map((t) => t.sensitive!);

export const submissions: Submission[] = [
  {
    id: "s1",
    taskId: "t3",
    type: "google_doc",
    version: 2,
    content: "https://docs.google.com/document/d/abc",
    createdAt: daysAgo(0),
    isCurrent: true,
  },
  {
    id: "s2",
    taskId: "t4",
    type: "inline",
    version: 1,
    content:
      "The latest hearings reveal a widening gap between policy ambition and operational reality...",
    createdAt: daysAgo(2),
    isCurrent: true,
  },
  {
    id: "s3",
    taskId: "t5",
    type: "file",
    version: 3,
    content: "the-new-map-review-final.pdf",
    file: {
      filename: "the-new-map-review-final.pdf",
      mimeType: "application/pdf",
      sizeBytes: 482_113,
    },
    createdAt: daysAgo(8),
    isCurrent: true,
  },
];

export const conversations: Conversation[] = [
  {
    id: "c1",
    kind: "all_team",
    title: "All Team",
    memberIds: users.map((u) => u.id),
    lastMessageAt: daysAgo(0),
  },
  {
    id: "c0",
    kind: "admins_only",
    title: "Admins & Leaders",
    memberIds: users
      .filter((u) => u.role === "admin" || u.role === "leader")
      .map((u) => u.id),
    lastMessageAt: daysAgo(1),
  },
  {
    id: "c2",
    kind: "dm",
    title: "Casey Lee",
    memberIds: ["u1", "u4"],
    lastMessageAt: daysAgo(0),
  },
  {
    id: "c3",
    kind: "issue",
    title: "Issue #42",
    memberIds: ["u3", "u5", "u6"],
    lastMessageAt: daysAgo(1),
  },
  {
    id: "c4",
    kind: "group",
    title: "Editors Room",
    memberIds: ["u4", "u5", "u6"],
    lastMessageAt: daysAgo(2),
  },
];

export const messages: Message[] = [
  {
    id: "m1",
    conversationId: "c2",
    authorId: "u4",
    body: "Loved the lead — let's tighten the third graf.",
    createdAt: daysAgo(0),
  },
  {
    id: "m2",
    conversationId: "c2",
    authorId: "u1",
    body: "On it. New version up in an hour.",
    createdAt: daysAgo(0),
  },
  {
    id: "m3",
    conversationId: "c1",
    authorId: "u6",
    body: "Reminder: Issue #42 ships Friday.",
    createdAt: daysAgo(1),
  },
  {
    id: "m4",
    conversationId: "c1",
    authorId: "u7",
    body: "House rules refresher — be kind in comments, cite your sources, and flag anything that feels off.",
    createdAt: daysAgo(2),
    pinnedAt: daysAgo(2),
  },
  {
    id: "m5",
    conversationId: "c1",
    authorId: "u6",
    body: "Welcome to the new writers joining this issue! Open the brief, ask questions, and don't be afraid to request an extension if you need one.",
    createdAt: daysAgo(3),
    pinnedAt: daysAgo(3),
  },
  {
    id: "m6",
    conversationId: "c0",
    authorId: "u7",
    body: "Admins/leaders only — coordinate moderation and approvals here so writers don't see ops chatter.",
    createdAt: daysAgo(1),
  },
];

export const notifications: Notification[] = [
  {
    id: "n1",
    userId: "u1",
    kind: "review_decision",
    title: "Changes requested on 'Op-ed: AI policy at the Hill'",
    read: false,
    createdAt: daysAgo(0),
  },
  {
    id: "n2",
    userId: "u1",
    kind: "deadline",
    title: "Quarterly market outlook is due in 2 days",
    read: false,
    createdAt: daysAgo(0),
  },
  {
    id: "n3",
    userId: "u4",
    kind: "submission",
    title: "Jordan submitted Issue #42",
    read: true,
    createdAt: daysAgo(0),
  },
];

export function userById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}
