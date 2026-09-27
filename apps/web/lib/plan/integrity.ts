import {
  BENCHMARKS,
  LEVER_KEYS,
  MODEL_CHANGELOG,
  computeScorecard,
  registryRows,
  runInvariants,
  scorecardContext,
  type Band,
  type Benchmark,
  type BenchmarkStatus,
  type RegistryGroup,
  type RegistryRow,
  type Scorecard,
  type ScorecardContext,
} from "@oh/plan-model";
import type { PlanAudience } from "./session";
import type { SectionKey } from "./sections";

/**
 * Model integrity helpers (2026-09-26). Two jobs:
 *
 * 1. Audience filtering for the assumptions register: landlords see the
 *    physical, throughput and cost groups, never the capital stack.
 * 2. The "Where Oh! is different" callout on every section. Each point is
 *    declared here with the engine figure it shows and the scorecard row it
 *    depends on; a point whose row is not a pass is dropped at render time,
 *    so a claim on a section can never contradict the integrity scorecard.
 */
export const LANDLORD_HIDDEN_GROUPS: readonly RegistryGroup[] = ["partnership", "rounds", "loan"];

export function registryGroupsFor(audience: PlanAudience): (group: RegistryGroup) => boolean {
  return (group) => audience !== "LANDLORD" || !LANDLORD_HIDDEN_GROUPS.includes(group);
}

export function registryRowsFor(audience: PlanAudience, rows: readonly RegistryRow[] = registryRows()): readonly RegistryRow[] {
  const allowed = registryGroupsFor(audience);
  return rows.filter((r) => allowed(r.group));
}

/* ------------------------------------------------------------------ */
/* Edge callouts                                                       */
/* ------------------------------------------------------------------ */

export type EdgeUnit = "pct" | "usd" | "usd0" | "count" | "minutes" | "years" | "multiple";

export interface EdgeContext extends ScorecardContext {
  scorecard: Scorecard;
  registryCount: number;
  leverCount: number;
  invariantCount: number;
  changeCount: number;
  /** Minutes from paying at the kiosk to the bowl at the hatch, from the floor-plan journey. */
  minutesToBowl: number;
  /** Corporate and franchise units open at the end of the plan's last scheduled franchise year. */
  franchiseUnitsY7: number;
}

export interface EdgePointSpec {
  /** Scorecard row that must be a pass for the point to render. Omit for a qualitative point. */
  benchmark?: string;
  /** The live figure shown beside the point. */
  figure?: (ctx: EdgeContext) => number;
  unit?: EdgeUnit;
  /**
   * Band shown as the benchmark. Defaults to the scorecard row's pass band;
   * a point can name a different public band (for example full-service
   * labor) when that is the honest comparison.
   */
  band?: Band;
  /** Values interpolated into the point's copy. */
  values?: (ctx: EdgeContext) => Record<string, number>;
}

export interface EdgeSpec {
  points: readonly EdgePointSpec[];
}

const pods = (ctx: EdgeContext): number => ctx.scenario.assumptions.pods;
const line = (ctx: EdgeContext, key: string): number => ctx.flagship.location.lines.find((l) => l.key === key)?.pct ?? 0;

