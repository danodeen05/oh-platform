import { describe, expect, it } from "vitest";
import {
  BASE,
  BASE_ASSUMPTIONS,
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  SCENARIOS,
  computeOwnership,
  computeOwnershipImpact,
  ownershipImpactGrid,
  roundToFivePct,
  type Scenario,
} from "../index";

const input = { scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };

describe("roundToFivePct", () => {
  it("rounds up to the next 5% inside 0..1", () => {
    expect(roundToFivePct(0.4297)).toBe(0.45);
    expect(roundToFivePct(0.45)).toBe(0.45);
    expect(roundToFivePct(0.2701)).toBe(0.3);
    expect(roundToFivePct(-0.1)).toBe(0);
    expect(roundToFivePct(1.4)).toBe(1);
  });
});

describe("computeOwnership", () => {
  it("builds exit EBITDA from corporate units, platform gross profit and the franchise contribution", () => {
    const o = computeOwnership(input);
    expect(o.exitEbitda).toBeCloseTo(o.corporateEbitda + o.platformGrossProfit + o.franchiseContribution, 6);
    expect(o.exitValue).toBeCloseTo(o.exitEbitda * PARTNERSHIP_TERMS.exitMultiple, 6);
    expect(o.requiredExitValue).toBe(10_500_000 * 3);
    expect(o.owners.map((x) => x.key)).toEqual(["founder", "partner"]);
    expect(o.owners.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(1, 9);
    expect(o.terms).toBe(PARTNERSHIP_TERMS);
  });
  it("base case: 43% by the return math, 45% headline, under the owner's 49% cap", () => {
    const o = computeOwnership(input);
    expect(o.partnerPctReturnBased).toBeCloseTo(0.4297, 3);
    expect(o.partnerPct).toBe(0.45);
    expect(o.cappedByOwner).toBe(false);
    expect(o.founderPct).toBeCloseTo(0.55, 9);
    expect(o.partnerMultipleAtHeadline).toBeCloseTo(3.142, 2);
    expect(o.founderVsBenchmark).toBe("above");
    expect(Math.round(o.totalDistributions)).toBe(11_846_437);
  });
  it("conservative hits the 49% cap (partner ~2.0x); aggressive needs only 30%", () => {
    const c = computeOwnership({ ...input, scenario: SCENARIOS.conservative });
    expect(c.cappedByOwner).toBe(true);
    expect(c.partnerPct).toBe(0.49);
    expect(c.partnerMultipleAtHeadline).toBeLessThan(3);
    const a = computeOwnership({ ...input, scenario: SCENARIOS.aggressive });
    expect(a.partnerPct).toBe(0.3);
    expect(a.partnerMultipleAtHeadline).toBeGreaterThan(3);
  });
  it("reports the founder residual against the sweat-equity benchmark", () => {
    expect(computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, targetMultiple: 4.5, partnerPctCap: 1 } }).founderVsBenchmark).toBe("within");
    expect(computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, targetMultiple: 6, partnerPctCap: 1 } }).founderVsBenchmark).toBe("below");
  });
  it("gives the partner everything (before the cap) when the exit is worthless, and nothing without partner capital", () => {
    const dark: Scenario = { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, utilizationRate: 0 } };
    const o = computeOwnership({ ...input, scenario: dark, markets: [], terms: { ...PARTNERSHIP_TERMS, partnerPctCap: 1 } });
    expect(o.exitValue).toBeLessThan(0);
    expect(o.partnerPctReturnBased).toBe(1);
    expect(o.partnerPct).toBe(1);
    const free = computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerCapital: 0 } });
    expect(free.partnerPct).toBe(0);
    expect(free.partnerMultipleAtHeadline).toBe(0);
  });
  it("rejects an exit year outside the horizon", () => {
    expect(() => computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, exitYear: 0 } })).toThrow(RangeError);
  });
});

