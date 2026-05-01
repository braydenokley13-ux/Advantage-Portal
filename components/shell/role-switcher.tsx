"use client";

import { useRole } from "@/lib/role-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const ROLE_TONE: Record<string, "default" | "secondary" | "warning" | "danger"> = {
  writer: "default",
  editor: "secondary",
  leader: "warning",
  admin: "danger",
};

export function RoleSwitcher() {
  const { user, allUsers, setUserId } = useRole();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground capitalize">
            {user.role}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Preview as</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={user.id} onValueChange={setUserId}>
          {allUsers.map((u) => (
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
        <DropdownMenuLabel className="text-[10px] font-normal">
          Demo only — switches active session locally.
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
