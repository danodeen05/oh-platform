import { computeLocation } from "./location";
import { computeRamp, rampIndex } from "./ramp";
import { locationAssumptions } from "./portfolio";
import type { FranchiseMarket, LocationStructure, OpeningPlan, Scenario } from "./types";

export interface TimelineUnit {
  key: string;
  /** Market key for franchise units, location key for corporate. */
  marketKey: string;
  name: string;
  structure: LocationStructure;
  /** Plan month (0 = flagship opening) in which the unit first trades. */
  openMonth: number;
  pods: number;
  steadyRevenue: number;
  coversPerDay: number;
}

export interface TimelineMonth {
  month: number;
  corporateOpen: number;
  franchiseOpen: number;
  locationsOpen: number;
  podsInService: number;
  /** Sum of each open unit's current monthly revenue × 12 (ramp applied). */
  runRateRevenue: number;
  /** Corporate plus franchise gross sales through this month. */
  cumulativeSystemSales: number;
  cumulativeCovers: number;
  /** Keys of units that opened this month. */
  openings: readonly string[];
}

export interface TimelineModel {
  units: readonly TimelineUnit[];
  months: readonly TimelineMonth[];
}

export interface TimelineOptions {
  /** Plan months to model. Default 72. */
  months?: number;
}

/** Spread a year's franchise openings evenly across its twelve months, first opening in month 1 of that year. */
export function franchiseOpenMonths(unitsByYear: Readonly<Record<number, number>>): number[] {
  const out: number[] = [];
  for (const [yearText, count] of Object.entries(unitsByYear)) {
    const year = Number(yearText);
    for (let i = 0; i < count; i += 1) out.push((year - 1) * 12 + Math.floor((i * 12) / count));
  }
  return out.sort((a, b) => a - b);
}

/**
 * Month-by-month system state for the Expansion Engine's scrubber
 * (spec 6.3): every corporate location and franchise unit with its opening
 * month, and running counters. Franchise units use the base unit's ramp and
 * the market's auvIndex; covers scale with revenue.
 */
export function computeTimeline(schedule: readonly OpeningPlan[], markets: readonly FranchiseMarket[], scenario: Scenario, options: TimelineOptions = {}): TimelineModel {
  const horizon = options.months ?? 72;
  const base = computeLocation(scenario.assumptions);
  const units: TimelineUnit[] = [];
  const monthly = new Map<string, readonly { revenue: number }[]>();

  for (const plan of schedule) {
    const a = locationAssumptions(scenario, plan);
    const steady = computeLocation(a);
    units.push({ key: plan.key, marketKey: plan.key, name: plan.name, structure: plan.structure, openMonth: plan.openMonth, pods: a.pods, steadyRevenue: steady.annualRevenue, coversPerDay: steady.actualCoversPerDay });
    monthly.set(plan.key, computeRamp(a, { months: Math.max(1, horizon) }).months);
  }
  for (const market of markets) {
    franchiseOpenMonths(market.unitsByYear).forEach((openMonth, i) => {
      const key = `${market.key}-${i + 1}`;
      units.push({
        key,
        marketKey: market.key,
        name: `${market.name} ${i + 1}`,
        structure: market.structure,
        openMonth,
        pods: scenario.assumptions.pods,
        steadyRevenue: base.annualRevenue * market.auvIndex,
        coversPerDay: base.actualCoversPerDay * market.auvIndex,
      });
    });
  }

  const months: TimelineMonth[] = [];
  let cumulativeSales = 0;
  let cumulativeCovers = 0;
  const daysPerMonth = scenario.assumptions.operatingDaysPerYear / 12;
  for (let m = 0; m < horizon; m += 1) {
    let corporateOpen = 0;
    let franchiseOpen = 0;
    let pods = 0;
    let runRate = 0;
    let salesThisMonth = 0;
    let coversThisMonth = 0;
    const openings: string[] = [];
    for (const u of units) {
      if (u.openMonth > m) continue;
      if (u.openMonth === m) openings.push(u.key);
      const age = m - u.openMonth + 1;
      const index = rampIndex(scenario.assumptions, age);
      const corporate = u.structure === "corporate";
      // Corporate units have a full ramp table (horizon rows from opening); franchise units use the index directly.
      const rows = monthly.get(u.key);
      const revenue = rows ? (rows[age - 1] as { revenue: number }).revenue : (u.steadyRevenue / 12) * index;
      if (corporate) corporateOpen += 1;
      else franchiseOpen += 1;
      pods += u.pods;
      runRate += revenue * 12;
      salesThisMonth += revenue;
      coversThisMonth += u.coversPerDay * daysPerMonth * index;
    }
    cumulativeSales += salesThisMonth;
    cumulativeCovers += coversThisMonth;
    months.push({ month: m, corporateOpen, franchiseOpen, locationsOpen: corporateOpen + franchiseOpen, podsInService: pods, runRateRevenue: runRate, cumulativeSystemSales: cumulativeSales, cumulativeCovers, openings });
  }
  return { units, months };
}
