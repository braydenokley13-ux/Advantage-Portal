"use client";

import { useMemo } from "react";
import { useSiteConfig } from "./site-config";
import {
  resolveStatusDefinitions,
  type StatusDefinition,
} from "./status";
import type { TaskStatus } from "./types";

/**
 * Status definitions with the admin's site-config overrides applied. Use this
 * in components instead of importing the static `STATUS_DEFINITIONS` so renamed
 * labels / descriptions / tones from Settings show up live.
 */
export function useStatusDefinitions(): Record<TaskStatus, StatusDefinition> {
  const { config } = useSiteConfig();
  return useMemo(
    () => resolveStatusDefinitions(config.statuses),
    [config.statuses]
  );
}
