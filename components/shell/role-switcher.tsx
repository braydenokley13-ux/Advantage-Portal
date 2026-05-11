"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { useSession } from "@/lib/session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLE_TONE: Record<Role, "default" | "secondary" | "warning" | "danger"> = {
  writer: "default",
  editor: "secondary",
  leader: "warning",
  admin: "danger",
};

export function RoleSwitcher() {
  const router = useRouter();
  const { mode, currentUser, allUsers, signInAsDemoUser, signOut } = useSession();

  if (!currentUser) return null;

  const showDemoSwitcher = mode === "mock";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials(currentUser.name)}</AvatarFallback>
        </Avatar>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium">{currentUser.name}</span>
          <span className="text-xs text-muted-foreground capitalize">
            {currentUser.role}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        {showDemoSwitcher ? (
          <>
            <DropdownMenuLabel>Switch demo user</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={currentUser.id}
              onValueChange={signInAsDemoUser}
            >
              {allUsers
                .filter((u) => u.active !== false)
                .map((u) => (
                  <DropdownMenuRadioItem key={u.id} value={u.id}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </div>
                      <Badge variant={ROLE_TONE[u.role]} className="capitalize">
                        {u.role}
                      </Badge>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        ) : (
          <>
            <DropdownMenuLabel className="space-y-0.5">
              <div className="text-sm">{currentUser.name}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {currentUser.email}
              </div>
              <Badge variant={ROLE_TONE[currentUser.role]} className="capitalize">
                {currentUser.role}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
        {showDemoSwitcher && (
          <DropdownMenuLabel className="text-[10px] font-normal">
            Demo session — persisted in localStorage.
          </DropdownMenuLabel>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