export const EDGES: Readonly<Record<SectionKey, EdgeSpec>> = {
  summary: {
    points: [
      { benchmark: "laborPct", figure: (c) => c.flagship.location.laborPct, unit: "pct", band: { min: 0.25, max: 0.32 } },
      { benchmark: "occupancyPct", figure: (c) => line(c, "occupancy"), unit: "pct", band: { min: 0.06, max: 0.1 } },
      { benchmark: "revenuePerSqFt", figure: (c) => c.flagship.location.revenuePerSqFt, unit: "usd0", band: { min: 450, max: 600 } },
      { values: (c) => ({ rows: c.registryCount, checks: c.invariantCount }) },
    ],
  },
  model: {
    points: [
      { values: (c) => ({ levers: c.leverCount }) },
      { benchmark: "laborPct", figure: (c) => c.flagship.location.laborPct, unit: "pct", band: { min: 0.25, max: 0.32 } },
      { benchmark: "ebitdaMarginPct", figure: (c) => c.flagship.location.ebitdaMarginPct, unit: "pct", band: { min: 0.08, max: 0.12 } },
    ],
  },
  experience: {
    points: [
      { benchmark: "laborPct", figure: (c) => c.flagship.location.laborPct, unit: "pct", band: { min: 0.25, max: 0.32 } },
      { figure: (c) => c.minutesToBowl, unit: "minutes" },
      { values: (c) => ({ pods: pods(c) }) },
      // 2026-09-27 owner decision: the 1% pledge to ONE RED STEP AT A TIME. No public benchmark, so the figure stays in the sentence.
      { values: (c) => ({ pct: c.scenario.assumptions.communityGivingPct * 100 }) },
    ],
  },
  market: {
    points: [
      { figure: (c) => c.flagship.location.avgCheck, unit: "usd", values: (c) => ({ tipLow: 18, tipHigh: 22, check: c.flagship.location.avgCheck }) },
      {},
      {},
    ],
  },
  "floor-plan": {
    points: [
      { values: (c) => ({ pods: pods(c), sqft: c.scenario.assumptions.squareFeet }) },
      {},
      { benchmark: "salesPerPod", figure: (c) => c.flagship.location.annualRevenue / pods(c), unit: "usd0" },
    ],
  },
  operations: {
    points: [
      { benchmark: "laborPct", figure: (c) => c.flagship.location.laborPct, unit: "pct", band: { min: 0.25, max: 0.32 }, values: (c) => ({ fte: Math.round(c.scenario.assumptions.kitchenFTE + c.scenario.assumptions.managerFTE), pods: pods(c) }) },
      { values: (c) => ({ pods: pods(c) }) },
      { benchmark: "foodCostPct", figure: (c) => line(c, "foodCost"), unit: "pct" },
      {},
    ],
  },
  expansion: {
    points: [
      { benchmark: "capexPerPod", figure: (c) => c.flagship.capex.total / pods(c), unit: "usd0" },
      { figure: (c) => c.subsequent.capex.total, unit: "usd0", values: (c) => ({ flagship: c.flagship.capex.total }) },
      { benchmark: "royaltyPct", figure: (c) => c.franchiseTerms.royaltyPct, unit: "pct", values: (c) => ({ license: c.franchiseTerms.platformLicenseMonthly }) },
    ],
  },
  "unit-economics": {
    points: [
      { benchmark: "primeCost", figure: (c) => line(c, "foodCost") + line(c, "packaging") + c.flagship.location.laborPct, unit: "pct", band: { min: 0.55, max: 0.65 } },
      { benchmark: "occupancyPct", figure: (c) => line(c, "occupancy"), unit: "pct", band: { min: 0.06, max: 0.1 } },
      { benchmark: "capexPerPod", figure: (c) => c.flagship.capex.total / pods(c), unit: "usd0" },
    ],
  },
  financials: {
    points: [
      { benchmark: "ebitdaMarginPct", figure: (c) => c.flagship.location.ebitdaMarginPct, unit: "pct", band: { min: 0.08, max: 0.12 } },
      { figure: (c) => c.company.platform.years[4]?.licenseARR ?? 0, unit: "usd0" },
      { benchmark: "franchiseMargin", figure: (c) => c.scorecard.rows.find((r) => r.key === "franchiseMargin")?.value ?? 0, unit: "pct", values: (c) => ({ units: c.franchiseUnitsY7 }) },
    ],
  },
  sensitivity: {
    points: [
      { values: (c) => ({ levers: c.leverCount }) },
      { figure: (c) => Math.min(...c.scenario.assumptions.rampCurve), unit: "pct" },
      {},
    ],
  },
  team: {
    points: [{}, {}, {}],
  },
  funding: {
    points: [
      { figure: () => 0, unit: "usd0" },
      { figure: (c) => c.ownership.partnerPct, unit: "pct", values: (c) => ({ cap: Math.round(c.terms.partnerPctCap * 100) }) },
      { figure: (c) => c.terms.preferredReturnPct ?? 0, unit: "pct", values: (c) => ({ pref: (c.terms.liquidationPreference ?? 1) }) },
    ],
  },
  roadmap: {
    points: [{}, {}, {}],
  },
  integrity: {
    points: [
      { figure: (c) => c.registryCount, unit: "count", values: (c) => ({ changes: c.changeCount }) },
      { figure: (c) => c.invariantCount, unit: "count" },
      { figure: (c) => c.scorecard.pass, unit: "count", values: (c) => ({ total: c.scorecard.rows.length, watch: c.scorecard.watch, fail: c.scorecard.fail }) },
    ],
  },
};

