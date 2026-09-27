/**
 * Golden numbers of the 2026-09-26 re-baseline, pinned to whole dollars.
 * If one of these moves, a preset or a formula changed: bump MODEL_VERSION,
 * add the change to changelog.ts and a new snapshot, then re-pin here.
 *
 * Re-pinned 2026-09-27 for the community giving pledge (1% of revenue to
 * ONE RED STEP AT A TIME, an opex line). Revenue, check, labor and capex do
 * not move; every EBITDA-driven figure falls by exactly 1% of revenue.
 */
import { describe, expect, it } from "vitest";
import {
  AGGRESSIVE,
  BASE,
  BASE_ASSUMPTIONS,
  CONSERVATIVE,
  DEFAULT_EQUITY_BY_YEAR,
  DEFAULT_INVESTMENTS_BY_YEAR,
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  LEAN_OVERHEAD,
  MATURITY_EBITDA_TARGET,
  MENU_BASE,
  MENU_CURRENT_PRICES,
  MODEL_VERSION,
  NO_DEBT,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  PUBLIC_EBITDA_TARGET,
  SCENARIOS,
  SHARE_VERSION,
  SUBSEQUENT_UNIT_OVERRIDES,
  computeCapex,
  computeCompany,
  computeLocation,
  computeMenu,
  computeOwnership,
  computePortfolio,
  computeTimeline,
  computeUnit,
  type ScenarioKey,
} from "../index";

const R = (n: number): number => Math.round(n);

