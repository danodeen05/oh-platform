import { describe, expect, it } from "vitest";
import {
  BASE,
  BASE_ASSUMPTIONS,
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  HYBRID_EXIT_MULTIPLE,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  SCENARIOS,
  accruedPreference,
  computeCompany,
  computeOwnership,
  computeOwnershipImpact,
  computePreferred,
  ownershipImpactGrid,
  roundToFivePct,
  type PartnershipTerms,
  type Scenario,
} from "../index";

const input = { scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };

/** Terms with every 2026-09-26 optional field left out, to exercise the defaults. */
function bareTerms(): PartnershipTerms {
  const { taxDistributionRate: _t, recurringOnlyExit: _r, preferredReturnPct: _p, liquidationPreference: _l, partnerCapitalSchedule: _s, ...rest } = PARTNERSHIP_TERMS;
  void [_t, _r, _p, _l, _s];
  return rest;
}

describe("roundToFivePct", () => {
  it("rounds up to the next 5% inside 0..1", () => {
    expect(roundToFivePct(0.4297)).toBe(0.45);
    expect(roundToFivePct(0.45)).toBe(0.45);
    expect(roundToFivePct(0.2701)).toBe(0.3);
    expect(roundToFivePct(-0.1)).toBe(0);
    expect(roundToFivePct(1.4)).toBe(1);
  });
});

describe("accruedPreference", () => {
  it("accrues simple interest on each tranche from the year after it lands", () => {
    // $3.0M from year 2 (4 years) and $7.5M from year 3 (3 years) at 8% through year 5.
    expect(accruedPreference(PARTNERSHIP_TERMS, 5)).toBeCloseTo(3_000_000 * 0.08 * 4 + 7_500_000 * 0.08 * 3, 6);
    expect(accruedPreference(PARTNERSHIP_TERMS, 1)).toBe(0);
  });
  it("defaults to everything in year 1 at 8%", () => {
    expect(accruedPreference(bareTerms(), 5)).toBeCloseTo(10_500_000 * 0.08 * 4, 6);
  });
});