export interface ResolvedEdgePoint {
  /** Index into plan.edge.<section>.points, stable across drops. */
  index: number;
  figure: number | null;
  unit: EdgeUnit | null;
  band: Band | null;
  values: Record<string, number>;
}

export function benchmarkFor(key: string): Benchmark | undefined {
  return BENCHMARKS.find((b) => b.key === key);
}

/** The scorecard status a point depends on, or "pass" for a qualitative point. */
export function edgePointStatus(point: EdgePointSpec, scorecard: Pick<Scorecard, "rows">): BenchmarkStatus {
  if (!point.benchmark) return "pass";
  return scorecard.rows.find((r) => r.key === point.benchmark)?.status ?? "pending";
}

/**
 * The points a section may show: every point whose scorecard row passes.
 * Watch, fail and pending rows drop their point silently; the copy for a
 * dropped point stays in the messages file so it returns when the number does.
 */
export function resolveEdge(section: SectionKey, ctx: EdgeContext): readonly ResolvedEdgePoint[] {
  const spec = EDGES[section];
  const out: ResolvedEdgePoint[] = [];
  spec.points.forEach((p, index) => {
    if (edgePointStatus(p, ctx.scorecard) !== "pass") return;
    const bench = p.benchmark ? benchmarkFor(p.benchmark) : undefined;
    out.push({
      index,
      figure: p.figure ? p.figure(ctx) : null,
      unit: p.unit ?? null,
      band: p.band ?? bench?.pass ?? null,
      values: p.values ? p.values(ctx) : {},
    });
  });
  return out;
}

export interface EdgeContextInput {
  minutesToBowl: number;
  franchiseUnitsY7: number;
  /** Checks the page runs beside the engine's invariants (the floor-plan area check), so counts match the certificate. */
  extraChecks?: number;
}

/** One context per request; every section's callout reads the same numbers. */
export function edgeContext(input: EdgeContextInput, base: ScorecardContext = scorecardContext()): EdgeContext {
  const scorecard = computeScorecard(base);
  return {
    ...base,
    scorecard,
    registryCount: registryRows().length,
    leverCount: LEVER_KEYS.length,
    invariantCount: runInvariants().length + (input.extraChecks ?? 0),
    changeCount: MODEL_CHANGELOG.length,
    minutesToBowl: input.minutesToBowl,
    franchiseUnitsY7: input.franchiseUnitsY7,
  };
}

/** "25 to 32%", "$450 to $600", "1.5 to 3 yr": the band as a reader says it. */
export function formatBand(band: Band, unit: EdgeUnit | null, locale: string): string {
  const one = (v: number, last: boolean): string => formatEdgeValue(v, unit, locale, last);
  return `${one(band.min, false)} to ${one(band.max, true)}`;
}

export function formatEdgeValue(value: number, unit: EdgeUnit | null, locale: string, withUnit = true): string {
  const n = (v: number, opts: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, opts).format(v);
  switch (unit) {
    case "pct":
      return withUnit ? n(value, { style: "percent", maximumFractionDigits: 1 }) : n(value * 100, { maximumFractionDigits: 1 });
    case "usd":
      return n(value, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
    case "usd0":
      return n(value, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    case "years":
      return `${n(value, { maximumFractionDigits: 1 })}${withUnit ? " yr" : ""}`;
    case "multiple":
      return `${n(value, { maximumFractionDigits: 1 })}x`;
    case "minutes":
      return `${n(value, { maximumFractionDigits: 0 })}${withUnit ? " min" : ""}`;
    case "count":
    default:
      return n(value, { maximumFractionDigits: 0 });
  }
}