describe("re-baseline 2026-09-26: unit economics", () => {
  const rows: Record<ScenarioKey, { covers: number; check: number; revenue: number; rsf: number; food: number; labor: number; laborPct: number; ebitda: number; margin: number; breakEven: number; fte: number }> = {
    conservative: { covers: 330, check: 20.776, revenue: 2_145_953, rsf: 613.1, food: 0.3649, labor: 741_126, laborPct: 0.3454, ebitda: -99_278, margin: -0.0463, breakEven: 367.6, fte: 11 },
    base: { covers: 450, check: 23.176, revenue: 3_264_340, rsf: 932.7, food: 0.3271, labor: 778_428, laborPct: 0.2385, ebitda: 440_367, margin: 0.1349, breakEven: 313.1, fte: 11.7 },
    aggressive: { covers: 600, check: 23.176, revenue: 4_352_453, rsf: 1243.6, food: 0.3271, labor: 863_692, laborPct: 0.1984, ebitda: 837_535, margin: 0.1924, breakEven: 339.6, fte: 13.3 },
  };
  for (const key of Object.keys(rows) as ScenarioKey[]) {
    it(`${key}: 313 days, menu-derived check, coverage-derived labor`, () => {
      const a = SCENARIOS[key].assumptions;
      const m = computeLocation(a);
      const r = rows[key];
      expect(a.operatingDaysPerYear).toBe(313);
      expect(a.kitchenFTE).toBe(r.fte);
      expect(m.actualCoversPerDay).toBeCloseTo(r.covers, 6);
      expect(m.avgCheck).toBeCloseTo(r.check, 3);
      expect(R(m.annualRevenue)).toBe(r.revenue);
      expect(m.revenuePerSqFt).toBeCloseTo(r.rsf, 1);
      expect(a.foodCostPct).toBeCloseTo(r.food, 4);
      expect(R(m.labor)).toBe(r.labor);
      expect(m.laborPct).toBeCloseTo(r.laborPct, 4);
      expect(R(m.ebitda)).toBe(r.ebitda);
      expect(m.ebitdaMarginPct).toBeCloseTo(r.margin, 4);
      expect(m.breakEvenCoversPerDay).toBeCloseTo(r.breakEven, 1);
    });
  }
  it("base cost lines carry the new layers", () => {
    const m = computeLocation(BASE_ASSUMPTIONS);
    const pct = Object.fromEntries(m.lines.map((l) => [l.key, Number(l.pct.toFixed(4))]));
    expect(pct).toEqual({
      foodCost: 0.3271,
      packaging: 0.025,
      memberProgram: 0.0232,
      discountsComps: 0.015,
      labor: 0.2385,
      occupancy: 0.0461,
      utilities: 0.025,
      paymentProcessing: 0.0325,
      marketing: 0.03,
      techPlatform: 0.018,
      supplies: 0.015,
      repairsMaint: 0.02,
      insurance: 0.0147,
      ga: 0.015,
      contingency: 0.01,
      communityGiving: 0.01,
    });
    expect(m.memberProgram).toBeCloseTo(m.annualRevenue * 0.014 + 30_000, 6);
    expect(m.paymentProcessing).toBeCloseTo(m.annualRevenue * 0.03 * 1.0835, 6);
    expect(m.communityGiving).toBeCloseTo(m.annualRevenue * 0.01, 6);
  });
  it("the giving pledge is 1% of revenue in every scenario, an opex line that moves with sales", () => {
    for (const key of Object.keys(SCENARIOS) as ScenarioKey[]) {
      const a = SCENARIOS[key].assumptions;
      const m = computeLocation(a);
      expect(a.communityGivingPct).toBe(0.01);
      expect(m.communityGiving).toBeCloseTo(m.annualRevenue * 0.01, 6);
      const line = m.lines.find((l) => l.key === "communityGiving");
      expect(line).toMatchObject({ group: "opex", fixed: false, pct: 0.01 });
    }
    expect(R(computeLocation(BASE_ASSUMPTIONS).communityGiving)).toBe(32_643);
  });
  it("the public target is 15% with a 20% stretch; with the pledge the base sits below the target and the plan says so", () => {
    expect(PUBLIC_EBITDA_TARGET).toBe(0.15);
    expect(MATURITY_EBITDA_TARGET).toBe(0.2);
    const base = computeLocation(BASE_ASSUMPTIONS).ebitdaMarginPct;
    expect(base).toBeGreaterThan(0.13);
    expect(base).toBeLessThan(PUBLIC_EBITDA_TARGET);
    // Aggressive lands just under the stretch once the pledge is paid.
    expect(computeLocation(AGGRESSIVE.assumptions).ebitdaMarginPct).toBeGreaterThan(PUBLIC_EBITDA_TARGET);
    expect(computeLocation(AGGRESSIVE.assumptions).ebitdaMarginPct).toBeLessThan(MATURITY_EBITDA_TARGET);
  });
  it("the check and food cost come from the menu", () => {
    const reset = computeMenu(MENU_BASE);
    const current = computeMenu(MENU_CURRENT_PRICES);
    expect(BASE_ASSUMPTIONS.avgBowlPrice).toBe(reset.blendedBowlPrice);
    expect(BASE_ASSUMPTIONS.foodCostPct).toBe(reset.foodCostPct);
    expect(CONSERVATIVE.assumptions.avgBowlPrice).toBe(current.blendedBowlPrice);
    expect(CONSERVATIVE.assumptions.foodCostPct).toBe(current.foodCostPct);
    expect(computeLocation(BASE_ASSUMPTIONS).avgCheck).toBeCloseTo(reset.check, 9);
  });
});