describe("computeOwnership (re-based 2026-09-26)", () => {
  const o = computeOwnership(input);
  it("builds exit EBITDA from unit EBITDA less overhead plus recurring franchise profit and platform gross profit", () => {
    expect(o.exitYear).toBe(5);
    expect(o.exitEbitda).toBeCloseTo(o.corporateEbitda - o.corporateOverhead + o.franchiseContribution + o.platformGrossProfit, 6);
    expect(o.exitValue).toBeCloseTo(o.exitEbitda * PARTNERSHIP_TERMS.exitMultiple, 6);
    expect(o.exitMultiple).toBe(5);
    expect(o.requiredExitValue).toBe(10_500_000 * 3);
    expect(o.owners.map((x) => x.key)).toEqual(["founder", "partner"]);
    expect(o.owners.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(1, 9);
    expect(o.terms).toBe(PARTNERSHIP_TERMS);
    expect(o.totalCapital).toBe(10_700_000);
  });
  it("base case, honestly: the return math wants 100%, the cap holds 49%, and the partner gets about 0.1x by year 5", () => {
    expect(Math.round(o.exitEbitda)).toBe(471_419);
    expect(o.partnerPctReturnBased).toBe(1);
    expect(o.partnerPct).toBe(0.49);
    expect(o.cappedByOwner).toBe(true);
    expect(o.founderPct).toBeCloseTo(0.51, 9);
    expect(o.partnerMultipleAtHeadline).toBeCloseTo(0.1331, 3);
    expect(o.impliedMultipleAtCap).toBe(o.partnerMultipleAtHeadline);
    expect(o.founderVsBenchmark).toBe("above");
    expect(Math.round(o.totalDistributions)).toBe(495_849);
  });
  it("year 7 at the hybrid multiple: eligible, 6x, still capped, partner about 0.9x on common and 1.6x preferred", () => {
    const y7 = computeOwnership(input, { exitYear: 7, hybrid: true });
    expect(y7.exitYear).toBe(7);
    expect(y7.hybridEligible).toBe(true);
    expect(y7.exitMultiple).toBe(HYBRID_EXIT_MULTIPLE);
    expect(Math.round(y7.exitEbitda)).toBe(2_819_051);
    expect(y7.cappedByOwner).toBe(true);
    expect(y7.partnerMultipleAtHeadline).toBeCloseTo(0.9162, 3);
    expect(y7.preferred.partnerCommonPct).toBe(0.49);
    expect(y7.preferred.partnerMultiple).toBeCloseTo(1.6419, 3);
    // Without the hybrid flag the plain multiple applies even though the share qualifies.
    expect(computeOwnership(input, { exitYear: 7 }).exitMultiple).toBe(5);
    // An explicit multiple wins over both.
    expect(computeOwnership(input, { exitYear: 7, hybrid: true, exitMultiple: 4 }).exitMultiple).toBe(4);
  });
  it("hybrid is gated on the recurring franchise share", () => {
    const noFranchise = computeOwnership({ ...input, markets: [] }, { hybrid: true });
    expect(noFranchise.recurringFranchiseShare).toBe(0);
    expect(noFranchise.hybridEligible).toBe(false);
    expect(noFranchise.exitMultiple).toBe(5);
  });
  it("conservative and aggressive are both capped; neither clears 3x", () => {
    const c = computeOwnership({ ...input, scenario: SCENARIOS.conservative });
    expect(c.cappedByOwner).toBe(true);
    expect(c.partnerPct).toBe(0.49);
    expect(c.exitEbitda).toBeLessThan(0);
    expect(c.founderVsBenchmark).toBe("above");
    const a = computeOwnership({ ...input, scenario: SCENARIOS.aggressive });
    expect(a.partnerPct).toBe(0.49);
    expect(a.cappedByOwner).toBe(true);
    expect(a.partnerMultipleAtHeadline).toBeGreaterThan(c.partnerMultipleAtHeadline);
    expect(a.partnerMultipleAtHeadline).toBeLessThan(3);
  });
  it("reports the founder residual against the sweat-equity benchmark when the cap is lifted", () => {
    const uncapped = computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerPctCap: 1 } });
    expect(uncapped.partnerPct).toBe(1);
    expect(uncapped.founderVsBenchmark).toBe("below");
    expect(uncapped.impliedMultipleAtCap).toBe(3);
    const modest = computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerPctCap: 1, partnerCapital: 500_000, targetMultiple: 1 } }, { exitYear: 7 });
    expect(modest.founderVsBenchmark).toBe("above");
    expect(modest.cappedByOwner).toBe(false);
    const within = computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerPctCap: 1, partnerCapital: 4_900_000 } }, { exitYear: 7, hybrid: true });
    expect(within.partnerPct).toBeGreaterThanOrEqual(0.6);
    expect(within.partnerPct).toBeLessThanOrEqual(0.75);
    expect(within.founderVsBenchmark).toBe("within");
  });
  it("can count one-time fees when recurringOnlyExit is off", () => {
    const all = computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, recurringOnlyExit: false } });
    expect(all.exitEbitda).toBeGreaterThan(o.exitEbitda);
    expect(all.franchiseContribution).toBeGreaterThan(o.franchiseContribution);
  });
  it("uses the defaults when the optional terms are missing", () => {
    const bare = computeOwnership({ ...input, terms: bareTerms() });
    expect(bare.preferred.preferredReturnPct).toBe(0.08);
    expect(bare.preferred.liquidationPreference).toBe(1);
    expect(bare.exitEbitda).toBeCloseTo(o.exitEbitda, 6);
  });
  it("gives the partner everything (before the cap) when the exit is worthless, and nothing without partner capital", () => {
    const dark: Scenario = { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, utilizationRate: 0 } };
    const d = computeOwnership({ ...input, scenario: dark, markets: [], terms: { ...PARTNERSHIP_TERMS, partnerPctCap: 1 } });
    expect(d.exitValue).toBeLessThan(0);
    expect(d.partnerPctReturnBased).toBe(1);
    expect(d.partnerPct).toBe(1);
    expect(d.preferred.partnerCommonPctReturnBased).toBe(1);
    expect(d.preferred.residualExitValue).toBe(0);
    const free = computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerCapital: 0, partnerCapitalSchedule: [] } });
    expect(free.partnerPct).toBe(0);
    expect(free.partnerMultipleAtHeadline).toBe(0);
    expect(free.preferred.partnerMultiple).toBe(0);
    const freeDark = computeOwnership({ ...input, scenario: dark, markets: [], terms: { ...PARTNERSHIP_TERMS, partnerCapital: 0, partnerCapitalSchedule: [] } });
    expect(freeDark.preferred.partnerCommonPctReturnBased).toBe(0);
  });
  it("rejects an exit year outside the horizon", () => {
    expect(() => computeOwnership({ ...input, terms: { ...PARTNERSHIP_TERMS, exitYear: 0 } })).toThrow(RangeError);
  });
});

