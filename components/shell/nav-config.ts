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
  Library,
  Settings2,
  MessageSquarePlus,
  Trophy,
  Medal,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { featureEnabledFor, type SiteConfig } from "@/lib/site-config-defaults";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Optional feature-toggle key; item is hidden when the feature is off. */
  feature?: string;
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
    href: "/archive",
    label: "Archive",
    icon: Library,
    roles: ["writer", "editor", "leader", "admin"],
  },
  {
    href: "/competitions",
    label: "Competitions",
    icon: Trophy,
    roles: ["writer", "editor", "leader", "admin"],
    feature: "competitions",
  },
  {
    // Public, season-based leaderboard. Lives outside the app shell, so this
    // is a convenience link into the open page.
    href: "/league",
    label: "Writers League",
    icon: Medal,
    roles: ["writer", "editor", "leader", "admin"],
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
    href: "/admin/settings",
    label: "Settings",
    icon: Settings2,
    roles: ["admin"],
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    icon: MessageSquarePlus,
    roles: ["leader", "admin"],
    feature: "feedback",
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
  {
    href: "/admin/league",
    label: "League Board",
    icon: Trophy,
    roles: ["leader", "admin"],
  },
];

export function navForRole(role: Role, config?: SiteConfig): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.feature && config && !featureEnabledFor(config, item.feature, role))
      return false;
    return true;
  });
}