describe("computeOwnershipImpact", () => {
  it("defaults to the headline split and reconciles totals", () => {
    const i = computeOwnershipImpact(input);
    expect(i.partnerPct).toBe(0.45);
    expect(i.targetMultiple).toBe(3);
    expect(i.exitMultiple).toBe(5);
    expect(i.years).toHaveLength(5);
    const y1 = i.years[0];
    expect(y1?.distributions).toBeCloseTo(Math.max(0, y1?.corporateEbitda ?? 0) * 0.5, 6);
    expect((y1?.founderDistribution ?? 0) + (y1?.partnerDistribution ?? 0)).toBeCloseTo(y1?.distributions ?? 0, 6);
    expect(i.founderTotal).toBeCloseTo(i.founderCumulativeDistributions + i.founderExitProceeds, 6);
    expect(i.partnerTotal).toBeCloseTo(i.partnerCumulativeDistributions + i.partnerExitProceeds, 6);
    expect(i.partnerMultipleAtExit).toBeCloseTo(3.142, 2);
    expect(i.years[4]?.partnerMultipleToDate).toBeCloseTo(i.partnerCumulativeDistributions / 10_500_000, 9);
    expect(i.targetYearFromDistributions).toBeNull();
    expect(i.buyoutAtTarget).toBeCloseTo(31_500_000 - i.partnerCumulativeDistributions, 6);
    expect(i.buyoutVsMarket).toBeCloseTo(i.buyoutAtTarget / i.partnerExitProceeds, 9);
  });
  it("at the owner's 49% ceiling the partner clears 3x and the buyout is cheaper than the market stake", () => {
    const i = computeOwnershipImpact(input, { partnerPct: 0.49 });
    expect(i.partnerMultipleAtExit).toBeGreaterThan(3.4);
    expect(i.buyoutVsMarket).toBeLessThan(1);
    const five = computeOwnershipImpact(input, { partnerPct: 0.49, targetMultiple: 5 });
    expect(five.buyoutAtTarget).toBeCloseTo(i.buyoutAtTarget + 2 * 10_500_000, 6);
    expect(five.founderTotal).toBeCloseTo(i.founderTotal, 6);
  });
  it("giving up less ownership raises the founder's total and lowers the partner's multiple", () => {
    const a = computeOwnershipImpact(input, { partnerPct: 0.3 });
    const b = computeOwnershipImpact(input, { partnerPct: 0.49 });
    expect(a.founderTotal).toBeGreaterThan(b.founderTotal);
    expect(a.partnerMultipleAtExit).toBeLessThan(b.partnerMultipleAtExit);
    const bigExit = computeOwnershipImpact(input, { exitMultiple: 8 });
    expect(bigExit.exitValue).toBeCloseTo(computeOwnership(input).exitEbitda * 8, 6);
  });
  it("finds the year distributions alone repay the target when capital is small, and clamps the stake", () => {
    const small = computeOwnershipImpact({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerCapital: 500_000 } }, { partnerPct: 0.3 });
    expect(small.targetYearFromDistributions).toBe(3);
    expect(small.buyoutAtTarget).toBe(0);
    const none = computeOwnershipImpact({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerCapital: 0 } }, { partnerPct: 1.7 });
    expect(none.partnerPct).toBe(1);
    expect(none.partnerMultipleAtExit).toBe(0);
    expect(none.years[0]?.partnerMultipleToDate).toBe(0);
    const zero = computeOwnershipImpact(input, { partnerPct: -1 });
    expect(zero.partnerPct).toBe(0);
    expect(zero.buyoutVsMarket).toBe(0);
  });
  it("ignores loss years for distributions", () => {
    const dark: Scenario = { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, utilizationRate: 0 } };
    const i = computeOwnershipImpact({ ...input, scenario: dark, markets: [] });
    expect(i.years.every((y) => y.distributions === 0)).toBe(true);
  });
  it("builds a grid indexed [target][stake]", () => {
    const g = ownershipImpactGrid(input, [0.3, 0.49], [3, 5]);
    expect(g).toHaveLength(2);
    expect(g[0]).toHaveLength(2);
    expect(g[1]?.[1]?.partnerPct).toBe(0.49);
    expect(g[1]?.[1]?.targetMultiple).toBe(5);
  });
});
