"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * Lightweight popover implemented over Radix Dialog (already a dependency).
 * Used for simple anchored panels like the notifications bell.
 */
export const Popover = DialogPrimitive.Root;
export const PopoverTrigger = DialogPrimitive.Trigger;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    align?: "start" | "end";
  }
>(({ className, align = "end", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-transparent" />
    <DialogPrimitive.Content
      ref={ref}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className={cn(
        "fixed z-50 top-16 w-[22rem] max-w-[92vw] rounded-xl border border-border bg-popover text-popover-foreground shadow-elevated outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        align === "end" ? "right-4" : "left-4",
        className
      )}
      {...props}
    />
  </DialogPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";
