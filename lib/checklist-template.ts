/**
 * Default editorial checklist template for newsroom stories.
 *
 * These item ids/labels are the canonical quality gates a story passes
 * through. The Supabase adapter seeds a real `editorial_checklists` row from
 * this template the first time an item is toggled, and the checklist UI
 * renders this set as a virtual list before one exists. Section logic pulls
 * the `business` group for business/markets stories and the `sensitive` group
 * once a story is flagged sensitive.
 *
 * Admins can override any group from Settings → Checklist. The site-config
 * provider pushes that override in via {@link setChecklistTemplateOverride};
 * when a group is overridden it replaces the built-in default below.
 */
import type { ChecklistGroup, ChecklistItem } from "./types";

type TemplateItem = {
  key: string;
  label: string;
  group: ChecklistGroup;
  required: boolean;
};

const DEFAULT_GENERAL: TemplateItem[] = [
  { key: "g_headline", label: "Headline is accurate", group: "general", required: true },
  { key: "g_lede", label: "Lede is clear and specific", group: "general", required: true },
  { key: "g_claims", label: "Claims are supported by sources", group: "general", required: true },
  { key: "g_sources", label: "Sources are linked or named", group: "general", required: true },
  { key: "g_quotes", label: "Quotes are attributed", group: "general", required: true },
  { key: "g_opinion", label: "Opinion is clearly labeled (if applicable)", group: "general", required: false },
  { key: "g_grammar", label: "Grammar / copy pass complete", group: "general", required: true },
  { key: "g_final", label: "Ready for final approval", group: "general", required: true },
];

const DEFAULT_BUSINESS: TemplateItem[] = [
  { key: "b_finance_sources", label: "Financial claims have sources", group: "business", required: true },
  { key: "b_market_date", label: "Market data date is stated", group: "business", required: true },
  { key: "b_no_advice", label: "No investment-advice language", group: "business", required: true },
  { key: "b_terms", label: "Terms are explained for teen readers", group: "business", required: true },
];

const DEFAULT_SENSITIVE: TemplateItem[] = [
  { key: "s_privacy", label: "Privacy risk reviewed", group: "sensitive", required: true },
  { key: "s_escalation", label: "Admin / leader escalation completed", group: "sensitive", required: true },
  { key: "s_language", label: "Language is fair and precise", group: "sensitive", required: true },
  { key: "s_second_editor", label: "A second editor reviewed", group: "sensitive", required: true },
];

let _override: Partial<Record<ChecklistGroup, TemplateItem[]>> | null = null;

/** Replace one or more checklist groups from site settings (admin-editable). */
export function setChecklistTemplateOverride(
  template: Partial<Record<ChecklistGroup, TemplateItem[]>> | null | undefined
): void {
  _override = template && Object.keys(template).length > 0 ? template : null;
}

function groupItems(name: ChecklistGroup, fallback: TemplateItem[]): TemplateItem[] {
  const override = _override?.[name];
  return override && override.length > 0 ? override : fallback;
}

/** Default item set seeded for any newsroom story. */
export function defaultChecklistItems(args: {
  isBusiness: boolean;
  isSensitive: boolean;
}): ChecklistItem[] {
  const { isBusiness, isSensitive } = args;
  const items: ChecklistItem[] = groupItems("general", DEFAULT_GENERAL).map(
    (i) => ({ ...i, checked: false })
  );
  if (isBusiness)
    items.push(
      ...groupItems("business", DEFAULT_BUSINESS).map((i) => ({
        ...i,
        checked: false,
      }))
    );
  if (isSensitive)
    items.push(
      ...groupItems("sensitive", DEFAULT_SENSITIVE).map((i) => ({
        ...i,
        checked: false,
      }))
    );
  return items;
}

/** The built-in defaults, exposed so the Settings editor can seed its form. */
export const DEFAULT_CHECKLIST_TEMPLATE: Record<ChecklistGroup, TemplateItem[]> =
  {
    general: DEFAULT_GENERAL,
    business: DEFAULT_BUSINESS,
    sensitive: DEFAULT_SENSITIVE,
  };
