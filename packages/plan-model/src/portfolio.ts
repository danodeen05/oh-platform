import { DEFAULT_EQUITY_BY_YEAR, DEFAULT_INVESTMENTS_BY_YEAR, DEFAULT_TAX_DISTRIBUTION_RATE } from "./assumptions/index";
import { capexLineAmount, computeCapex, computeDepreciation } from "./capital";
import { computeLocation } from "./location";
import { CORPORATE_OVERHEAD, computeOverhead } from "./overhead";
import { computeRamp } from "./ramp";
import type { CorporateOverheadAssumptions, LocationAssumptions, OpeningPlan, PortfolioLocation, PortfolioModel, PortfolioYear, Scenario } from "./types";

export interface PortfolioOptions {
  /** Plan years from T0. Default 5. */
  years?: number;
  /** Corporate overhead schedule. Default CORPORATE_OVERHEAD; null computes a four-wall-only rollup. */
  overhead?: CorporateOverheadAssumptions | null;
  /** Franchise units open at the end of each plan year, for overhead roles that scale with them. Default none. */
  franchiseUnitsByYear?: Readonly<Record<number, number>>;
  /** Pass-through tax rate funded by distributions. Default 0.37. */
  taxDistributionRate?: number;
  /** Equity received by plan year; seeds cumulative cash. Default: the two rounds ($3.2M in year 1, $7.5M in year 2). */
  equityByYear?: Readonly<Record<number, number>>;
  /** Capitalized investments outside unit capex (platform build, corporate infrastructure) by plan year; amortized over `investmentLifeYears`. */
  investmentsByYear?: Readonly<Record<number, number>>;
  /** Default 5. */
  investmentLifeYears?: number;
}

/** Scenario assumptions with a location's market overrides applied. */
export function locationAssumptions(scenario: Scenario, plan: OpeningPlan): LocationAssumptions {
  return plan.overrides ? { ...scenario.assumptions, ...plan.overrides } : scenario.assumptions;
}

/** Plan year (1-based) of a plan month index where month 0 is the flagship opening; months before T0 land in year 1. */
export function planYearOfMonth(month: number): number {
  return Math.max(1, Math.floor(month / 12) + 1);
}

/**
 * Spec 5.8 rollup, extended 2026-09-26 with the layers the spec left out
 * (findings K1 to K5): pre-opening expensed over the months before each
 * opening, corporate overhead, depreciation, tax distributions, maintenance
 * capex, free cash flow and cumulative cash seeded with the equity rounds.
 * `revenue` and `ebitda` keep their four-wall meaning.
 *
 * Years are counted from the flagship opening (T0), so plan year 1 is
 * months 1 to 12 after T0. A location opening at offset `o` has its first
 * operating month at plan month `o + 1`. Capex is booked in the opening
 * month.
 */
