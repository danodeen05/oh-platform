import { CONSERVATIVE_COVERAGE, COVERAGE_FACTOR, coverageFTE, coverageHoursPerDay } from "../labor";
import { MENU_CURRENT_PRICES, computeMenu } from "../menu";
import type { LocationAssumptions, Scenario } from "../types";
import { BASE_ASSUMPTIONS, SUBSEQUENT_UNIT_OVERRIDES } from "./base";

const menu = computeMenu(MENU_CURRENT_PRICES);
const kitchenHoursPerDay = coverageHoursPerDay(CONSERVATIVE_COVERAGE); // 70

/**
 * Conservative (re-based 2026-09-26): 22% utilization at today's prices
 * ($15.99 / $23.99 / $10.99, owner decision), so the check is $20.78 and
 * the food-cost share rises to 36.5% on the same protein spec. Staffing is
 * trimmed to 70 hours a day. Everything else is the base cost structure.
 */
export const CONSERVATIVE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
  ...BASE_ASSUMPTIONS,
  utilizationRate: 0.22,
  avgBowlPrice: menu.blendedBowlPrice, // 2026-09-26 re-base: 18.5 -> 16.99 (R2; current prices)
  foodCostPct: menu.foodCostPct, // 2026-09-26 re-base: 0.30 -> 0.365 (C1)
  kitchenHoursPerDay, // 2026-09-26 re-base: new (L1)
  kitchenFTE: coverageFTE(kitchenHoursPerDay, BASE_ASSUMPTIONS.operatingDaysPerYear, COVERAGE_FACTOR, BASE_ASSUMPTIONS.annualHoursPerFTE), // 7 -> 11.0
});

export const CONSERVATIVE: Scenario = Object.freeze({
  key: "conservative",
  assumptions: CONSERVATIVE_ASSUMPTIONS,
  subsequentUnitOverrides: SUBSEQUENT_UNIT_OVERRIDES,
});
