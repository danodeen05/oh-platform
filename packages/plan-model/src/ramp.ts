import { computeLocation, fixedCosts, variableCostPct } from "./location";
import type { LocationAssumptions, PaybackModel, RampModel, RampMonth, RampYear } from "./types";

export interface RampOptions {
  /** Horizon in months. Default 120 (the SBA loan term) so payback resolves in every scenario. */
  months?: number;
  /** Net capex to repay; drives payback. Default 0 (payback then reports null). */
  capex?: number;
  /** Annual debt service; spread evenly across months. Default 0. */
  annualDebtService?: number;
}

/** Ramp index for a 1-based month: the curve while it lasts, then the plateau. */
export function rampIndex(a: LocationAssumptions, month: number): number {
  return a.rampCurve[month - 1] ?? a.rampPlateau;
}

/**
 * Monthly revenue and EBITDA through the opening ramp (spec 5.7).
 * Variable costs follow revenue; labor, occupancy and insurance are flat, so
 * the month 4 to 6 trough is felt fully in EBITDA. Payback is reported two
 * ways because investors and lenders read the word differently (spec 5.6).
 */
export function computeRamp(a: LocationAssumptions, options: RampOptions = {}): RampModel {
  const horizon = options.months ?? 120;
  const capex = options.capex ?? 0;
  const annualDebtService = options.annualDebtService ?? 0;

  const steady = computeLocation(a);
  const steadyMonthlyRevenue = steady.annualRevenue / 12;
  const monthlyFixed = fixedCosts(a) / 12;
  const contribution = 1 - variableCostPct(a);
  const monthlyDebt = annualDebtService / 12;

  const months: RampMonth[] = [];
  let cumulative = 0;
  let fromOpening: number | null = null;
  for (let m = 1; m <= horizon; m++) {
    const index = rampIndex(a, m);
    const revenue = steadyMonthlyRevenue * index;
    const ebitda = revenue * contribution - monthlyFixed;
    const leveredCashFlow = ebitda - monthlyDebt;
    const before = cumulative;
    cumulative += leveredCashFlow;
    if (fromOpening === null && capex > 0 && cumulative >= capex) {
      // Interpolate inside the month that crosses the line (its flow is necessarily positive).
      fromOpening = (m - 1 + (capex - before) / leveredCashFlow) / 12;
    }
    months.push({ month: m, index, revenue, ebitda, debtService: monthlyDebt, leveredCashFlow, cumulativeLeveredCashFlow: cumulative });
  }

  const years: RampYear[] = [];
  for (let y = 1; y * 12 <= horizon; y++) {
    const slice = months.slice((y - 1) * 12, y * 12);
    years.push({
      year: y,
      revenue: slice.reduce((s, r) => s + r.revenue, 0),
      ebitda: slice.reduce((s, r) => s + r.ebitda, 0),
      leveredCashFlow: slice.reduce((s, r) => s + r.leveredCashFlow, 0),
    });
  }

  const steadyLevered = steady.ebitda - annualDebtService;
  const payback: PaybackModel = {
    fromStabilization: capex > 0 && steadyLevered > 0 ? capex / steadyLevered : null,
    fromOpening,
  };

  return { months, years, payback };
}
