import { describe, expect, it } from "vitest";
import {
  BASE,
  BASE_ASSUMPTIONS,
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  computeOwnership,
  roundToFivePct,
  type Scenario,
} from "../index";

const input = { scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };

describe("roundToFivePct", () => {
  it("rounds to the nearest 5% inside 0..1", () => {
    expect(roundToFivePct(0.5125)).toBe(0.5);
    expect(roundToFivePct(0.526)).toBe(0.55);
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
  it("reports the founder residual against the sweat-equity benchmark", () => {
    expect(computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, targetMultiple: 3.5 } }).founderVsBenchmark).toBe("within");
    expect(computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, targetMultiple: 6 } }).founderVsBenchmark).toBe("below");
    expect(computeOwnership(input).founderVsBenchmark).toBe("above");
  });
  it("gives the partner everything when the exit is worthless, and nothing when there is no partner capital", () => {
    const dark: Scenario = { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, utilizationRate: 0 } };
    const o = computeOwnership({ ...input, scenario: dark, markets: [] });
    expect(o.exitValue).toBeLessThan(0);
    expect(o.partnerPct).toBe(1);
    const free = computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerCapital: 0 } });
    expect(free.partnerPct).toBe(0);
    expect(free.partnerMultipleAtHeadline).toBe(0);
  });
  it("rejects an exit year outside the horizon", () => {
    expect(() => computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, exitYear: 0 } })).toThrow(RangeError);
  });
});