describe("computePreferred", () => {
  it("pays the pref first from distributions, then the preference stack at the exit, then common", () => {
    const company = computeCompany(input, { years: 5 });
    const p = computePreferred(company, PARTNERSHIP_TERMS, 5, 3_228_188);
    expect(p.accruedPreference).toBeCloseTo(2_760_000, 6);
    expect(p.preferencePaidFromDistributions + p.commonDistributions).toBeCloseTo(company.years.reduce((s, y) => s + Math.max(0, y.freeCashFlow) * 0.5, 0), 6);
    expect(p.preferencePaidFromDistributions).toBeLessThan(p.accruedPreference);
    expect(p.preferencePaidAtExit).toBeCloseTo(p.accruedPreference - p.preferencePaidFromDistributions, 6);
    expect(p.liquidationPaid).toBeCloseTo(3_228_188 - p.preferencePaidAtExit, 6);
    expect(p.residualExitValue).toBe(0);
    expect(p.partnerCommonPct).toBe(0.49);
    expect(p.cappedByOwner).toBe(true);
    expect(p.founderCommonPct).toBeCloseTo(0.51, 9);
    expect(p.partnerTotal).toBeCloseTo(p.preferencePaidFromDistributions + p.preferencePaidAtExit + p.liquidationPaid, 6);
    expect(p.partnerMultiple).toBeCloseTo(p.partnerTotal / 10_500_000, 9);
  });
  it("with a rich exit the pref and preference are covered and the common stake is derived", () => {
    const company = computeCompany(input, { years: 5 });
    const p = computePreferred(company, PARTNERSHIP_TERMS, 5, 60_000_000);
    expect(p.liquidationPaid).toBe(10_500_000);
    expect(p.residualExitValue).toBeCloseTo(60_000_000 - 10_500_000 - p.preferencePaidAtExit, 6);
    expect(p.partnerCommonPctReturnBased).toBeLessThan(1);
    // 3x on $10.5M is $31.5M; the stack covers about $13.3M, the residual about $46.7M, so common needs about 39%.
    expect(p.partnerCommonPctReturnBased).toBeCloseTo((31_500_000 - 10_500_000 - p.preferencePaidAtExit - p.preferencePaidFromDistributions) / (p.commonDistributions + p.residualExitValue), 9);
    expect(p.cappedByOwner).toBe(false);
    expect(p.partnerCommonPct).toBe(0.4);
    expect(p.founderTotal).toBeCloseTo((p.commonDistributions + p.residualExitValue) * 0.6, 6);
    const small = computePreferred(company, { ...PARTNERSHIP_TERMS, partnerCapital: 1_000_000, partnerCapitalSchedule: [{ year: 1, amount: 1_000_000 }] }, 5, 60_000_000);
    expect(small.cappedByOwner).toBe(false);
    expect(small.partnerCommonPct).toBeLessThan(0.49);
    expect(small.partnerMultiple).toBeGreaterThanOrEqual(3);
  });
});

