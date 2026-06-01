"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MoreHorizontal, Search, ShieldOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { initials, cn } from "@/lib/utils";
import type { Role, User } from "@/lib/types";

const ROLE_TONE: Record<Role, "default" | "secondary" | "warning" | "danger"> = {
  writer: "default",
  editor: "secondary",
  leader: "warning",
  admin: "danger",
};

const ROLES: Role[] = ["writer", "editor", "leader", "admin"];

function isRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}

export function UserList({
  canManage,
  showWorkload = false,
}: {
  canManage: boolean;
  /** Render a workload column with each member's open task count. */
  showWorkload?: boolean;
}) {
  const { users, tasks, updateUserRole, setUserActive } = useStore();
  const { user: me } = useRole();
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [showInactive, setShowInactive] = useState(true);
  const [openProfile, setOpenProfile] = useState<User | null>(null);

  const workloadFor = (userId: string) =>
    tasks.filter(
      (t) =>
        (t.writerId === userId || t.editorId === userId) &&
        t.status !== "complete"
    ).length;

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (!showInactive && u.active === false) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      const q = filter.trim().toLowerCase();
      if (
        q &&
        !u.name.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [users, filter, roleFilter, showInactive]);

  return (
    <>
      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "all" || isRole(value)) setRoleFilter(value);
          }}
          className="w-[10rem]"
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </Select>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show deactivated
        </label>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Member</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium hidden md:table-cell">
                Status
              </th>
              {showWorkload && (
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">
                  Workload
                </th>
              )}
              <th className="px-4 py-2 w-12" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => {
              const inactive = u.active === false;
              return (
                <tr
                  key={u.id}
                  className={cn(
                    "hover:bg-accent/40 transition-colors",
                    inactive && "opacity-60"
                  )}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenProfile(u)}
                      className="flex items-center gap-3 text-left"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.email}
                        </p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && u.id !== me.id ? (
                      <Select
                        value={u.role}
                        onChange={(e) =>
                          updateUserRole(u.id, e.target.value as Role)
                        }
                        className="h-8 text-xs w-[8.5rem]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r[0].toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge variant={ROLE_TONE[u.role]} className="capitalize">
                        {u.role}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {inactive ? (
                      <Badge variant="outline" className="gap-1.5">
                        <ShieldOff className="h-3 w-3" /> Deactivated
                      </Badge>
                    ) : (
                      <Badge variant="success" className="gap-1.5">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </td>
                  {showWorkload && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(() => {
                        const open = workloadFor(u.id);
                        return (
                          <Badge
                            variant={
                              open === 0
                                ? "secondary"
                                : open > 4
                                  ? "warning"
                                  : "default"
                            }
                            className="tabular-nums"
                          >
                            {open} open
                          </Badge>
                        );
                      })()}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    {canManage && u.id !== me.id ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage user</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => setOpenProfile(u)}
                          >
                            View profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {inactive ? (
                            <DropdownMenuItem
                              onClick={() => setUserActive(u.id, true)}
                            >
                              Reactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setUserActive(u.id, false)}
                              className="text-red-600 focus:text-red-700"
                            >
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOpenProfile(u)}
                      >
                        View
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={showWorkload ? 5 : 4}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No members match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>

      <ProfileDialog
        user={openProfile}
        canManage={canManage}
        onOpenChange={(v) => !v && setOpenProfile(null)}
      />
    </>
  );
}

function ProfileDialog({
  user,
  canManage,
  onOpenChange,
}: {
  user: User | null;
  canManage: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { tasks } = useStore();
  if (!user) return null;
  const myTasks = tasks.filter(
    (t) => t.writerId === user.id || t.editorId === user.id
  );
  const open = myTasks.filter((t) => t.status !== "complete").length;
  const done = myTasks.filter((t) => t.status === "complete").length;

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-sm">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>{user.name}</DialogTitle>
              <DialogDescription className="text-xs">
                {user.email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={ROLE_TONE[user.role]} className="capitalize">
              {user.role}
            </Badge>
            {user.active === false ? (
              <Badge variant="outline">Deactivated</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Open" value={open} />
            <Stat label="Completed" value={done} />
          </div>

          {!canManage && (
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Only admins can change roles or deactivate users.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold tracking-tight mt-1">{value}</p>
    </div>
  );
}
