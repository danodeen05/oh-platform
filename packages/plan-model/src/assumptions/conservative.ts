import type { LocationAssumptions, Scenario } from "../types";
import { BASE_ASSUMPTIONS, SUBSEQUENT_UNIT_OVERRIDES } from "./base";

/**
 * Conservative: 22% utilization and a $24.10 check (spec 5.4). Only price and
 * attach behavior move; add-on and beverage spends are held at base so the
 * scenario reads as "fewer guests buying less", not a different menu.
 * Cost structure is identical to base.
 */
export const CONSERVATIVE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
  ...BASE_ASSUMPTIONS,
  utilizationRate: 0.22,
  avgBowlPrice: 18.5,
  addOnAttachRate: 0.54,
  avgAddOnSpend: 6.0,
  beverageAttachRate: 0.5,
  avgBeverageSpend: 4.0,
  retailAttachRate: 0.02,
});

export const CONSERVATIVE: Scenario = Object.freeze({
  key: "conservative",
  assumptions: CONSERVATIVE_ASSUMPTIONS,
  subsequentUnitOverrides: SUBSEQUENT_UNIT_OVERRIDES,
});