describe("computeOwnershipImpact", () => {
  it("defaults to the headline split and reconciles totals", () => {
    const i = computeOwnershipImpact(input);
    expect(i.partnerPct).toBe(0.49);
    expect(i.targetMultiple).toBe(3);
    expect(i.exitMultiple).toBe(5);
    expect(i.years).toHaveLength(5);
    const y5 = i.years[4];
    expect(y5?.distributable).toBeGreaterThan(0);
    expect(y5?.distributions).toBeCloseTo((y5?.distributable ?? 0) * 0.5, 6);
    expect(y5?.consolidatedEbitda).toBeLessThan(y5?.corporateEbitda ?? 0);
    expect((y5?.founderDistribution ?? 0) + (y5?.partnerDistribution ?? 0)).toBeCloseTo(y5?.distributions ?? 0, 6);
    expect(i.founderTotal).toBeCloseTo(i.founderCumulativeDistributions + i.founderExitProceeds, 6);
    expect(i.partnerTotal).toBeCloseTo(i.partnerCumulativeDistributions + i.partnerExitProceeds, 6);
    expect(i.partnerMultipleAtExit).toBeCloseTo(0.1331, 3);
    expect(i.years[4]?.partnerMultipleToDate).toBeCloseTo(i.partnerCumulativeDistributions / 10_500_000, 9);
    expect(i.targetYearFromDistributions).toBeNull();
    expect(i.buyoutAtTarget).toBeCloseTo(31_500_000 - i.partnerCumulativeDistributions, 6);
    expect(i.buyoutVsMarket).toBeCloseTo(i.buyoutAtTarget / i.partnerExitProceeds, 9);
  });
  it("uses the default tax rate when the terms leave it out", () => {
    const bare = computeOwnershipImpact({ ...input, terms: bareTerms() });
    expect(bare.partnerMultipleAtExit).toBeCloseTo(computeOwnershipImpact(input).partnerMultipleAtExit, 9);
  });
  it("takes the exit year, multiple and hybrid flag", () => {
    const seven = computeOwnershipImpact(input, { exitYear: 7, hybrid: true });
    expect(seven.years).toHaveLength(7);
    expect(seven.exitMultiple).toBe(6);
    expect(seven.partnerMultipleAtExit).toBeCloseTo(0.9162, 3);
    const eight = computeOwnershipImpact(input, { exitMultiple: 8 });
    expect(eight.exitValue).toBeCloseTo(computeOwnership(input).exitEbitda * 8, 6);
  });
  it("giving up less ownership raises the founder's total and lowers the partner's multiple", () => {
    const a = computeOwnershipImpact(input, { partnerPct: 0.3 });
    const b = computeOwnershipImpact(input, { partnerPct: 0.49 });
    expect(a.founderTotal).toBeGreaterThan(b.founderTotal);
    expect(a.partnerMultipleAtExit).toBeLessThan(b.partnerMultipleAtExit);
    const five = computeOwnershipImpact(input, { partnerPct: 0.49, targetMultiple: 5 });
    expect(five.buyoutAtTarget).toBeCloseTo(b.buyoutAtTarget + 2 * 10_500_000, 6);
    expect(five.founderTotal).toBeCloseTo(b.founderTotal, 6);
  });
  it("finds the year distributions alone repay the target when capital is small, and clamps the stake", () => {
    const small = computeOwnershipImpact({ ...input, terms: { ...PARTNERSHIP_TERMS, partnerCapital: 50_000, targetMultiple: 1 } }, { partnerPct: 0.3 });
    expect(small.targetYearFromDistributions).toBe(5);
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
