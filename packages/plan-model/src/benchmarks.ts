import { FRANCHISE_MARKETS, FRANCHISE_TERMS, NO_DEBT, OPENING_SCHEDULE, PARTNERSHIP_TERMS, SCENARIOS } from "./assumptions/index";
import { computeCompany, type CompanyModel } from "./company";
import { computeOverhead } from "./overhead";
import { computeOwnership } from "./partnership";
import { computeUnit } from "./unit";
import type { FranchiseMarket, FranchiseTerms, LoanAssumptions, OpeningPlan, OwnershipModel, PartnershipTerms, Scenario, ScenarioKey, UnitModel } from "./types";

/**
 * Benchmark scorecard (2026-09-26, Model integrity section). Each row has a
 * pass band and watch bands on both sides, so a number that is "too good"
 * is flagged as loudly as one that is too weak. Sources are public
 * fast-casual and franchisor ranges; the point of the page is that a
 * diligence reader sees the same table we do.
 */
export type BenchmarkStatus = "pass" | "watch" | "fail" | "pending";

export interface Band {
  min: number;
  max: number;
}

export interface Benchmark {
  key: string;
  label: string;
  unit: "pct" | "usd" | "years" | "multiple" | "ratio";
  pass: Band;
  /** Below the pass band but still explainable. */
  watchLow?: Band;
  /** Above the pass band but still explainable (often "too good"). */
  watchHigh?: Band;
  source: string;
  read: (ctx: ScorecardContext) => number | null;
}

export interface ScorecardContext {
  scenario: Scenario;
  flagship: UnitModel;
  subsequent: UnitModel;
  company: CompanyModel;
  ownership: OwnershipModel;
  franchiseTerms: FranchiseTerms;
  terms: PartnershipTerms;
}

export interface ScorecardRow extends Benchmark {
  value: number | null;
  status: BenchmarkStatus;
}

export function scoreBenchmark(b: Benchmark, value: number | null): BenchmarkStatus {
  if (value === null || !Number.isFinite(value)) return "pending";
  if (value >= b.pass.min && value <= b.pass.max) return "pass";
  if (b.watchLow && value >= b.watchLow.min && value < b.pass.min) return "watch";
  if (b.watchHigh && value > b.pass.max && value <= b.watchHigh.max) return "watch";
  return "fail";
}

const line = (ctx: ScorecardContext, key: string): number => {
  const found = ctx.flagship.location.lines.find((l) => l.key === key);
  if (!found) throw new RangeError(`no cost line ${key}`);
  return found.pct;
};
const year5 = (ctx: ScorecardContext): CompanyModel["years"][number] | undefined => ctx.company.years[4];

/** Franchise-related HQ lines in overhead.ts, for the franchise segment margin. */
export const FRANCHISE_OVERHEAD_KEYS: readonly string[] = Object.freeze(["franchiseDev", "franchiseSupport", "international", "registrations", "intlFilings", "fdd"]);

