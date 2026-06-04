"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { useSession } from "@/lib/session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

/**
 * Top-bar account menu: shows the signed-in user and a sign-out action.
 * No impersonation — the only way to change who you are is to sign out and
 * sign back in through Supabase Auth.
 */
export function UserMenu() {
  const router = useRouter();
  const { currentUser, signOut } = useSession();

  if (!currentUser) return null;

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

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{currentUser.name}</span>
          <span className="text-[11px] text-muted-foreground capitalize font-normal">
            {currentUser.email} · {currentUser.role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
