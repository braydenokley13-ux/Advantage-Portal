"use client";

import { useMemo } from "react";
import {
  ShieldCheck,
  Users,
  Lock,
  ScrollText,
  Settings2,
  KeyRound,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { UserList } from "@/components/team/user-list";
import { useRole } from "@/lib/role-context";
import { canManageUsers } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import { getSupabaseConfigStatus } from "@/lib/supabase/env";
import { format, formatDistanceToNowStrict } from "date-fns";
import type { Role } from "@/lib/types";

/**
 * Admin is the system-controls page: user management, permissions matrix,
 * audit-log mock, and global toggles. It intentionally does NOT duplicate
 * the Team directory's purpose — the directory lives at /team and is
 * read-only. Microcopy below makes that distinction explicit.
 */
export default function AdminPage() {
  const { role } = useRole();
  const { users, tasks, notifications } = useStore();

  // Hooks must run unconditionally — derive everything before any
  // possible early-return.
  const auditEvents = useMemo(
    () =>
      notifications
        .slice(0, 8)
        .map((n) => ({
          id: n.id,
          when: n.createdAt,
          actor: users.find((u) => u.id === n.userId)?.name ?? "system",
          action: n.title,
          kind: n.kind,
        })),
    [notifications, users]
  );

  if (!canManageUsers(role)) {
    return (
      <div className="container py-12 max-w-md">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Admin access required</p>
            <p className="text-xs text-muted-foreground mt-1">
              Only admins can change roles or manage user accounts. The
              Team page has the read-only directory.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const active = users.filter((u) => u.active !== false).length;
  const deactivated = users.length - active;
  const admins = users.filter((u) => u.role === "admin").length;
  const openTasks = tasks.filter((t) => t.status !== "complete").length;

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Admin"
        description="System controls. Changes here take effect immediately and apply portal-wide."
      />

      <DataModeBadge />

      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <div className="mt-0.5 h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="text-foreground font-medium">
              Admin vs Team — what&apos;s the difference?
            </p>
            <p className="mt-0.5">
              Team is the read-only directory everyone can browse. Admin is
              where you change roles, deactivate accounts, review system
              activity, and manage permissions.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SmallStat icon={Users} label="Total users" value={users.length} />
        <SmallStat
          icon={ShieldCheck}
          label="Admins"
          value={admins}
          tone="bg-red-100 text-red-700"
        />
        <SmallStat
          icon={Users}
          label="Active"
          value={active}
          tone="bg-emerald-100 text-emerald-700"
        />
        <SmallStat
          icon={Users}
          label="Deactivated"
          value={deactivated}
          tone="bg-amber-100 text-amber-800"
        />
      </div>

      <PermissionsMatrix />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> User management
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Change a user&apos;s role or deactivate their account. Deactivation
            ends their session immediately.
          </p>
        </CardHeader>
        <CardContent className="p-0 pb-4 px-4 space-y-3">
          <UserList canManage={true} showWorkload={true} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-muted-foreground" /> Recent
            activity
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Mock audit log derived from the notification stream. A real
            backend would pipe authentication events, role changes, and
            content moderation actions here.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {auditEvents.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No activity yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {auditEvents.map((e) => (
                <li
                  key={e.id}
                  className="px-4 py-3 flex items-center justify-between text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{e.action}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {e.kind.replace("_", " ")} · {e.actor}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatDistanceToNowStrict(new Date(e.when), {
                      addSuffix: true,
                    })}{" "}
                    · {format(new Date(e.when), "MMM d")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {openTasks} open task{openTasks === 1 ? "" : "s"} across the team.
      </p>
    </div>
  );
}

/**
 * Surface the Supabase connection status so admins can confirm at a glance
 * that writes are persisting to the configured Postgres project — and see a
 * clear warning if the environment is misconfigured.
 */
function DataModeBadge() {
  const status = getSupabaseConfigStatus();
  const tone = status.configured
    ? "bg-emerald-50 border-emerald-200"
    : "bg-amber-50 border-amber-200";
  const label = status.configured
    ? `Connected to ${status.urlHost ?? "the configured Supabase project"} — writes persist to Postgres.`
    : "Supabase is not configured — the portal cannot read or write data.";
  const tagTone: "success" | "warning" = status.configured
    ? "success"
    : "warning";
  return (
    <Card>
      <CardContent
        className={`p-4 flex items-start gap-3 border ${tone}`}
      >
        <div className="mt-0.5 h-8 w-8 rounded-md bg-background/80 flex items-center justify-center shrink-0 border border-border">
          <Database className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed flex-1">
          <div className="flex items-center gap-2">
            <p className="text-foreground font-medium">Data backend</p>
            <Badge variant={tagTone}>
              {status.configured ? "Supabase" : "Not configured"}
            </Badge>
          </div>
          <p className="mt-0.5">{label}</p>
          {!status.configured && status.reason && (
            <p className="mt-1 text-amber-700">{status.reason}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionsMatrix() {
  // Single source of truth for the role/permission grid. Mirrors the
  // helpers in lib/permissions.ts.
  const rows: { capability: string; roles: Record<Role, boolean> }[] = [
    {
      capability: "View dashboard, board, calendar, messages",
      roles: { writer: true, editor: true, leader: true, admin: true },
    },
    {
      capability: "Create / edit tasks",
      roles: { writer: false, editor: false, leader: true, admin: true },
    },
    {
      capability: "Submit drafts",
      roles: { writer: true, editor: false, leader: false, admin: false },
    },
    {
      capability: "Review submissions",
      roles: { writer: false, editor: true, leader: true, admin: true },
    },
    {
      capability: "Pin announcements",
      roles: { writer: false, editor: false, leader: true, admin: true },
    },
    {
      capability: "Approve extension requests",
      roles: { writer: false, editor: false, leader: true, admin: true },
    },
    {
      capability: "Manage users (roles, deactivation)",
      roles: { writer: false, editor: false, leader: false, admin: true },
    },
    {
      capability: "Admins-only chat",
      roles: { writer: false, editor: false, leader: true, admin: true },
    },
  ];

  const roleOrder: Role[] = ["writer", "editor", "leader", "admin"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" /> Roles &
          permissions
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Reference matrix. Permissions are enforced server-side once the
          backend is wired in; today they&apos;re enforced by the in-memory
          permission helpers.
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Capability</th>
              {roleOrder.map((r) => (
                <th
                  key={r}
                  className="px-4 py-2 font-medium text-center capitalize"
                >
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.capability}>
                <td className="px-4 py-2.5 text-xs">{row.capability}</td>
                {roleOrder.map((r) => (
                  <td key={r} className="px-4 py-2.5 text-center">
                    {row.roles[r] ? (
                      <Badge variant="success" className="h-5 px-1.5">
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
  tone = "bg-secondary text-secondary-foreground",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-semibold tracking-tight mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
