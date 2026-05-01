import {
  AtSign,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Megaphone,
  MessageSquare,
} from "lucide-react";
import type { NotificationKind } from "./types";

export const NOTIFICATION_META: Record<
  NotificationKind,
  {
    label: string;
    description: string;
    icon: typeof Bell;
    tone: string;
  }
> = {
  task_assigned: {
    label: "Task assigned",
    description: "A new task has been assigned to you.",
    icon: ClipboardList,
    tone: "bg-indigo-100 text-indigo-700",
  },
  deadline: {
    label: "Deadline reminders",
    description: "Pings at 7d, 3d, 1d, and overdue.",
    icon: CalendarClock,
    tone: "bg-amber-100 text-amber-800",
  },
  submission: {
    label: "Submission created",
    description: "A writer submitted a new version.",
    icon: FileUp,
    tone: "bg-blue-100 text-blue-700",
  },
  comment: {
    label: "Comments & mentions",
    description: "Someone commented on or mentioned you.",
    icon: AtSign,
    tone: "bg-purple-100 text-purple-700",
  },
  review_decision: {
    label: "Review decision",
    description: "Your editor approved, requested changes, or rejected.",
    icon: CheckCircle2,
    tone: "bg-emerald-100 text-emerald-700",
  },
  task_complete: {
    label: "Task completed",
    description: "A task you're following was completed.",
    icon: CheckCircle2,
    tone: "bg-emerald-100 text-emerald-700",
  },
  message: {
    label: "Message received",
    description: "New direct or group message.",
    icon: MessageSquare,
    tone: "bg-slate-100 text-slate-700",
  },
  announcement: {
    label: "Announcements",
    description: "A leader pinned an announcement.",
    icon: Megaphone,
    tone: "bg-rose-100 text-rose-700",
  },
};

export const NOTIFICATION_ORDER: NotificationKind[] = [
  "task_assigned",
  "deadline",
  "submission",
  "comment",
  "review_decision",
  "task_complete",
  "message",
  "announcement",
];
