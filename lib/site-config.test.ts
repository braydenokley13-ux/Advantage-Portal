import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_CONFIG,
  resolveSiteConfig,
  featureEnabledFor,
  mergeConfigPatch,
} from "./site-config-defaults";
import { resolveStatusDefinitions } from "./status";
import {
  setEmailDefaultsOverride,
  effectiveEmailDefault,
  shouldEmailNotification,
} from "./notification-policy";
import {
  setChecklistTemplateOverride,
  defaultChecklistItems,
} from "./checklist-template";

describe("resolveSiteConfig", () => {
  it("merges a partial patch over defaults", () => {
    const c = resolveSiteConfig({ brand: { name: "Beacon" } });
    expect(c.brand.name).toBe("Beacon");
    // untouched fields keep their defaults
    expect(c.brand.tagline).toBe(DEFAULT_SITE_CONFIG.brand.tagline);
    expect(c.brand.accentFrom).toBe(DEFAULT_SITE_CONFIG.brand.accentFrom);
  });

  it("returns defaults for nullish input", () => {
    expect(resolveSiteConfig(null).brand.name).toBe("Advantage");
  });
});

describe("featureEnabledFor", () => {
  it("respects the enabled flag and role list", () => {
    const c = resolveSiteConfig({
      features: { competitions: { enabled: false, roles: ["admin"] } },
    });
    expect(featureEnabledFor(c, "competitions", "writer")).toBe(false);
  });
  it("gates by role when enabled", () => {
    const c = resolveSiteConfig({
      features: { feedback: { enabled: true, roles: ["leader", "admin"] } },
    });
    expect(featureEnabledFor(c, "feedback", "writer")).toBe(false);
    expect(featureEnabledFor(c, "feedback", "leader")).toBe(true);
  });
  it("treats unknown features as ungated", () => {
    expect(featureEnabledFor(DEFAULT_SITE_CONFIG, "mystery", "writer")).toBe(
      true
    );
  });
});

describe("mergeConfigPatch", () => {
  it("deep-merges so one tab's save preserves the others", () => {
    const merged = mergeConfigPatch(
      { brand: { name: "A" }, features: { x: { enabled: true } } },
      { brand: { tagline: "T" } }
    );
    expect(merged).toEqual({
      brand: { name: "A", tagline: "T" },
      features: { x: { enabled: true } },
    });
  });
});

describe("resolveStatusDefinitions", () => {
  it("overrides label while keeping other fields", () => {
    const defs = resolveStatusDefinitions({
      not_started: { label: "Backlog" },
    });
    expect(defs.not_started.label).toBe("Backlog");
    expect(defs.not_started.badgeTone).toBe("secondary");
    expect(defs.in_progress.label).toBe("In Progress");
  });
});

describe("notification email overrides", () => {
  afterEach(() => setEmailDefaultsOverride({}));

  it("admin baseline overrides the built-in default", () => {
    expect(effectiveEmailDefault("message")).toBe(false);
    setEmailDefaultsOverride({ message: true });
    expect(effectiveEmailDefault("message")).toBe(true);
  });

  it("a user preference still wins over the admin baseline", () => {
    setEmailDefaultsOverride({ message: true });
    expect(shouldEmailNotification("message", { message: false })).toBe(false);
  });
});

describe("checklist template override", () => {
  afterEach(() => setChecklistTemplateOverride(null));

  it("replaces a group while keeping the built-in default otherwise", () => {
    setChecklistTemplateOverride({
      general: [
        { key: "g_only", label: "Only item", group: "general", required: true },
      ],
    });
    const items = defaultChecklistItems({
      isBusiness: false,
      isSensitive: false,
    });
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Only item");
    expect(items[0].checked).toBe(false);
  });
});
