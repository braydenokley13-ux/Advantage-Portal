"use client";

import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { UserList } from "@/components/team/user-list";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/role-context";
import { canManageUsers } from "@/lib/permissions";

/**
 * Team page is the people directory. It is intentionally read-only —
 * for role changes, deactivations, and system controls, leaders/admins
 * jump to the Admin page (linked from the header). The Workload column
 * shows each member's open task count so leaders can spot lopsided
 * assignments at a glance.
 */
export default function TeamPage() {
  const { role } = useRole();
  const isOps = canManageUsers(role) || role === "leader";

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Team"
        description="Who's in the newsroom and what they're working on. Read-only directory."
        actions={
          canManageUsers(role) && (
            <Button asChild variant="gradient">
              <Link href="/admin">
                <ShieldCheck className="h-4 w-4" /> Admin tools
              </Link>
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <div className="mt-0.5 h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="text-foreground font-medium">
              What this page is for
            </p>
            <p className="mt-0.5">
              Browse everyone in the newsroom, see roles, status, and current
              workload. To change someone's role or deactivate an account,
              head to{" "}
              <Link
                href="/admin"
                className="underline hover:text-foreground"
              >
                Admin
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <UserList canManage={false} showWorkload={isOps} />
    </div>
  );
}
