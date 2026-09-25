import { describe, expect, it } from "vitest";
import {
  BASE_ASSUMPTIONS,
  ROUND_ONE,
  SBA_REFERENCE_LOAN,
  computeCapex,
  computeCapitalStack,
  computeDebtService,
  computeDilution,
  computeDscr,
} from "../index";

describe("computeCapex", () => {
  it("applies overrides on top of the base lines", () => {
    const c = computeCapex(BASE_ASSUMPTIONS, { podUnitCost: 1000 });
    expect(c.lines.find((l) => l.key === "podUnitCost")?.amount).toBe(75_000);
    expect(c.total).toBe(1_710_000 - 240_000 + 75_000);
  });
  it("scales pods and square footage", () => {
    const c = computeCapex({ ...BASE_ASSUMPTIONS, pods: 100, squareFeet: 4000 });
    expect(c.lines.find((l) => l.key === "podUnitCost")?.amount).toBe(320_000);
    expect(c.lines.find((l) => l.key === "buildoutPerSqFt")?.amount).toBe(780_000);
    expect(c.lines.find((l) => l.key === "tenantImprovementAllowancePerSqFt")?.amount).toBe(-220_000);
  });
});

describe("computeDebtService", () => {
  it("amortizes monthly", () => {
    const d = computeDebtService(SBA_REFERENCE_LOAN);
    expect(d.monthlyPayment).toBeCloseTo(16_653.075, 2);
    expect(d.annualDebtService).toBeCloseTo(d.monthlyPayment * 12, 9);
    expect(d.totalPaid).toBeCloseTo(d.monthlyPayment * 120, 9);
    expect(d.totalInterest).toBeCloseTo(d.totalPaid - 1_500_000, 9);
  });
  it("degrades to straight-line at a zero rate", () => {
    const d = computeDebtService({ principal: 1_200_000, termMonths: 120, annualRate: 0 });
    expect(d.monthlyPayment).toBe(10_000);
    expect(d.totalInterest).toBe(0);
  });
  it("returns zeros for no loan", () => {
    expect(computeDebtService({ principal: 0, termMonths: 120, annualRate: 0.06 }).annualDebtService).toBe(0);
    expect(computeDebtService({ principal: 1, termMonths: 0, annualRate: 0.06 }).annualDebtService).toBe(0);
  });
});

describe("computeDscr", () => {
  it("divides EBITDA by debt service", () => {
    expect(computeDscr(400_000, 200_000)).toBe(2);
  });
  it("is null with no debt", () => {
    expect(computeDscr(400_000, 0)).toBeNull();
  });
});

describe("computeCapitalStack", () => {
  it("totals sources and uses", () => {
    const s = computeCapitalStack(ROUND_ONE);
    expect(s.key).toBe("round1");
    expect(s.totalSources).toBe(3_200_000);
    expect(s.totalUses).toBe(3_200_000);
    expect(s.unallocated).toBe(0);
    expect(s.sources).toBe(ROUND_ONE.sources);
  });
  it("reports unallocated capital", () => {
    const s = computeCapitalStack({ key: "x", sources: [{ key: "a", amount: 100 }], uses: [{ key: "b", amount: 60 }] });
    expect(s.unallocated).toBe(40);
  });
});

describe("computeDilution", () => {
  const OWNERS = [
    { key: "dano", pct: 0.49 },
    { key: "kristy", pct: 0.51 },
  ];
  it("dilutes existing owners pro rata", () => {
    const d = computeDilution(8_000_000, 1_500_000, OWNERS);
    expect(d.postMoneyValuation).toBe(9_500_000);
    expect(d.newInvestorPct).toBeCloseTo(1.5 / 9.5, 9);
    expect(d.owners[0]).toEqual({ key: "dano", pctBefore: 0.49, pctAfter: 0.49 * (8 / 9.5) });
    const total = d.newInvestorPct + d.owners.reduce((s, o) => s + o.pctAfter, 0);
    expect(total).toBeCloseTo(1, 9);
  });
  it("rejects nonsense inputs", () => {
    expect(() => computeDilution(0, 1, OWNERS)).toThrow(RangeError);
    expect(() => computeDilution(1, -1, OWNERS)).toThrow(RangeError);
  });
});
