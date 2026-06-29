/**
 * Site configuration — defaults + merge helpers.
 *
 * The editable portal configuration (branding, feature toggles, and workflow
 * overrides) is stored as a single JSON blob in `public.app_settings`. Admins
 * only persist the fields they change, so at read time we deep-merge the stored
 * patch over {@link DEFAULT_SITE_CONFIG} to get a fully-populated config.
 *
 * This module is intentionally framework-agnostic (no React, no Supabase) so it
 * can be shared by the `SiteConfigProvider`, the Supabase adapter (checklist
 * seeding), and the dependency-free notification-policy / status helpers.
 */
import type { Role, TaskStatus } from "./types";

export type FeatureToggle = {
  enabled: boolean;
  /** Roles that may see/use the feature when it is enabled. */
  roles: Role[];
};

export type BrandConfig = {
  name: string;
  tagline: string;
  /** Gradient start colour (CSS colour string). */
  accentFrom: string;
  /** Gradient end colour (CSS colour string). */
  accentTo: string;
};

export type StatusBadgeTone = "default" | "secondary" | "warning" | "success";

/** Per-status presentation override. Status *keys* stay fixed; copy is editable. */
export type StatusOverride = {
  label?: string;
  description?: string;
  badgeTone?: StatusBadgeTone;
  nextAction?: Partial<{ writer: string; editor: string; leader: string }>;
};

export type ChecklistTemplateGroup = "general" | "business" | "sensitive";

export type ChecklistTemplateItem = {
  key: string;
  label: string;
  group: ChecklistTemplateGroup;
  required: boolean;
};

export type FeedbackCategoryConfig = { value: string; label: string };

/** Fully-resolved configuration consumed by the UI. */
export type SiteConfig = {
  brand: BrandConfig;
  features: Record<string, FeatureToggle>;
  statuses: Partial<Record<TaskStatus, StatusOverride>>;
  checklistTemplate?: Partial<Record<ChecklistTemplateGroup, ChecklistTemplateItem[]>>;
  notificationDefaults: Record<string, boolean>;
  feedbackCategories: FeedbackCategoryConfig[];
};

/** A stored/patch shape — every field optional; only changed fields persist. */
export type SiteConfigPatch = {
  brand?: Partial<BrandConfig>;
  features?: Record<string, Partial<FeatureToggle>>;
  statuses?: Partial<Record<TaskStatus, StatusOverride>>;
  checklistTemplate?: Partial<Record<ChecklistTemplateGroup, ChecklistTemplateItem[]>>;
  notificationDefaults?: Record<string, boolean>;
  feedbackCategories?: FeedbackCategoryConfig[];
};

const ALL_ROLES: Role[] = ["writer", "editor", "leader", "admin"];

export const DEFAULT_FEEDBACK_CATEGORIES: FeedbackCategoryConfig[] = [
  { value: "portal_bug", label: "Something's broken" },
  { value: "feature_idea", label: "Idea / feature request" },
  { value: "story_or_content", label: "A story or our coverage" },
  { value: "competition", label: "Essay competition" },
  { value: "general", label: "General feedback" },
  { value: "other", label: "Something else" },
];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  brand: {
    name: "Advantage",
    tagline: "Newsroom",
    accentFrom: "#5b5bd6",
    accentTo: "#7e7af0",
  },
  features: {
    competitions: { enabled: true, roles: [...ALL_ROLES] },
    feedback: { enabled: true, roles: [...ALL_ROLES] },
  },
  statuses: {},
  notificationDefaults: {},
  feedbackCategories: DEFAULT_FEEDBACK_CATEGORIES,
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge `patch` over `base`. Plain objects merge recursively; arrays and
 * primitives from the patch replace the base wholesale (so an edited checklist
 * or category list overwrites the default rather than concatenating).
 */
function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return base;
  if (!isPlainObject(base)) return patch as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] =
      isPlainObject(value) && isPlainObject(current)
        ? deepMerge(current, value)
        : value;
  }
  return out as T;
}

/** Resolve a stored patch into a complete config by merging over defaults. */
export function resolveSiteConfig(
  stored?: SiteConfigPatch | Record<string, unknown> | null
): SiteConfig {
  if (!stored) return DEFAULT_SITE_CONFIG;
  return deepMerge(DEFAULT_SITE_CONFIG, stored);
}

/**
 * Deep-merge two stored patches (base ⟵ patch). Used server-side when an admin
 * saves one settings tab so the other tabs' values are preserved.
 */
export function mergeConfigPatch(
  base: unknown,
  patch: unknown
): Record<string, unknown> {
  return deepMerge(isPlainObject(base) ? base : {}, patch) as Record<
    string,
    unknown
  >;
}

/** Whether a feature is enabled and visible to the given role. */
export function featureEnabledFor(
  config: SiteConfig,
  feature: string,
  role: Role
): boolean {
  const toggle = config.features[feature];
  if (!toggle) return true; // unknown feature → not gated
  if (!toggle.enabled) return false;
  return toggle.roles.includes(role);
}
