import type {
  FranchiseMarket,
  FranchiseTerms,
  FxTable,
  LoanAssumptions,
  OpeningPlan,
  Owner,
  RoundAssumptions,
  Scenario,
  ScenarioKey,
} from "../types";
import { AGGRESSIVE } from "./aggressive";
import { BASE } from "./base";
import { CONSERVATIVE } from "./conservative";

export { AGGRESSIVE, AGGRESSIVE_ASSUMPTIONS } from "./aggressive";
export { BASE, BASE_ASSUMPTIONS, RAMP_CURVE, SUBSEQUENT_UNIT_OVERRIDES } from "./base";
export { CONSERVATIVE, CONSERVATIVE_ASSUMPTIONS } from "./conservative";

export const SCENARIO_KEYS: readonly ScenarioKey[] = Object.freeze(["conservative", "base", "aggressive"]);

export const SCENARIOS: Readonly<Record<ScenarioKey, Scenario>> = Object.freeze({
  conservative: CONSERVATIVE,
  base: BASE,
  aggressive: AGGRESSIVE,
});

export function isScenarioKey(value: string): value is ScenarioKey {
  return (SCENARIO_KEYS as readonly string[]).includes(value);
}

/**
 * Spec 5.8 opening schedule, months relative to the flagship (T0).
 * Spec 5.9 adds four US metros at higher AUV in year 4; their offsets and
 * overrides are engine assumptions, not spec values, and are flagged in
 * DECISIONS.md. Overrides are chosen so NYC and LA land near the spec's
 * $6.5M and the metros as a group sit in the $5.5M to $6.5M range.
 */
export const OPENING_SCHEDULE: readonly OpeningPlan[] = Object.freeze([
  { key: "lehi", name: "Lehi (Traverse Mountain)", region: "utah", openMonth: 0, flagship: true, structure: "corporate" },
  { key: "slc", name: "Downtown SLC (City Creek)", region: "utah", openMonth: 4, flagship: false, structure: "corporate" },
  { key: "south-jordan", name: "South Jordan (Daybreak)", region: "utah", openMonth: 7, flagship: false, structure: "corporate" },
  { key: "provo", name: "Provo (University Place)", region: "utah", openMonth: 10, flagship: false, structure: "corporate" },
  { key: "st-george", name: "St. George", region: "utah", openMonth: 13, flagship: false, structure: "corporate" },
  {
    key: "nyc",
    name: "New York City",
    region: "us-metro",
    openMonth: 37,
    flagship: false,
    structure: "corporate",
    overrides: { utilizationRate: 0.4, avgBowlPrice: 22.5, rentPerSqFtAnnual: 120, nnnPerSqFtAnnual: 25, avgKitchenWage: 27 },
  },
  {
    key: "la",
    name: "Los Angeles",
    region: "us-metro",
    openMonth: 40,
    flagship: false,
    structure: "corporate",
    overrides: { utilizationRate: 0.4, avgBowlPrice: 22.0, rentPerSqFtAnnual: 72, nnnPerSqFtAnnual: 18, avgKitchenWage: 26 },
  },
  {
    key: "las-vegas",
    name: "Las Vegas",
    region: "us-metro",
    openMonth: 43,
    flagship: false,
    structure: "corporate",
    overrides: { utilizationRate: 0.3, avgBowlPrice: 21.5, serviceHoursPerDay: 13, rentPerSqFtAnnual: 60, nnnPerSqFtAnnual: 15 },
  },
  {
    key: "seattle",
    name: "Seattle",
    region: "us-metro",
    openMonth: 46,
    flagship: false,
    structure: "corporate",
    overrides: { utilizationRate: 0.36, avgBowlPrice: 22.0, rentPerSqFtAnnual: 65, nnnPerSqFtAnnual: 16, avgKitchenWage: 26 },
  },
]);

/** Spec 5.9 franchise economics. */
export const FRANCHISE_TERMS: FranchiseTerms = Object.freeze({
  unitFranchiseFee: 55_000,
  royaltyPct: 0.05,
  marketingFundPct: 0.02,
  platformLicenseMonthly: 1800,
  platformGrossMarginPct: 0.8,
});

