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
    label: "New assignment",
    description: "Someone added a task to your list.",
    icon: ClipboardList,
    tone: "bg-indigo-100 text-indigo-700",
  },
  deadline: {
    label: "Deadline coming up",
    description: "Friendly nudges at 7 days, 3 days, 1 day, and overdue.",
    icon: CalendarClock,
    tone: "bg-amber-100 text-amber-800",
  },
  submission: {
    label: "Draft submitted",
    description: "A writer turned in a new version.",
    icon: FileUp,
    tone: "bg-blue-100 text-blue-700",
  },
  comment: {
    label: "Comments & mentions",
    description: "Someone commented on your work or mentioned you.",
    icon: AtSign,
    tone: "bg-purple-100 text-purple-700",
  },
  review_decision: {
    label: "Editor decision",
    description:
      "Your editor approved your draft, asked for changes, or returned it.",
    icon: CheckCircle2,
    tone: "bg-emerald-100 text-emerald-700",
  },
  task_complete: {
    label: "Task wrapped",
    description: "A task you're part of was marked complete.",
    icon: CheckCircle2,
    tone: "bg-emerald-100 text-emerald-700",
  },
  message: {
    label: "Direct message",
    description: "Someone sent you a DM or wrote in a chat you're in.",
    icon: MessageSquare,
    tone: "bg-slate-100 text-slate-700",
  },
  announcement: {
    label: "Team announcement",
    description: "A leader or admin posted something everyone should see.",
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
