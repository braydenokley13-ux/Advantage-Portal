"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Feather } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/role-context";
import { useSiteConfig } from "@/lib/site-config";
import { navForRole } from "./nav-config";

export function Sidebar() {
  const { role } = useRole();
  const { config } = useSiteConfig();
  const pathname = usePathname();
  const items = navForRole(role, config);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border bg-card/60 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-soft">
          <Feather className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">
            {config.brand.name}
          </span>
          <span className="text-xs text-muted-foreground -mt-0.5">
            {config.brand.tagline}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3 scroll-thin overflow-y-auto">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav-${item.href}`}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 -z-0 rounded-md bg-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <item.icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="rounded-lg bg-brand-gradient p-3 text-white shadow-soft">
          <p className="text-xs font-medium opacity-90">Tip</p>
          <p className="text-xs opacity-80 mt-0.5 leading-snug">
            Switch roles in the top-right to preview each persona.
          </p>
        </div>
      </div>
    </aside>
  );
}