/**
 * Spec 5.9 international markets. Territory fees sit inside the spec's $250K
 * to $750K range; unit counts and timing are engine assumptions (year 4 first
 * territories, 31 franchise units by year 5) and are flagged in DECISIONS.md.
 * Paris is a sub-franchise under London, so it carries no territory fee.
 */
export const FRANCHISE_MARKETS: readonly FranchiseMarket[] = Object.freeze([
  { key: "taipei", name: "Taipei", structure: "master-franchise", territoryFee: 500_000, territoryYear: 4, unitsByYear: { 4: 3, 5: 5, 6: 6 }, auvIndex: 0.85 },
  { key: "tokyo", name: "Tokyo", structure: "jv", territoryFee: 750_000, territoryYear: 4, unitsByYear: { 4: 2, 5: 5, 6: 6 }, auvIndex: 1.05 },
  { key: "london", name: "London", structure: "master-franchise", territoryFee: 500_000, territoryYear: 4, unitsByYear: { 4: 2, 5: 4, 6: 5 }, auvIndex: 1.1 },
  { key: "paris", name: "Paris", structure: "sub-franchise", territoryFee: 0, territoryYear: 5, unitsByYear: { 5: 2, 6: 3 }, auvIndex: 1.0 },
  { key: "singapore", name: "Singapore", structure: "master-franchise", territoryFee: 350_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 3, 6: 3 }, auvIndex: 1.15 },
  { key: "melbourne", name: "Melbourne", structure: "master-franchise", territoryFee: 250_000, territoryYear: 5, unitsByYear: { 5: 4, 6: 4 }, auvIndex: 0.95 },
]);

/** Spec 5.11: SBA 7(a), 10 years. 6.0% reproduces the spec's ~$200K; real 7(a) pricing is Prime + 2.75 to 3.0%. */
export const DEFAULT_LOAN: LoanAssumptions = Object.freeze({
  principal: 1_500_000,
  termMonths: 120,
  annualRate: 0.06,
});

/**
 * Spec 5.11 round 1 sources. The spec gives the total ($3.2M) and the
 * headline uses (flagship + platform + corporate) but no split beyond the
 * flagship capex, so the platform and corporate lines are engine assumptions.
 */
export const ROUND_ONE: RoundAssumptions = Object.freeze({
  key: "round1",
  sources: [
    { key: "sba7a", amount: 1_500_000 },
    { key: "equity", amount: 1_500_000 },
    { key: "founderAndEquipmentFinancing", amount: 200_000 },
  ],
  uses: [
    { key: "flagshipCapex", amount: 1_710_000 },
    { key: "platformDevelopment", amount: 600_000 },
    { key: "corporateAndWorkingCapital", amount: 890_000 },
  ],
});

/** Spec 5.11 round 2, modeled at the midpoint of $9M to $11M. Four units at $1.411M plus corporate infrastructure. */
export const ROUND_TWO: RoundAssumptions = Object.freeze({
  key: "round2",
  sources: [
    { key: "seriesA", amount: 5_000_000 },
    { key: "sbaNewUnits", amount: 4_000_000 },
    { key: "equipmentLeaseBack", amount: 1_000_000 },
  ],
  uses: [
    { key: "unitCapex", amount: 5_644_000 },
    { key: "corporateInfrastructure", amount: 2_000_000 },
    { key: "workingCapitalReserve", amount: 2_356_000 },
  ],
});

/** Spec 10: member-managed LLC. The operative operating agreement must be confirmed before this goes to a lender. */
export const OWNERS: readonly Owner[] = Object.freeze([
  { key: "dano", pct: 0.49 },
  { key: "kristy", pct: 0.51 },
]);

/** Fixed illustrative rates, units per USD (spec 7.4). Update the date when you update the rates. */
export const FX_RATES: FxTable = Object.freeze({
  ratesAsOf: "2026-09-01",
  rates: Object.freeze({ USD: 1, TWD: 32.2, JPY: 148.5, GBP: 0.78, EUR: 0.91, SGD: 1.34, AUD: 1.51 }),
});
