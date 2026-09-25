import type { LocationAssumptions, Scenario } from "../types";
import { BASE_ASSUMPTIONS, SUBSEQUENT_UNIT_OVERRIDES } from "./base";

/**
 * Aggressive: 40% utilization and a $29.00 check (spec 5.4). Spends held at
 * base; bowl price and attach rates rise. Cost structure identical to base.
 */
export const AGGRESSIVE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
  ...BASE_ASSUMPTIONS,
  utilizationRate: 0.4,
  avgBowlPrice: 21.0,
  addOnAttachRate: 0.74,
  beverageAttachRate: 0.59,
  retailAttachRate: 0.04,
});

export const AGGRESSIVE: Scenario = Object.freeze({
  key: "aggressive",
  assumptions: AGGRESSIVE_ASSUMPTIONS,
  subsequentUnitOverrides: SUBSEQUENT_UNIT_OVERRIDES,
});
