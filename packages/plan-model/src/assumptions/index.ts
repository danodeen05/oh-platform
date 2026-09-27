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
 * Franchise markets, locations 6 and beyond, re-phased 2026-09-26 (owner
 * decision; findings F1 and F3). An FDD is effective around month 24 and
 * New York, California and Washington are registration states, so nothing
 * franchised opens before plan year 4 and the count builds at a pace a
 * five-unit operator can support: 7 units in 5 markets by the end of year
 * 5, 15 by year 6, 27 by year 7.
 *
 * Phase one (signed year 3, open year 4): Las Vegas and Seattle.
 * Phase two (signed year 4, open year 5): Los Angeles, New York, Taipei.
 * Phase three (signed year 5, open year 6): Singapore, London, Melbourne;
 * Paris as a sub-franchise under London and Tokyo from year 7.
 * Wave two (territory year 8, first units year 8): Greater China, Southeast
 * Asia, the Gulf, Europe, Latin America and Canada, one unit per city; still
 * on the map, not in the five-year numbers. Former JVs (Tokyo, Shanghai,
 * Beijing, Chengdu) are master franchises: no brand capital, no third round.
 * Territory fees sit inside the spec's $250K to $750K range; unit counts,
 * timing and auvIndex are engine assumptions. `currency` drives the FX
 * haircut in STRUCTURE_ECONOMICS.
 */
const franchiseMarkets: FranchiseMarket[] = [
  // Phase one
  { key: "las-vegas", name: "Las Vegas", structure: "franchise", territoryFee: 100_000, territoryYear: 3, unitsByYear: { 4: 1, 5: 1, 6: 1, 7: 1 }, auvIndex: 1.4 },
  { key: "seattle", name: "Seattle", structure: "franchise", territoryFee: 100_000, territoryYear: 3, unitsByYear: { 4: 1, 5: 1, 6: 1, 7: 1 }, auvIndex: 1.3 },
  // Phase two
  { key: "la", name: "Los Angeles", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 5: 1, 6: 1, 7: 2 }, auvIndex: 1.45 },
  { key: "nyc", name: "New York City", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 5: 1, 6: 1, 7: 2 }, auvIndex: 1.5 },
  { key: "taipei", name: "Taipei", structure: "master-franchise", territoryFee: 500_000, territoryYear: 4, unitsByYear: { 5: 1, 6: 1, 7: 1 }, auvIndex: 0.85, currency: "TWD" },
  // Phase three
  { key: "singapore", name: "Singapore", structure: "master-franchise", territoryFee: 350_000, territoryYear: 5, unitsByYear: { 6: 1, 7: 1 }, auvIndex: 1.15, currency: "SGD" },
  { key: "london", name: "London", structure: "master-franchise", territoryFee: 500_000, territoryYear: 5, unitsByYear: { 6: 1, 7: 1 }, auvIndex: 1.1, currency: "GBP" },
  { key: "melbourne", name: "Melbourne", structure: "master-franchise", territoryFee: 250_000, territoryYear: 5, unitsByYear: { 6: 1, 7: 1 }, auvIndex: 0.95, currency: "AUD" },
  { key: "paris", name: "Paris", structure: "sub-franchise", territoryFee: 0, territoryYear: 7, unitsByYear: { 7: 1 }, auvIndex: 1.0, currency: "EUR" },
  { key: "tokyo", name: "Tokyo", structure: "master-franchise", territoryFee: 750_000, territoryYear: 7, unitsByYear: { 7: 1 }, auvIndex: 1.05, currency: "JPY" },
  // Wave two: territory year 8, one unit each from year 8
  { key: "hong-kong", name: "Hong Kong", structure: "master-franchise", territoryFee: 500_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 1.2, currency: "HKD" },
  { key: "shanghai", name: "Shanghai", structure: "master-franchise", territoryFee: 750_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 1.0, currency: "CNY" },
  { key: "kuala-lumpur", name: "Kuala Lumpur", structure: "master-franchise", territoryFee: 250_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.7, currency: "MYR" },
  { key: "bangkok", name: "Bangkok", structure: "master-franchise", territoryFee: 300_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.75, currency: "THB" },
  { key: "toronto", name: "Toronto", structure: "master-franchise", territoryFee: 350_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 1.15, currency: "CAD" },
  { key: "vancouver", name: "Vancouver", structure: "master-franchise", territoryFee: 250_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 1.1, currency: "CAD" },
  { key: "beijing", name: "Beijing", structure: "master-franchise", territoryFee: 500_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.95, currency: "CNY" },
  { key: "chengdu", name: "Chengdu", structure: "master-franchise", territoryFee: 350_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.8, currency: "CNY" },
  { key: "jakarta", name: "Jakarta", structure: "master-franchise", territoryFee: 250_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.65, currency: "IDR" },
  { key: "manila", name: "Manila", structure: "master-franchise", territoryFee: 250_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.65, currency: "PHP" },
  { key: "dubai", name: "Dubai", structure: "master-franchise", territoryFee: 500_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 1.25, currency: "AED" },
  { key: "mexico-city", name: "Mexico City", structure: "master-franchise", territoryFee: 300_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.7, currency: "MXN" },
  { key: "geneva", name: "Geneva", structure: "sub-franchise", territoryFee: 0, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 1.3, currency: "CHF" },
  { key: "barcelona", name: "Barcelona", structure: "sub-franchise", territoryFee: 0, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.95, currency: "EUR" },
  { key: "rome", name: "Rome", structure: "sub-franchise", territoryFee: 0, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.95, currency: "EUR" },
  { key: "sao-paulo", name: "São Paulo", structure: "master-franchise", territoryFee: 300_000, territoryYear: 8, unitsByYear: { 8: 1 }, auvIndex: 0.7, currency: "BRL" },
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
 *  - partnerPctCap 0.49: the owner will not give up control (owner decision
 *    2026-09-25). The headline is min(return-based, cap); the gap is closed
 *    by the buyout option in computeOwnershipImpact.
 *  - distributionPct 0.5: half of corporate EBITDA is paid out each year;
 *    the rest covers tax, reinvestment and reserves.
 */
