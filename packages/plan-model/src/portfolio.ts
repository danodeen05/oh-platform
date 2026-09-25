import { computeCapex } from "./capital";
import { computeLocation } from "./location";
import { computeRamp } from "./ramp";
import type { LocationAssumptions, OpeningPlan, PortfolioLocation, PortfolioModel, PortfolioYear, Scenario } from "./types";

export interface PortfolioOptions {
  /** Plan years from T0. Default 5. */
  years?: number;
}

/** Scenario assumptions with a location's market overrides applied. */
export function locationAssumptions(scenario: Scenario, plan: OpeningPlan): LocationAssumptions {
  return plan.overrides ? { ...scenario.assumptions, ...plan.overrides } : scenario.assumptions;
}

/**
 * Spec 5.8 rollup. Years are counted from the flagship opening (T0), so
 * plan year 1 is months 1 to 12 after T0. A location opening at offset `o`
 * has its first operating month at plan month `o + 1`. Capex is booked in
 * the opening month.
 */
export function computePortfolio(schedule: readonly OpeningPlan[], scenario: Scenario, options: PortfolioOptions = {}): PortfolioModel {
  const planYears = options.years ?? 5;
  const horizon = planYears * 12;

  interface Prepared {
    plan: OpeningPlan;
    loc: PortfolioLocation;
    months: readonly { revenue: number; ebitda: number }[];
    pods: number;
    coversPerDay: number;
  }
  const prepared: Prepared[] = schedule.map((plan) => {
    const a = locationAssumptions(scenario, plan);
    const steady = computeLocation(a);
    const capex = computeCapex(a, plan.flagship ? {} : scenario.subsequentUnitOverrides);
    const monthsRemaining = Math.max(0, horizon - plan.openMonth);
    const months = monthsRemaining > 0 ? computeRamp(a, { months: monthsRemaining }).months : [];
    return {
      plan,
      months,
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
  for (let y = 1; y <= planYears; y++) {
    const firstMonth = (y - 1) * 12 + 1;
    const lastMonth = y * 12;
    let revenue = 0;
    let ebitda = 0;
    let capexDeployed = 0;
    let podsAtEnd = 0;
    let coversPerDayAtEnd = 0;
    let locationsOpenAtEnd = 0;
    const openings: string[] = [];

    for (const p of prepared) {
      // A location at offset `o` first trades in plan month `o + 1`.
      const opensIn = p.plan.openMonth + 1;
      if (opensIn > lastMonth) continue;
      if (opensIn >= firstMonth) {
        openings.push(p.plan.key);
        capexDeployed += p.loc.capex;
      }
      locationsOpenAtEnd++;
      podsAtEnd += p.pods;
      coversPerDayAtEnd += p.coversPerDay;
      for (let pm = Math.max(firstMonth, opensIn); pm <= lastMonth; pm++) {
        // months has exactly horizon - openMonth rows, so every in-horizon month exists.
        const row = p.months[pm - opensIn] as { revenue: number; ebitda: number };
        revenue += row.revenue;
        ebitda += row.ebitda;
      }
    }

    cumulativeCapex += capexDeployed;
    years.push({ year: y, openings, locationsOpenAtEnd, podsAtEnd, coversPerDayAtEnd, revenue, ebitda, capexDeployed, cumulativeCapex });
  }

  const locations = prepared.map((p) => p.loc);
  return { locations, years };
}
