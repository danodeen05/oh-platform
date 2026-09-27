/**
 * Global scenario switch (Workstream 5, item 5).
 *
 * Every server page and the print route render the same scenario, resolved
 * in this order: an explicit override the page was given (a `?s=` share
 * link on the Model page), then the reader's `oh_plan_scn` cookie, then the
 * access code's default scenario, then base. Edge-safe: no next/headers.
 */

import { isScenarioKey, type ScenarioKey } from "@oh/plan-model";
import type { PlanClaims } from "./session";

export const PLAN_SCENARIO_COOKIE = "oh_plan_scn";
/** Days the reader's choice persists; matches the session cookie. */
export const PLAN_SCENARIO_DAYS = 14;

export function resolveScenario(
  claims: Pick<PlanClaims, "scn"> | null | undefined,
  cookieValue?: string | null,
  override?: string | null,
): ScenarioKey {
  if (override && isScenarioKey(override)) return override;
  if (cookieValue && isScenarioKey(cookieValue)) return cookieValue;
  const home = claims?.scn?.toLowerCase() ?? "";
  return isScenarioKey(home) ? home : "base";
}

/** The code's default scenario, ignoring any reader choice. */
export function homeScenario(claims: Pick<PlanClaims, "scn"> | null | undefined): ScenarioKey {
  return resolveScenario(claims, null, null);
}
