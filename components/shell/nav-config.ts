import {
  LayoutDashboard,
  KanbanSquare,
  Inbox,
  Calendar,
  MessageSquare,
  Bell,
  Megaphone,
  Users,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
  Lightbulb,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["writer", "editor", "leader", "admin"],
  },
  {
    href: "/board",
    label: "Board",
    icon: KanbanSquare,
    roles: ["writer", "editor", "leader", "admin"],
  },
  {
    href: "/tasks",
    label: "My Tasks",
    icon: ClipboardList,
    roles: ["writer"],
  },
  {
    href: "/pitches",
    label: "Pitches",
    icon: Lightbulb,
    roles: ["writer", "editor", "leader", "admin"],
  },
  {
    href: "/issues",
    label: "Issues",
    icon: Newspaper,
    roles: ["editor", "leader", "admin"],
  },
  {
    href: "/reviews",
    label: "Reviews",
    icon: Inbox,
    roles: ["editor"],
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: Calendar,
    roles: ["writer", "editor", "leader", "admin"],
  },
  {
    href: "/messages",
    label: "Messages",
    icon: MessageSquare,
    roles: ["writer", "editor", "leader", "admin"],
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["writer", "editor", "leader", "admin"],
  },
  {
    href: "/announcements",
    label: "Announcements",
    icon: Megaphone,
    roles: ["writer", "editor", "leader", "admin"],
  },
  {
    href: "/team",
    label: "Team",
    icon: Users,
    roles: ["leader", "admin"],
  },
  {
    href: "/admin",
    label: "Admin",
    icon: ShieldCheck,
    roles: ["admin"],
  },
  {
    href: "/admin/moderation",
    label: "Moderation",
    icon: ShieldAlert,
    roles: ["leader", "admin"],
  },
  {
    href: "/admin/escalations",
    label: "Escalations",
    icon: ShieldAlert,
    roles: ["leader", "admin"],
  },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
