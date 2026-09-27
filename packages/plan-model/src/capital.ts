import type {
  CapexAssumptions,
  CapexLine,
  CapexModel,
  CapitalStackModel,
  DebtServiceModel,
  DepreciationLine,
  DepreciationModel,
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
    { key: "launchMarketing", amount: c.launchMarketing },
  ];
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { lines, total };
}

/** Amount of one capex line, zero when the model has no such line. */
export function capexLineAmount(capex: CapexModel, key: keyof CapexAssumptions): number {
  return capex.lines.find((l) => l.key === key)?.amount ?? 0;
}

/** Straight-line lives by asset class (2026-09-26, finding K3). Pre-opening and launch marketing are expensed, not depreciated. */
export const DEPRECIATION_LIVES: Readonly<Partial<Record<keyof CapexAssumptions, number>>> = Object.freeze({
  podUnitCost: 7,
  kitchenEquipment: 7,
  ffeSignage: 7,
  buildoutPerSqFt: 10,
  techHardware: 3,
  designArchPermits: 10,
});

/**
 * Depreciation of one unit's build. Buildout is depreciated net of the TI
 * allowance (the landlord's money is not our asset). About $208K a year for
 * the flagship and $174K for a later unit while every class is in service.
 */
export function computeDepreciation(capex: CapexModel): DepreciationModel {
  const amount = (key: keyof CapexAssumptions): number => capexLineAmount(capex, key);
  const lines: DepreciationLine[] = [];
  for (const [key, lifeYears] of Object.entries(DEPRECIATION_LIVES) as [keyof CapexAssumptions, number][]) {
    const basis = key === "buildoutPerSqFt" ? amount(key) + amount("tenantImprovementAllowancePerSqFt") : amount(key);
    lines.push({ key, basis, lifeYears, annual: basis / lifeYears });
  }
  const longest = lines.reduce((max, l) => Math.max(max, l.lifeYears), 0);
  const byYear: number[] = [];
  for (let y = 1; y <= longest; y++) byYear.push(lines.filter((l) => y <= l.lifeYears).reduce((s, l) => s + l.annual, 0));
  return { lines, annual: byYear[0] as number, byYear };
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
