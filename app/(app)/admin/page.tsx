"use client";

import { ShieldCheck, Users, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { UserList } from "@/components/team/user-list";
import { useRole } from "@/lib/role-context";
import { canManageUsers } from "@/lib/permissions";
import { useStore } from "@/lib/store";

export default function AdminPage() {
  const { role } = useRole();
  const { users, tasks } = useStore();

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
              Only admins can change roles or manage user accounts.
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
        description="System-wide controls. Changes here take effect immediately."
      />

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

      <Card>
        <CardHeader>
          <CardTitle>User management</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4 px-4 space-y-3">
          <UserList canManage={true} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {openTasks} open task{openTasks === 1 ? "" : "s"} across the team.
      </p>
    </div>
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
