import { computeCapex, computeDebtService, computeDscr } from "./capital";
import { computeLocation } from "./location";
import { computeRamp } from "./ramp";
import type { LoanAssumptions, LocationAssumptions, Scenario, UnitModel } from "./types";

export interface UnitOptions {
  /** Flagship uses the full capex; later units use the scenario's overrides. Default true. */
  flagship?: boolean;
  loan: LoanAssumptions;
  /** Ramp horizon in months. Default 120. */
  months?: number;
  /** Replace the scenario's assumptions (e.g. slider state). Defaults to the scenario preset. */
  assumptions?: LocationAssumptions;
}

/** Everything the Model and Unit Economics modules need for one location, computed once. */
export function computeUnit(scenario: Scenario, options: UnitOptions): UnitModel {
  const flagship = options.flagship ?? true;
  const a = options.assumptions ?? scenario.assumptions;
  const location = computeLocation(a);
  const capex = computeCapex(a, flagship ? {} : scenario.subsequentUnitOverrides);
  const debt = computeDebtService(options.loan);
  const dscr = computeDscr(location.ebitda, debt.annualDebtService);
  const ramp = computeRamp(a, { capex: capex.total, annualDebtService: debt.annualDebtService, ...(options.months !== undefined ? { months: options.months } : {}) });
  return { scenario: scenario.key, flagship, location, capex, debt, dscr, ramp };
}