export const PARTNERSHIP_TERMS: PartnershipTerms = Object.freeze({
  founderKey: "founder",
  partnerKey: "partner",
  founderCapital: 200_000,
  partnerCapital: 10_500_000,
  targetMultiple: 3.0,
  exitYear: 5,
  exitMultiple: 5.0,
  franchiseMarginPct: 0.6, // deprecated 2026-09-26; STRUCTURE_ECONOMICS carries the franchise cost now
  sweatEquityBenchmark: Object.freeze({ min: 0.25, max: 0.4 }),
  partnerPctCap: 0.49,
  distributionPct: 0.5, // 2026-09-26: of post-tax free cash flow, not of unit EBITDA
  // 2026-09-26 (owner decision): preferred terms, tax distributions, recurring-only exit, capital by round.
  taxDistributionRate: 0.37,
  recurringOnlyExit: true,
  preferredReturnPct: 0.08,
  liquidationPreference: 1,
  partnerCapitalSchedule: Object.freeze([
    { year: 1, amount: 3_000_000 },
    { year: 2, amount: 7_500_000 },
  ]),
});

/** Plan year each round lands in: round 1 before opening (year 1), round 2 at about T0+12 (year 2). */
export const ROUND_YEARS: Readonly<Record<string, number>> = Object.freeze({ round1: 1, round2: 2 });

/** Amount of one use line in a round; throws when the round has no such line so a renamed key cannot silently zero a cash flow. */
export function roundUse(round: RoundAssumptions, key: string): number {
  const use = round.uses.find((u) => u.key === key);
  if (!use) throw new RangeError(`round ${round.key} has no use "${key}"`);
  return use.amount;
}

/** Equity by plan year from the rounds; seeds the portfolio's cumulative cash. */
export const DEFAULT_EQUITY_BY_YEAR: Readonly<Record<number, number>> = Object.freeze({
  [ROUND_YEARS.round1 as number]: ROUND_ONE.sources.reduce((s, x) => s + x.amount, 0),
  [ROUND_YEARS.round2 as number]: ROUND_TWO.sources.reduce((s, x) => s + x.amount, 0),
});

/**
 * Capitalized investments outside unit capex (finding K2): the $600K platform
 * build in round 1 and the $1.0M corporate infrastructure in round 2 are
 * cash out, amortized over five years for the tax line.
 */
export const DEFAULT_INVESTMENTS_BY_YEAR: Readonly<Record<number, number>> = Object.freeze({
  [ROUND_YEARS.round1 as number]: roundUse(ROUND_ONE, "platformDevelopment"),
  [ROUND_YEARS.round2 as number]: roundUse(ROUND_TWO, "corporateInfrastructure"),
});

/** Pass-through income tax funded by member distributions (finding K6). */
export const DEFAULT_TAX_DISTRIBUTION_RATE = 0.37;

/** Fixed illustrative rates, units per USD (spec 7.4). Update the date when you update the rates. */
export const FX_RATES: FxTable = Object.freeze({
  ratesAsOf: "2026-09-01",
  rates: Object.freeze({ USD: 1, TWD: 32.2, JPY: 148.5, GBP: 0.78, EUR: 0.91, SGD: 1.34, AUD: 1.51 }),
});

export {
  LEGACY_AGGRESSIVE,
  LEGACY_AGGRESSIVE_ASSUMPTIONS,
  LEGACY_BASE,
  LEGACY_BASE_ASSUMPTIONS,
  LEGACY_CONSERVATIVE,
  LEGACY_CONSERVATIVE_ASSUMPTIONS,
  LEGACY_FRANCHISE_MARKETS,
  LEGACY_RAMP_CURVE,
  LEGACY_SCENARIOS,
  LEGACY_SUBSEQUENT_UNIT_OVERRIDES,
} from "./legacy-spec";
