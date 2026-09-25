import type {
  CapexAssumptions,
  CapexLine,
  CapexModel,
  CapitalStackModel,
  DebtServiceModel,
  DilutionModel,
  LoanAssumptions,
  Owner,
  RoundAssumptions,
} from "./types";

export interface CapexInput extends CapexAssumptions {
  pods: number;
  squareFeet: number;
}

/**
 * Spec 5.6 capital per location. Pass `overrides` for locations 2 to 5.
 * The TI allowance is a negative line so the table sums to net capex.
 */
export function computeCapex(a: CapexInput, overrides: Readonly<Partial<CapexAssumptions>> = {}): CapexModel {
  const c: CapexInput = { ...a, ...overrides };
  const lines: CapexLine[] = [
    { key: "podUnitCost", amount: c.pods * c.podUnitCost },
    { key: "kitchenEquipment", amount: c.kitchenEquipment },
    { key: "buildoutPerSqFt", amount: c.squareFeet * c.buildoutPerSqFt },
    { key: "tenantImprovementAllowancePerSqFt", amount: -c.squareFeet * c.tenantImprovementAllowancePerSqFt },
    { key: "techHardware", amount: c.techHardware },
    { key: "designArchPermits", amount: c.designArchPermits },
    { key: "ffeSignage", amount: c.ffeSignage },
    { key: "preOpening", amount: c.preOpening },
  ];
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { lines, total };
}

/** Standard monthly amortizing loan. A zero rate degrades to straight-line. */
export function computeDebtService(loan: LoanAssumptions): DebtServiceModel {
  const { principal, termMonths, annualRate } = loan;
  if (principal <= 0 || termMonths <= 0) {
    return { monthlyPayment: 0, annualDebtService: 0, totalPaid: 0, totalInterest: 0 };
  }
  const r = annualRate / 12;
  const monthlyPayment = r === 0 ? principal / termMonths : (principal * r) / (1 - Math.pow(1 + r, -termMonths));
  const totalPaid = monthlyPayment * termMonths;
  return {
    monthlyPayment,
    annualDebtService: monthlyPayment * 12,
    totalPaid,
    totalInterest: totalPaid - principal,
  };
}

/** Debt service coverage ratio. Lenders want above 1.25x (spec 5.11). Null when there is no debt. */
export function computeDscr(ebitda: number, annualDebtService: number): number | null {
  if (annualDebtService <= 0) return null;
  return ebitda / annualDebtService;
}

export function computeCapitalStack(round: RoundAssumptions): CapitalStackModel {
  const totalSources = round.sources.reduce((sum, s) => sum + s.amount, 0);
  const totalUses = round.uses.reduce((sum, u) => sum + u.amount, 0);
  return {
    key: round.key,
    sources: round.sources,
    uses: round.uses,
    totalSources,
    totalUses,
    unallocated: totalSources - totalUses,
  };
}

/**
 * Priced-round dilution. Valuation is an input, never a preset (spec 5.11:
 * "the plan should not anchor against Dano").
 */
export function computeDilution(preMoneyValuation: number, newMoney: number, owners: readonly Owner[]): DilutionModel {
  if (preMoneyValuation <= 0) throw new RangeError("preMoneyValuation must be positive");
  if (newMoney < 0) throw new RangeError("newMoney cannot be negative");
  const postMoneyValuation = preMoneyValuation + newMoney;
  const newInvestorPct = newMoney / postMoneyValuation;
  const retained = 1 - newInvestorPct;
  return {
    preMoneyValuation,
    newMoney,
    postMoneyValuation,
    newInvestorPct,
    owners: owners.map((o) => ({ key: o.key, pctBefore: o.pct, pctAfter: o.pct * retained })),
  };
}
