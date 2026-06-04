/**
 * Default editorial checklist template for newsroom stories.
 *
 * These item ids/labels are the canonical quality gates a story passes
 * through. The Supabase adapter seeds a real `editorial_checklists` row from
 * this template the first time an item is toggled, and the checklist UI
 * renders this set as a virtual list before one exists. Section logic pulls
 * the `business` group for business/markets stories and the `sensitive` group
 * once a story is flagged sensitive.
 */
import type { ChecklistItem } from "./types";

/** Default item set seeded for any newsroom story. */
export function defaultChecklistItems(args: {
  isBusiness: boolean;
  isSensitive: boolean;
}): ChecklistItem[] {
  const { isBusiness, isSensitive } = args;
  const general = [
    { key: "g_headline", label: "Headline is accurate", group: "general", required: true },
    { key: "g_lede", label: "Lede is clear and specific", group: "general", required: true },
    { key: "g_claims", label: "Claims are supported by sources", group: "general", required: true },
    { key: "g_sources", label: "Sources are linked or named", group: "general", required: true },
    { key: "g_quotes", label: "Quotes are attributed", group: "general", required: true },
    { key: "g_opinion", label: "Opinion is clearly labeled (if applicable)", group: "general", required: false },
    { key: "g_grammar", label: "Grammar / copy pass complete", group: "general", required: true },
    { key: "g_final", label: "Ready for final approval", group: "general", required: true },
  ] as const;
  const business = [
    { key: "b_finance_sources", label: "Financial claims have sources", group: "business", required: true },
    { key: "b_market_date", label: "Market data date is stated", group: "business", required: true },
    { key: "b_no_advice", label: "No investment-advice language", group: "business", required: true },
    { key: "b_terms", label: "Terms are explained for teen readers", group: "business", required: true },
  ] as const;
  const sensitive = [
    { key: "s_privacy", label: "Privacy risk reviewed", group: "sensitive", required: true },
    { key: "s_escalation", label: "Admin / leader escalation completed", group: "sensitive", required: true },
    { key: "s_language", label: "Language is fair and precise", group: "sensitive", required: true },
    { key: "s_second_editor", label: "A second editor reviewed", group: "sensitive", required: true },
  ] as const;

  const items: ChecklistItem[] = [
    ...general.map((i) => ({ ...i, checked: false }) as ChecklistItem),
  ];
  if (isBusiness)
    items.push(
      ...business.map((i) => ({ ...i, checked: false }) as ChecklistItem)
    );
  if (isSensitive)
    items.push(
      ...sensitive.map((i) => ({ ...i, checked: false }) as ChecklistItem)
    );
  return items;
}
