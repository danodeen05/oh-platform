import { AGGRESSIVE_COVERAGE, COVERAGE_FACTOR, coverageFTE, coverageHoursPerDay } from "../labor";
import type { LocationAssumptions, Scenario } from "../types";
import { BASE_ASSUMPTIONS, SUBSEQUENT_UNIT_OVERRIDES } from "./base";

const kitchenHoursPerDay = coverageHoursPerDay(AGGRESSIVE_COVERAGE); // 85

/**
 * Aggressive (re-based 2026-09-26): 40% utilization at the reset prices,
 * with 85 staffed hours a day to serve 600 covers. Cost structure is the
 * base's; the check no longer rises with the scenario (R2: the menu is the
 * menu).
 */
export const AGGRESSIVE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
  ...BASE_ASSUMPTIONS,
  utilizationRate: 0.4,
  kitchenHoursPerDay, // 2026-09-26 re-base: new (L1)
  kitchenFTE: coverageFTE(kitchenHoursPerDay, BASE_ASSUMPTIONS.operatingDaysPerYear, COVERAGE_FACTOR, BASE_ASSUMPTIONS.annualHoursPerFTE), // 7 -> 13.3
});

export const AGGRESSIVE: Scenario = Object.freeze({
  key: "aggressive",
  assumptions: AGGRESSIVE_ASSUMPTIONS,
  subsequentUnitOverrides: SUBSEQUENT_UNIT_OVERRIDES,
});
