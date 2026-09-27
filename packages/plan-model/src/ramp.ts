import { computeLabor, computeLocation, computeOccupancy, variableCostPct } from "./location";
import type { LocationAssumptions, PaybackModel, RampModel, RampMonth, RampYear } from "./types";

export interface RampOptions {
  /** Horizon in months. Default 120 (the SBA loan term) so payback resolves in every scenario. */
  months?: number;
  /** Net capex to repay; drives payback. Default 0 (payback then reports null). Includes the pre-opening line. */
  capex?: number;
  /** Annual debt service; spread evenly across months. Default 0. */
  annualDebtService?: number;
  /** Pre-opening cost to spread over `preOpeningMonths` before opening. Default 0 (no pre-opening rows). */
  preOpeningCost?: number;
}

/** Ramp index for a 1-based month: the curve while it lasts, then the plateau. */
export function rampIndex(a: LocationAssumptions, month: number): number {
  return a.rampCurve[month - 1] ?? a.rampPlateau;
}

/** Compound escalator for a unit's year (1-based): year 1 is unescalated. */
export function escalate(pct: number, year: number): number {
  return Math.pow(1 + pct, Math.max(0, year - 1));
}

/**
 * Monthly revenue, EBITDA and cash flow through the opening ramp (spec 5.7)
 * and beyond. Variable costs follow revenue; labor, occupancy, insurance and
 * the fixed member spend are flat inside a year, so the month 4 to 6 trough
 * is felt fully in EBITDA. From the unit's second year prices, COGS, wages
 * and rent escalate by plan year (2026-09-26, finding R6) and maintenance
 * capex is charged (K4). Payback is reported two ways because investors and
 * lenders read the word differently (spec 5.6); from opening it is measured
 * on free cash flow against net capex, which already carries the pre-opening
 * burn, so the pre-opening rows are informational and never double counted.
 */
export function computeRamp(a: LocationAssumptions, options: RampOptions = {}): RampModel {
  const horizon = options.months ?? 120;
  const capex = options.capex ?? 0;
  const annualDebtService = options.annualDebtService ?? 0;
  const preOpeningCost = options.preOpeningCost ?? 0;

  const steady = computeLocation(a);
  const steadyMonthlyRevenue = steady.annualRevenue / 12;
  const monthlyLabor = computeLabor(a) / 12;
  const monthlyOccupancy = computeOccupancy(a) / 12;
  const monthlyOtherFixed = (a.insuranceAnnual + a.memberSwagAnnual) / 12;
  const cogsPct = a.foodCostPct + a.packagingPct;
  const otherVariablePct = variableCostPct(a) - cogsPct;
  const monthlyDebt = annualDebtService / 12;

  const months: RampMonth[] = [];
  let cumulative = 0;
  let cumulativeFree = 0;
  let fromOpening: number | null = null;
  for (let m = 1; m <= horizon; m++) {
    const year = Math.ceil(m / 12);
    const index = rampIndex(a, m);
    const volumeRevenue = steadyMonthlyRevenue * index;
    const revenue = volumeRevenue * escalate(a.menuPriceGrowthPct, year);
    const cogs = volumeRevenue * cogsPct * escalate(a.cogsInflationPct, year);
    const otherVariable = revenue * otherVariablePct;
    const labor = monthlyLabor * escalate(a.wageInflationPct, year);
    const occupancy = monthlyOccupancy * escalate(a.rentEscalationPct, year);
    const ebitda = revenue - cogs - otherVariable - labor - occupancy - monthlyOtherFixed;
    const leveredCashFlow = ebitda - monthlyDebt;
    const maintenanceCapex = year >= 2 ? revenue * a.maintenanceCapexPct : 0;
    const freeCashFlow = leveredCashFlow - maintenanceCapex;
    const before = cumulativeFree;
    cumulative += leveredCashFlow;
    cumulativeFree += freeCashFlow;
    if (fromOpening === null && capex > 0 && cumulativeFree >= capex) {
      // Interpolate inside the month that crosses the line (its flow is necessarily positive).
      fromOpening = (m - 1 + (capex - before) / freeCashFlow) / 12;
    }
    months.push({
      month: m,
      index,
      revenue,
      ebitda,
      debtService: monthlyDebt,
      leveredCashFlow,
      cumulativeLeveredCashFlow: cumulative,
      maintenanceCapex,
      freeCashFlow,
      cumulativeFreeCashFlow: cumulativeFree,
    });
  }

  const years: RampYear[] = [];
  for (let y = 1; y * 12 <= horizon; y++) {
    const slice = months.slice((y - 1) * 12, y * 12);
    const sum = (pick: (r: RampMonth) => number): number => slice.reduce((s, r) => s + pick(r), 0);
    years.push({
      year: y,
      revenue: sum((r) => r.revenue),
      ebitda: sum((r) => r.ebitda),
      leveredCashFlow: sum((r) => r.leveredCashFlow),
      maintenanceCapex: sum((r) => r.maintenanceCapex),
      freeCashFlow: sum((r) => r.freeCashFlow),
    });
  }

  const preOpening: RampMonth[] = [];
  const n = Math.max(0, Math.floor(a.preOpeningMonths));
  if (n > 0 && preOpeningCost > 0) {
    const burn = -preOpeningCost / n;
    let running = 0;
    for (let k = -n; k <= -1; k++) {
      running += burn;
      preOpening.push({
        month: k,
        index: 0,
        revenue: 0,
        ebitda: burn,
        debtService: 0,
        leveredCashFlow: burn,
        cumulativeLeveredCashFlow: running,
        maintenanceCapex: 0,
        freeCashFlow: burn,
        cumulativeFreeCashFlow: running,
      });
    }
  }

  const steadyLevered = steady.ebitda - annualDebtService;
  const payback: PaybackModel = {
    fromStabilization: capex > 0 && steadyLevered > 0 ? capex / steadyLevered : null,
    fromOpening,
  };

  return { months, years, payback, preOpening };
}