export const BENCHMARKS: readonly Benchmark[] = Object.freeze([
  { key: "foodCostPct", label: "Food cost", unit: "pct", pass: { min: 0.28, max: 0.35 }, watchLow: { min: 0.25, max: 0.28 }, watchHigh: { min: 0.35, max: 0.38 }, source: "Fast-casual with a premium protein, 28% to 35%", read: (c) => line(c, "foodCost") },
  { key: "laborPct", label: "Labor (unit)", unit: "pct", pass: { min: 0.12, max: 0.25 }, watchLow: { min: 0.08, max: 0.12 }, watchHigh: { min: 0.25, max: 0.32 }, source: "No-front-of-house fast casual 18% to 25%; full service 28% to 35%", read: (c) => c.flagship.location.laborPct },
  { key: "primeCost", label: "Prime cost (COGS + labor)", unit: "pct", pass: { min: 0.4, max: 0.6 }, watchHigh: { min: 0.6, max: 0.65 }, source: "Under 60% is the operator rule of thumb", read: (c) => line(c, "foodCost") + line(c, "packaging") + c.flagship.location.laborPct },
  { key: "occupancyPct", label: "Occupancy", unit: "pct", pass: { min: 0.04, max: 0.08 }, watchLow: { min: 0.02, max: 0.04 }, watchHigh: { min: 0.08, max: 0.1 }, source: "6% to 10% typical; under 4% means the rent is not real", read: (c) => line(c, "occupancy") },
  { key: "otherOpexPct", label: "Other operating (incl. program, comps, packaging)", unit: "pct", pass: { min: 0.12, max: 0.24 }, watchHigh: { min: 0.24, max: 0.28 }, source: "Everything that is not food, labor, occupancy or EBITDA", read: (c) => 1 - line(c, "foodCost") - c.flagship.location.laborPct - line(c, "occupancy") - c.flagship.location.ebitdaMarginPct },
  { key: "ebitdaMarginPct", label: "Four-wall EBITDA", unit: "pct", pass: { min: 0.12, max: 0.28 }, watchLow: { min: 0.08, max: 0.12 }, watchHigh: { min: 0.28, max: 0.35 }, source: "Top-quartile fast casual 15% to 25%; above 28% needs an explanation", read: (c) => c.flagship.location.ebitdaMarginPct },
  { key: "revenuePerSqFt", label: "Revenue per square foot", unit: "usd", pass: { min: 450, max: 1000 }, watchHigh: { min: 1000, max: 1500 }, source: "Fast-casual median $450 to $600; Chipotle-class $800 to $1,000", read: (c) => c.flagship.location.revenuePerSqFt },
  { key: "salesPerPod", label: "Sales per pod", unit: "usd", pass: { min: 15_000, max: 45_000 }, watchHigh: { min: 45_000, max: 70_000 }, source: "Sales per seat, counter service $15K to $45K", read: (c) => c.flagship.location.annualRevenue / c.scenario.assumptions.pods },
  { key: "capexPerUnit", label: "Capex per unit (flagship)", unit: "usd", pass: { min: 800_000, max: 2_000_000 }, watchHigh: { min: 2_000_000, max: 2_500_000 }, source: "Fast-casual build $0.8M to $2.0M net of TI", read: (c) => c.flagship.capex.total },
  { key: "capexPerPod", label: "Capex per pod", unit: "usd", pass: { min: 0, max: 25_000 }, watchHigh: { min: 25_000, max: 35_000 }, source: "Per seat, counter service, under $25K", read: (c) => c.flagship.capex.total / c.scenario.assumptions.pods },
  { key: "paybackYears", label: "Flagship payback (steady state)", unit: "years", pass: { min: 1.5, max: 3 }, watchLow: { min: 0, max: 1.5 }, watchHigh: { min: 3, max: 4 }, source: "Franchise-grade 1.5 to 3 years; under 1.5 is not believed", read: (c) => c.flagship.ramp.payback.fromStabilization },
  { key: "breakEvenShare", label: "Break-even covers as a share of base covers", unit: "ratio", pass: { min: 0, max: 0.6 }, watchHigh: { min: 0.6, max: 0.8 }, source: "A cushion of 40% or more is comfortable", read: (c) => c.flagship.location.breakEvenCoversPerDay / c.flagship.location.actualCoversPerDay },
  { key: "overheadShare", label: "Corporate overhead, share of system sales (year 5)", unit: "pct", pass: { min: 0.03, max: 0.08 }, watchHigh: { min: 0.08, max: 0.12 }, source: "Emerging franchisors 5% to 8%", read: (c) => { const y = year5(c); return y && y.systemWideSales > 0 ? y.corporateOverhead / y.systemWideSales : null; } },
  { key: "royaltyPct", label: "Royalty", unit: "pct", pass: { min: 0.04, max: 0.06 }, watchHigh: { min: 0.06, max: 0.08 }, source: "Fast casual 4% to 6%", read: (c) => c.franchiseTerms.royaltyPct },
  { key: "unitFee", label: "Unit franchise fee", unit: "usd", pass: { min: 25_000, max: 50_000 }, watchHigh: { min: 50_000, max: 60_000 }, source: "$25K to $50K typical", read: (c) => c.franchiseTerms.unitFranchiseFee },
  { key: "franchiseMargin", label: "Franchise segment margin (year 5)", unit: "pct", pass: { min: 0.3, max: 0.6 }, watchLow: { min: 0.15, max: 0.3 }, watchHigh: { min: 0.6, max: 0.7 }, source: "Recurring franchise profit less franchise HQ lines over brand royalties; franchisors 30% to 60%", read: (c) => {
    const y = year5(c);
    if (!y) return null;
    const p = c.company.platform.years[4];
    if (!p || p.brandRoyalties <= 0) return null;
    const hq = computeOverhead(5, y.corporateLocations, y.franchiseLocations).lines.filter((l) => FRANCHISE_OVERHEAD_KEYS.includes(l.key)).reduce((s, l) => s + l.amount, 0);
    return (p.recurringFranchiseProfit - hq) / p.brandRoyalties;
  } },
  { key: "partnerMultiple", label: "Partner multiple at the headline stake", unit: "multiple", pass: { min: 2.5, max: 4 }, watchLow: { min: 2, max: 2.5 }, watchHigh: { min: 4, max: 5 }, source: "Growth equity underwrites 2.5x to 4x over five years", read: (c) => c.ownership.partnerMultipleAtHeadline },
  { key: "exitMultiple", label: "Exit multiple", unit: "multiple", pass: { min: 4, max: 6 }, watchHigh: { min: 6, max: 8 }, source: "Small multi-unit operators 4x to 6x EBITDA; franchisors higher", read: (c) => c.ownership.exitMultiple },
]);

export interface ScorecardInput {
  scenarioKey?: ScenarioKey;
  schedule?: readonly OpeningPlan[];
  markets?: readonly FranchiseMarket[];
  franchiseTerms?: FranchiseTerms;
  terms?: PartnershipTerms;
  loan?: LoanAssumptions;
}

export function scorecardContext(input: ScorecardInput = {}): ScorecardContext {
  const scenario = SCENARIOS[input.scenarioKey ?? "base"];
  const schedule = input.schedule ?? OPENING_SCHEDULE;
  const markets = input.markets ?? FRANCHISE_MARKETS;
  const franchiseTerms = input.franchiseTerms ?? FRANCHISE_TERMS;
  const terms = input.terms ?? PARTNERSHIP_TERMS;
  const loan = input.loan ?? NO_DEBT;
  return {
    scenario,
    flagship: computeUnit(scenario, { loan }),
    subsequent: computeUnit(scenario, { loan, flagship: false }),
    company: computeCompany({ scenario, schedule, markets, franchiseTerms }),
    ownership: computeOwnership({ scenario, terms, schedule, markets, franchiseTerms }),
    franchiseTerms,
    terms,
  };
}

export interface Scorecard {
  rows: readonly ScorecardRow[];
  pass: number;
  watch: number;
  fail: number;
  pending: number;
}

export function computeScorecard(ctx: ScorecardContext = scorecardContext()): Scorecard {
  const rows = BENCHMARKS.map((b): ScorecardRow => {
    const value = b.read(ctx);
    return { ...b, value, status: scoreBenchmark(b, value) };
  });
  const count = (s: BenchmarkStatus): number => rows.filter((r) => r.status === s).length;
  return { rows, pass: count("pass"), watch: count("watch"), fail: count("fail"), pending: count("pending") };
}
