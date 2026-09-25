import type {
  FranchiseMarket,
  FranchiseTerms,
  FxTable,
  LoanAssumptions,
  OpeningPlan,
  PartnershipTerms,
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
 * Corporate opening schedule, months relative to the flagship (T0).
 * Owner decisions 2026-09-25: the first five locations are corporate-owned
 * and operated; everything from the sixth location on is franchised (see
 * FRANCHISE_MARKETS). Locations 2 to 5 open at T0+16/19/22/25, which
 * reproduces the spec 5.8 revenue table (Y1 flagship only, Y2 partial
 * years, Y3 first full year at five) rather than section 2's "within 12
 * months" wording.
 */
const openingSchedule: OpeningPlan[] = [
  { key: "lehi", name: "Lehi (Traverse Mountain)", region: "utah", openMonth: 0, flagship: true, structure: "corporate" },
  { key: "slc", name: "Downtown SLC (City Creek)", region: "utah", openMonth: 16, flagship: false, structure: "corporate" },
  { key: "south-jordan", name: "South Jordan (Daybreak)", region: "utah", openMonth: 19, flagship: false, structure: "corporate" },
  { key: "provo", name: "Provo (University Place)", region: "utah", openMonth: 22, flagship: false, structure: "corporate" },
  { key: "st-george", name: "St. George", region: "utah", openMonth: 25, flagship: false, structure: "corporate" },
];
export const OPENING_SCHEDULE: readonly OpeningPlan[] = Object.freeze(openingSchedule);

/** Spec 5.9 franchise economics. */
export const FRANCHISE_TERMS: FranchiseTerms = Object.freeze({
  unitFranchiseFee: 55_000,
  royaltyPct: 0.05,
  marketingFundPct: 0.02,
  platformLicenseMonthly: 1800,
  platformGrossMarginPct: 0.8,
});

/**
 * Franchise markets, locations 6 and beyond (owner decision 2026-09-25).
 *
 * US metros (spec 5.9 named them corporate at $5.5M to $6.5M AUV) are now
 * area-development franchises opening from plan year 4, one unit each, with
 * a development fee in place of a territory fee. International markets are
 * master franchises or JVs from year 4 and 5 as spec 5.9 lays out. Territory
 * fees sit inside the spec's $250K to $750K range; unit counts and timing are
 * engine assumptions flagged in DECISIONS.md. Paris is a sub-franchise under
 * London and carries no fee. auvIndex scales the base unit's steady revenue.
 */
const franchiseMarkets: FranchiseMarket[] = [
  { key: "nyc", name: "New York City", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1, 6: 2 }, auvIndex: 1.5 },
  { key: "la", name: "Los Angeles", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1, 6: 2 }, auvIndex: 1.45 },
  { key: "las-vegas", name: "Las Vegas", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1, 6: 1 }, auvIndex: 1.4 },
  { key: "seattle", name: "Seattle", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1, 6: 1 }, auvIndex: 1.3 },
  { key: "taipei", name: "Taipei", structure: "master-franchise", territoryFee: 500_000, territoryYear: 4, unitsByYear: { 4: 3, 5: 5, 6: 6 }, auvIndex: 0.85 },
  { key: "tokyo", name: "Tokyo", structure: "jv", territoryFee: 750_000, territoryYear: 4, unitsByYear: { 4: 2, 5: 5, 6: 6 }, auvIndex: 1.05 },
  { key: "london", name: "London", structure: "master-franchise", territoryFee: 500_000, territoryYear: 4, unitsByYear: { 4: 2, 5: 4, 6: 5 }, auvIndex: 1.1 },
  { key: "paris", name: "Paris", structure: "sub-franchise", territoryFee: 0, territoryYear: 5, unitsByYear: { 5: 2, 6: 3 }, auvIndex: 1.0 },
  { key: "singapore", name: "Singapore", structure: "master-franchise", territoryFee: 350_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 3, 6: 3 }, auvIndex: 1.15 },
  { key: "melbourne", name: "Melbourne", structure: "master-franchise", territoryFee: 250_000, territoryYear: 5, unitsByYear: { 5: 4, 6: 4 }, auvIndex: 0.95 },
];
// Typed through a mutable local first: Object.freeze on a literal loses the
// contextual type, and a consumer without exactOptionalPropertyTypes then
// infers `4?: undefined` on the unitsByYear records.
export const FRANCHISE_MARKETS: readonly FranchiseMarket[] = Object.freeze(franchiseMarkets);