export function computePortfolio(schedule: readonly OpeningPlan[], scenario: Scenario, options: PortfolioOptions = {}): PortfolioModel {
  const planYears = options.years ?? 5;
  const horizon = planYears * 12;
  const overhead = options.overhead === undefined ? CORPORATE_OVERHEAD : options.overhead;
  const franchiseUnitsByYear = options.franchiseUnitsByYear ?? {};
  const taxRate = options.taxDistributionRate ?? DEFAULT_TAX_DISTRIBUTION_RATE;
  const equityByYear = options.equityByYear ?? DEFAULT_EQUITY_BY_YEAR;
  const investmentsByYear = options.investmentsByYear ?? DEFAULT_INVESTMENTS_BY_YEAR;
  const investmentLife = options.investmentLifeYears ?? 5;

  interface Prepared {
    plan: OpeningPlan;
    loc: PortfolioLocation;
    months: readonly { revenue: number; ebitda: number; maintenanceCapex: number }[];
    depreciationByYear: readonly number[];
    preOpeningCost: number;
    /** Pre-opening cost by plan year. */
    preOpeningByYear: Readonly<Record<number, number>>;
    pods: number;
    coversPerDay: number;
  }
  const prepared: Prepared[] = schedule.map((plan) => {
    const a = locationAssumptions(scenario, plan);
    const steady = computeLocation(a);
    const capex = computeCapex(a, plan.flagship ? {} : scenario.subsequentUnitOverrides);
    const monthsRemaining = Math.max(0, horizon - plan.openMonth);
    const months = monthsRemaining > 0 ? computeRamp(a, { months: monthsRemaining }).months : [];
    const preOpeningLine = capexLineAmount(capex, "preOpening");
    const n = Math.max(0, Math.floor(a.preOpeningMonths));
    const preOpeningCost = n > 0 ? preOpeningLine : 0;
    const preOpeningByYear: Record<number, number> = {};
    for (let k = 1; k <= n; k++) {
      const y = planYearOfMonth(plan.openMonth - k);
      preOpeningByYear[y] = (preOpeningByYear[y] ?? 0) + preOpeningLine / n;
    }
    return {
      plan,
      months,
      depreciationByYear: computeDepreciation(capex).byYear,
      preOpeningCost,
      preOpeningByYear,
      pods: a.pods,
      coversPerDay: steady.actualCoversPerDay,
      loc: {
        key: plan.key,
        name: plan.name,
        openMonth: plan.openMonth,
        flagship: plan.flagship,
        steadyRevenue: steady.annualRevenue,
        steadyEbitda: steady.ebitda,
        capex: capex.total,
      },
    };
  });

  const years: PortfolioYear[] = [];
  let cumulativeCapex = 0;
  let cumulativeCash = 0;
  let lossCarryforward = 0;
  let minimumCash = Number.POSITIVE_INFINITY;
  const investmentBook: { year: number; amount: number }[] = [];
  for (let y = 1; y <= planYears; y++) {
    const firstMonth = (y - 1) * 12 + 1;
    const lastMonth = y * 12;
    let revenue = 0;
    let ebitda = 0;
    let maintenanceCapex = 0;
    let depreciation = 0;
    let capexDeployed = 0;
    let expensedPreOpeningInCapex = 0;
    let preOpeningExpense = 0;
    let podsAtEnd = 0;
    let coversPerDayAtEnd = 0;
    let locationsOpenAtEnd = 0;
    const openings: string[] = [];

    for (const p of prepared) {
      preOpeningExpense += p.preOpeningByYear[y] ?? 0;
      // A location at offset `o` first trades in plan month `o + 1`.
      const opensIn = p.plan.openMonth + 1;
      if (opensIn > lastMonth) continue;
      if (opensIn >= firstMonth) {
        openings.push(p.plan.key);
        capexDeployed += p.loc.capex;
        expensedPreOpeningInCapex += p.preOpeningCost;
      }
      locationsOpenAtEnd++;
      podsAtEnd += p.pods;
      coversPerDayAtEnd += p.coversPerDay;
      for (let pm = Math.max(firstMonth, opensIn); pm <= lastMonth; pm++) {
        // months has exactly horizon - openMonth rows, so every in-horizon month exists.
        const row = p.months[pm - opensIn] as { revenue: number; ebitda: number; maintenanceCapex: number };
        revenue += row.revenue;
        ebitda += row.ebitda;
        maintenanceCapex += row.maintenanceCapex;
        const unitYear = Math.floor((pm - opensIn) / 12);
        depreciation += (p.depreciationByYear[unitYear] ?? 0) / 12;
      }
    }

    const investment = investmentsByYear[y] ?? 0;
    if (investment > 0) investmentBook.push({ year: y, amount: investment });
    for (const inv of investmentBook) if (y - inv.year < investmentLife) depreciation += inv.amount / investmentLife;

    const corporateOverhead = overhead ? computeOverhead(y, locationsOpenAtEnd, franchiseUnitsByYear[y] ?? 0, overhead).total : 0;
    const consolidatedEbitda = ebitda - preOpeningExpense - corporateOverhead;
    const income = consolidatedEbitda - depreciation;
    let taxable = 0;
    if (income > 0) {
      taxable = Math.max(0, income - lossCarryforward);
      lossCarryforward = Math.max(0, lossCarryforward - income);
    } else lossCarryforward += -income;
    const taxDistributions = taxable * taxRate;
    const growthCapex = capexDeployed - expensedPreOpeningInCapex;
    const freeCashFlow = consolidatedEbitda - taxDistributions - maintenanceCapex - growthCapex - investment;
    cumulativeCapex += capexDeployed;
    const equityRaised = equityByYear[y] ?? 0;
    cumulativeCash += equityRaised + freeCashFlow;
    if (cumulativeCash < minimumCash) minimumCash = cumulativeCash;
    years.push({
      year: y,
      openings,
      locationsOpenAtEnd,
      podsAtEnd,
      coversPerDayAtEnd,
      revenue,
      ebitda,
      capexDeployed,
      cumulativeCapex,
      preOpeningExpense,
      corporateOverhead,
      consolidatedEbitda,
      depreciation,
      taxDistributions,
      maintenanceCapex,
      growthCapex,
      investments: investment,
      equityRaised,
      freeCashFlow,
      cumulativeCash,
    });
  }

  const locations = prepared.map((p) => p.loc);
  return { locations, years, minimumCash: years.length > 0 ? minimumCash : 0 };
}
