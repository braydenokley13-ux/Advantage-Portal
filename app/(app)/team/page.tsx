"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { UserList } from "@/components/team/user-list";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/role-context";
import { canManageUsers } from "@/lib/permissions";

export default function TeamPage() {
  const { role } = useRole();
  const manage = canManageUsers(role);

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PageHeader
        title="Team"
        description={
          manage
            ? "Manage roles, deactivate accounts, and inspect activity."
            : "Everyone in the newsroom and how they fit together."
        }
        actions={
          manage && (
            <Button asChild variant="gradient">
              <Link href="/admin">
                <ShieldCheck className="h-4 w-4" /> Admin tools
              </Link>
            </Button>
          )
        }
      />

      <UserList canManage={manage} />
    </div>
  );
}
