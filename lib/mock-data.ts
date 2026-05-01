import type {
  Conversation,
  Message,
  Notification,
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
