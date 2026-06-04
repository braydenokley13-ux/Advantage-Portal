"use client";

import { useMemo } from "react";
import { Check, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useApiClient } from "@/lib/api/provider";
import { useEditorialChecklist } from "@/lib/hooks";
import { useRole } from "@/lib/role-context";
import { defaultChecklistItems } from "@/lib/checklist-template";
import type { ChecklistGroup, ChecklistItem, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const GROUP_LABEL: Record<ChecklistGroup, string> = {
  general: "General",
  business: "Business / Markets",
  sensitive: "Sensitive story",
};

/**
 * Editorial checklist for a story. Editors, leaders, and admins toggle
 * items. Writers can see progress but cannot tick. Group visibility is
 * driven by section + sensitive flag — sections in business/markets pull
 * the business group; any open sensitive flag pulls the sensitive group.
 */
export function EditorialChecklist({ task }: { task: Task }) {
  const api = useApiClient();
  const { data: list, refetch } = useEditorialChecklist(task.id);
  const { user, role } = useRole();

  // Section ids/slugs drive which checklist groups apply: business/markets
  // pull the business group; an open sensitive flag pulls the sensitive group.
  const isBusiness =
    task.sectionId === "sec-business" ||
    task.sectionId === "sec-markets";
  const isSensitive = !!task.sensitive;

  // If no list exists yet, render a virtual list so the UI isn't empty —
  // the first toggle materialises a real one via api.updateChecklistItem.
  const items = useMemo<ChecklistItem[]>(() => {
    if (list) return list.items as ChecklistItem[];
    return defaultChecklistItems({ isBusiness, isSensitive });
  }, [list, isBusiness, isSensitive]);

  const grouped: Record<ChecklistGroup, ChecklistItem[]> = {
    general: [],
    business: [],
    sensitive: [],
  };
  for (const i of items) grouped[i.group].push(i);

  const canToggle =
    role === "editor" || role === "leader" || role === "admin";

  const totalRequired = items.filter((i) => i.required).length;
  const doneRequired = items.filter((i) => i.required && i.checked).length;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Editorial checklist</p>
        </div>
        <Badge
          variant={
            doneRequired === totalRequired && totalRequired > 0
              ? "success"
              : "secondary"
          }
        >
          {doneRequired} / {totalRequired} required
        </Badge>
      </div>
      <div className="divide-y divide-border">
        {(["general", "business", "sensitive"] as const)
          .filter((g) => grouped[g].length > 0)
          .map((g) => (
            <div key={g} className="px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                {GROUP_LABEL[g]}
              </p>
              <ul className="space-y-1">
                {grouped[g].map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!canToggle) return;
                        await api.updateChecklistItem({
                          taskId: task.id,
                          key: item.key,
                          by: user.id,
                        });
                        refetch();
                      }}
                      disabled={!canToggle}
                      className={cn(
                        "w-full flex items-start gap-2 text-left rounded-md px-2 py-1.5 text-sm transition-colors",
                        canToggle
                          ? "hover:bg-accent"
                          : "cursor-default opacity-90"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0",
                          item.checked
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border bg-background"
                        )}
                      >
                        {item.checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            item.checked && "text-muted-foreground line-through"
                          )}
                        >
                          {item.label}
                        </span>
                        {!item.required && (
                          <span className="ml-2 text-[10px] uppercase text-muted-foreground tracking-wide">
                            optional
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
      {!canToggle && (
        <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
          Editors and leaders tick these as they go. Writers see progress
          but don&apos;t toggle.
        </p>
      )}
    </div>
  );
}