describe("re-baseline 2026-09-26: capex, payback and ramp", () => {
  it("capex totals hold with launch marketing split from pre-opening", () => {
    const flag = computeCapex(BASE_ASSUMPTIONS);
    const later = computeCapex(BASE_ASSUMPTIONS, SUBSEQUENT_UNIT_OVERRIDES);
    expect(flag.total).toBe(1_710_000);
    expect(later.total).toBe(1_411_000);
    expect(flag.lines.find((l) => l.key === "preOpening")?.amount).toBe(110_000);
    expect(flag.lines.find((l) => l.key === "launchMarketing")?.amount).toBe(75_000);
    expect(later.lines.find((l) => l.key === "preOpening")?.amount).toBe(90_000);
    expect(later.lines.find((l) => l.key === "launchMarketing")?.amount).toBe(50_000);
  });
  it("flagship payback: 3.9 years steady state, 4.7 from opening; units 2 to 5: 3.2 and 3.9", () => {
    const u = computeUnit(BASE, { loan: NO_DEBT });
    expect(u.ramp.payback.fromStabilization).toBeCloseTo(3.8831, 3);
    expect(u.ramp.payback.fromOpening).toBeCloseTo(4.7295, 3);
    const u2 = computeUnit(BASE, { loan: NO_DEBT, flagship: false });
    expect(u2.ramp.payback.fromStabilization).toBeCloseTo(3.2041, 3);
    expect(u2.ramp.payback.fromOpening).toBeCloseTo(3.939, 3);
    expect(u.ramp.preOpening).toHaveLength(3);
    expect(u.ramp.preOpening.map((m) => m.month)).toEqual([-3, -2, -1]);
    expect(u.ramp.preOpening.reduce((s, m) => s + m.ebitda, 0)).toBeCloseTo(-110_000, 6);
    expect(u.depreciation.annual).toBeCloseTo(207_881, 0);
  });
  it("year 1 of the flagship trades at 88.75% of steady state and year 2 grows with price", () => {
    const u = computeUnit(BASE, { loan: NO_DEBT });
    const steady = computeLocation(BASE_ASSUMPTIONS).annualRevenue;
    expect(u.ramp.years[0]?.revenue).toBeCloseTo(steady * (10.65 / 12), 3);
    expect(u.ramp.years[1]?.revenue).toBeCloseTo(steady * 1.025, 3);
    expect(u.ramp.years[1]?.maintenanceCapex).toBeCloseTo(steady * 1.025 * 0.015, 3);
    expect(u.ramp.years[0]?.maintenanceCapex).toBe(0);
  });
});

describe("re-baseline 2026-09-26: the company", () => {
  const c = computeCompany({ scenario: BASE, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS }, { years: 7 });
  it("five-year corporate table", () => {
    const table = c.years.slice(0, 5).map((y) => ({ year: y.year, revenue: R(y.corporateRevenue), unitEbitda: R(y.unitEbitda), overhead: R(y.corporateOverhead), consolidated: R(y.consolidatedEbitda), fcf: R(y.freeCashFlow), cash: R(y.cumulativeCash), franchise: y.franchiseLocations }));
    expect(table).toEqual([
      { year: 1, revenue: 2_897_101, unitEbitda: 277_546, overhead: 1_006_500, consolidated: -797_236, fcf: -2_997_236, cash: 202_764, franchise: 0 },
      { year: 2, revenue: 6_874_155, unitEbitda: 744_666, overhead: 1_499_500, consolidated: -985_846, fcf: -5_999_035, cash: 1_703_729, franchise: 0 },
      { year: 3, revenue: 15_400_202, unitEbitda: 1_753_882, overhead: 2_154_850, consolidated: -119_206, fcf: -1_554_386, cash: 149_343, franchise: 0 },
      { year: 4, revenue: 16_996_889, unitEbitda: 2_188_858, overhead: 2_669_750, consolidated: 424_978, fcf: 174_105, cash: 323_448, franchise: 2 },
      { year: 5, revenue: 17_421_811, unitEbitda: 2_178_026, overhead: 2_876_200, consolidated: 1_078_919, fcf: 817_592, cash: 1_141_041, franchise: 7 },
    ]);
  });
  it("cumulative cash never goes negative in the base case, seeded with the two rounds and the round uses", () => {
    expect(DEFAULT_EQUITY_BY_YEAR).toEqual({ 1: 3_200_000, 2: 7_500_000 });
    expect(DEFAULT_INVESTMENTS_BY_YEAR).toEqual({ 1: 600_000, 2: 1_000_000 });
    expect(c.years[0]?.equityRaised).toBe(3_200_000);
    expect(c.years[1]?.equityRaised).toBe(7_500_000);
    expect(c.years[0]?.investments).toBe(600_000);
    expect(c.minimumCash).toBeGreaterThan(0);
    // With the pledge the low point moves from the end of year 1 to the end of year 3.
    expect(R(c.minimumCash)).toBe(149_343);
    // The corporate units alone do not carry the HQ: without franchise and platform profit cash goes negative from year 3.
    expect(c.portfolio.minimumCash).toBeLessThan(0);
  });
  it("franchise units by year follow the phased schedule: 0, 0, 0, 2, 7, 15, 27", () => {
    expect(c.years.map((y) => y.franchiseLocations)).toEqual([0, 0, 0, 2, 7, 15, 27]);
    expect(c.platform.years[4]?.territoryFees).toBe(1_100_000);
    expect(R(c.years[4]?.systemWideSales ?? 0)).toBe(35_651_108);
    expect(R(c.years[6]?.recurringEbitda ?? 0)).toBe(2_819_051);
  });
  it("no tax distributions are due through year 7 because of the loss carryforward", () => {
    expect(c.years.every((y) => y.taxDistributions === 0)).toBe(true);
  });
  it("the lean overhead case keeps more cash", () => {
    const lean = computeCompany({ scenario: BASE, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS }, { overhead: LEAN_OVERHEAD });
    expect(lean.minimumCash).toBeGreaterThan(c.minimumCash);
    expect(R(lean.years[4]?.corporateOverhead ?? 0)).toBe(2_392_400);
  });
  it("the conservative case runs out of cash", () => {
    const cc = computeCompany({ scenario: CONSERVATIVE, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });
    expect(cc.minimumCash).toBeLessThan(0);
    expect(R(cc.minimumCash)).toBe(-9_068_256);
  });
  it("the portfolio's four-wall rows keep their meaning next to the consolidated rows", () => {
    const p = computePortfolio(OPENING_SCHEDULE, BASE);
    expect(p.years.map((y) => y.locationsOpenAtEnd)).toEqual([1, 4, 5, 5, 5]);
    expect(p.years[0]?.preOpeningExpense).toBe(110_000);
    // SLC, South Jordan and Provo burn fully inside year 2; St. George (month 25) burns months 22 and 23 in year 2 and month 24 in year 3.
    expect(p.years[1]?.preOpeningExpense).toBeCloseTo(90_000 * 3 + (90_000 * 2) / 3, 6);
    expect(p.years[2]?.preOpeningExpense).toBeCloseTo(90_000 / 3, 6);
    expect(p.years[1]?.growthCapex).toBe(3 * 1_411_000 - 3 * 90_000);
    expect(p.years[0]?.consolidatedEbitda).toBeCloseTo((p.years[0]?.ebitda ?? 0) - 110_000 - (p.years[0]?.corporateOverhead ?? 0), 6);
  });
  it("the timeline opens the first franchise unit in month 36", () => {
    const t = computeTimeline(OPENING_SCHEDULE, FRANCHISE_MARKETS, BASE, { months: 60 });
    expect(t.months[35]?.franchiseOpen).toBe(0);
    expect(t.months[36]?.franchiseOpen).toBe(2);
    expect(t.months[59]?.franchiseOpen).toBe(7);
    expect(t.months[0]?.runRateRevenue).toBeCloseTo(computeLocation(BASE_ASSUMPTIONS).annualRevenue * 0.7, 6);
  });
});