/**
 * Owner decision 2026-09-25: no SBA loan. The plan is funded by a single
 * financial partner's equity plus the founder's contribution, so the base
 * case carries no debt. The SBA reference loan stays available as a lever
 * for a lender conversation (spec 5.11 numbers: $1.5M, 10 years, 6%).
 */
export const NO_DEBT: LoanAssumptions = Object.freeze({ principal: 0, termMonths: 0, annualRate: 0 });
export const SBA_REFERENCE_LOAN: LoanAssumptions = Object.freeze({ principal: 1_500_000, termMonths: 120, annualRate: 0.06 });

/**
 * Round 1 (pre-opening): flagship, Oh! OS platform build, corporate and
 * working capital. The spec gives the $3.2M total; the platform and
 * corporate split are engine assumptions.
 */
export const ROUND_ONE: RoundAssumptions = Object.freeze({
  key: "round1",
  sources: [
    { key: "partnerEquity", amount: 3_000_000 },
    { key: "founderContribution", amount: 200_000 },
  ],
  uses: [
    { key: "flagshipCapex", amount: 1_710_000 },
    { key: "platformDevelopment", amount: 600_000 },
    { key: "corporateAndWorkingCapital", amount: 890_000 },
  ],
});

/**
 * Round 2 (about T0+12, on a year of flagship data, ahead of the T0+16
 * opening): four corporate units at $1.411M plus corporate infrastructure
 * and a working-capital reserve. All partner equity.
 */
export const ROUND_TWO: RoundAssumptions = Object.freeze({
  key: "round2",
  sources: [{ key: "partnerEquity", amount: 7_500_000 }],
  uses: [
    { key: "unitCapex", amount: 5_644_000 },
    { key: "corporateInfrastructure", amount: 1_000_000 },
    { key: "workingCapitalReserve", amount: 856_000 },
  ],
});

/**
 * Two-owner model (owner decision 2026-09-25): the founder and one financial
 * partner. The partner's ownership is not asserted; computeOwnership derives
 * it from the capital required and industry-standard return expectations,
 * and the Funding module lets the partner change every input.
 *
 * Defaults and where they come from:
 *  - targetMultiple 3.0x over a 5-year hold (about 25% IRR), the usual
 *    private-equity hurdle for an emerging multi-unit restaurant concept.
 *  - exitMultiple 5.0x EBITDA, the middle of the 4x to 6x range for small
 *    multi-unit operators (spec 5.10); the platform line argues for more.
 *  - franchiseMarginPct 0.6: share of royalties and unit fees that reaches
 *    EBITDA after franchise support costs.
 *  - sweatEquityBenchmark 25% to 40%: what an operator who brings the
 *    concept and runs it typically keeps when a partner funds all capital.
 */
export const PARTNERSHIP_TERMS: PartnershipTerms = Object.freeze({
  founderKey: "founder",
  partnerKey: "partner",
  founderCapital: 200_000,
  partnerCapital: 10_500_000,
  targetMultiple: 3.0,
  exitYear: 5,
  exitMultiple: 5.0,
  franchiseMarginPct: 0.6,
  sweatEquityBenchmark: Object.freeze({ min: 0.25, max: 0.4 }),
});

/** Fixed illustrative rates, units per USD (spec 7.4). Update the date when you update the rates. */
export const FX_RATES: FxTable = Object.freeze({
  ratesAsOf: "2026-09-01",
  rates: Object.freeze({ USD: 1, TWD: 32.2, JPY: 148.5, GBP: 0.78, EUR: 0.91, SGD: 1.34, AUD: 1.51 }),
});
