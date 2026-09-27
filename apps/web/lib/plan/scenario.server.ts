/**
 * Server-component side of the global scenario switch. Separate from
 * scenario.ts so middleware never imports next/headers.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import type { ScenarioKey } from "@oh/plan-model";
import { getPlanSession } from "./session.server";
import { PLAN_SCENARIO_COOKIE, resolveScenario } from "./scenario";

/** Memoized per request: layout, page and print share one answer. */
export const getPlanScenario = cache(async (override?: string | null): Promise<ScenarioKey> => {
  const [claims, store] = await Promise.all([getPlanSession(), cookies()]);
  return resolveScenario(claims, store.get(PLAN_SCENARIO_COOKIE)?.value, override);
});