describe("re-baseline 2026-09-26: ownership, said plainly", () => {
  const input = { scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };
  it("year 5 at 5x: exit EBITDA $471K, cap binds at 49%, partner 0.13x common or 0.27x preferred", () => {
    const o = computeOwnership(input);
    expect(R(o.exitEbitda)).toBe(471_419);
    expect(R(o.exitValue)).toBe(2_357_097);
    expect(o.cappedByOwner).toBe(true);
    expect(o.partnerPct).toBe(0.49);
    expect(o.partnerMultipleAtHeadline).toBeCloseTo(0.1331, 3);
    expect(o.preferred.partnerMultiple).toBeCloseTo(0.2717, 3);
  });
  it("year 7 at the 6x hybrid: exit EBITDA $2.8M, cap binds, partner 0.92x common or 1.64x preferred", () => {
    const o = computeOwnership(input, { exitYear: 7, hybrid: true });
    expect(R(o.exitEbitda)).toBe(2_819_051);
    expect(R(o.exitValue)).toBe(16_914_305);
    expect(o.cappedByOwner).toBe(true);
    expect(o.partnerMultipleAtHeadline).toBeCloseTo(0.9162, 3);
    expect(o.preferred.partnerMultiple).toBeCloseTo(1.6419, 3);
  });
  it("versions", () => {
    expect(MODEL_VERSION).toBe("2026.09.27");
    expect(SHARE_VERSION).toBe(2);
  });
});
