/**
 * Anchors from docs/OH_BUSINESS_PLAN_BUILD_SPEC.md, verified by computation.
 * If one of these fails, either the spec changed or the engine drifted; both
 * need a human before anything reaches an investor.
 */
import { describe, expect, it } from "vitest";
import {
  BASE,
  BASE_ASSUMPTIONS,
  CONSERVATIVE,
  DEFAULT_LOAN,
  FRANCHISE_TERMS,
  OPENING_SCHEDULE,
  SCENARIOS,
  SUBSEQUENT_UNIT_OVERRIDES,
  compareToTraditional,
  computeCapex,
  computeDebtService,
  computeDscr,
  computeLocation,
  computePortfolio,
  computeRamp,
  computeUnit,
  type CostLineKey,
  type ScenarioKey,
} from "../index";

const BASIS = 4_200_000;

describe("spec 5.4 revenue table", () => {
  const rows: Record<ScenarioKey, { covers: number; check: number; daily: number; annual: number; rsf: number }> = {
    conservative: { covers: 330, check: 24.1, daily: 7953, annual: 2_823_315, rsf: 806.66 },
    base: { covers: 450, check: 26.3, daily: 11_835, annual: 4_201_425, rsf: 1200.41 },
    aggressive: { covers: 600, check: 29.0, daily: 17_400, annual: 6_177_000, rsf: 1764.86 },
  };
  for (const key of Object.keys(rows) as ScenarioKey[]) {
    it(`${key} reproduces the table`, () => {
      const m = computeLocation(SCENARIOS[key].assumptions);
      const r = rows[key];
      expect(m.cycleMinutes).toBe(30);
      expect(m.turnsPerPodPerDay).toBe(20);
      expect(m.theoreticalCoversPerDay).toBe(1500);
      expect(m.actualCoversPerDay).toBeCloseTo(r.covers, 6);
      expect(m.avgCheck).toBeCloseTo(r.check, 6);
      expect(m.dailyRevenue).toBeCloseTo(r.daily, 6);
      expect(m.annualRevenue).toBeCloseTo(r.annual, 6);
      expect(m.revenuePerSqFt).toBeCloseTo(r.rsf, 2);
    });
  }
});

describe("spec 5.5 cost structure, base case at the $4.2M basis", () => {
  const m = computeLocation(BASE_ASSUMPTIONS);
  const pct: Record<CostLineKey, number> = {
    foodCost: 0.3,
    packaging: 0.025,
    labor: 0.128,
    occupancy: 0.036,
    utilities: 0.03,
    paymentProcessing: 0.027,
    marketing: 0.03,
    techPlatform: 0.018,
    supplies: 0.022,
    repairsMaint: 0.02,
    insurance: 0.011,
    ga: 0.025,
    contingency: 0.02,
  };
  // Table amounts. Labor prints as $537,000 in the spec, which is $536,664
  // rounded to the nearest thousand; the engine value is the exact one.
  const amount: Record<CostLineKey, number> = {
    foodCost: 1_260_000,
    packaging: 105_000,
    labor: 536_664,
    occupancy: 150_500,
    utilities: 126_000,
    paymentProcessing: 113_400,
    marketing: 126_000,
    techPlatform: 75_600,
    supplies: 92_400,
    repairsMaint: 84_000,
    insurance: 48_000,
    ga: 105_000,
    contingency: 84_000,
  };
  /** Rescale variable lines to the table's rounded revenue basis; fixed lines are unchanged. */
  const atBasis = (key: CostLineKey): number => {
    const line = m.lines.find((l) => l.key === key);
    if (!line) throw new Error(key);
    return line.fixed ? line.amount : line.pct * BASIS;
  };

  for (const key of Object.keys(pct) as CostLineKey[]) {
    it(`${key} is ${(pct[key] * 100).toFixed(1)}% and $${amount[key].toLocaleString()}`, () => {
      const line = m.lines.find((l) => l.key === key);
      expect(line).toBeDefined();
      expect(line?.pct).toBeCloseTo(pct[key], 3);
      expect(atBasis(key)).toBeCloseTo(amount[key], 0);
    });
  }

  it("gross profit is 67.5% / $2,835,000", () => {
    expect(m.grossMarginPct).toBeCloseTo(0.675, 6);
    expect(m.grossMarginPct * BASIS).toBeCloseTo(2_835_000, 6);
  });

  it("total opex and EBITDA follow from the exact labor line", () => {
    const opexAtBasis = m.lines.filter((l) => l.group === "opex").reduce((s, l) => s + (l.fixed ? l.amount : l.pct * BASIS), 0);
    expect(opexAtBasis).toBeCloseTo(1_541_564, 0); // spec prints 1,541,900 with rounded labor
    expect(2_835_000 - opexAtBasis).toBeCloseTo(1_293_436, 0); // spec prints 1,293,100
    expect(m.totalOpexPct).toBeCloseTo(0.367, 3);
    expect(m.ebitdaMarginPct).toBeCloseTo(0.308, 3);
  });

  it("golden: exact-revenue EBITDA (pins the day count and hours)", () => {
    expect(m.annualRevenue).toBeCloseTo(4_201_425, 6);
    expect(m.ebitda).toBeCloseTo(1_294_124.275, 3);
  });

  it("traditional comparison keeps the spec's benchmark column", () => {
    const rows = compareToTraditional(m);
    expect(rows.map((r) => r.traditional)).toEqual([0.3, 0.3, 0.08, 0.2, 0.12]);
    expect(rows.find((r) => r.key === "labor")?.oh).toBeCloseTo(0.128, 3);
    expect(rows.find((r) => r.key === "ebitda")?.oh).toBeCloseTo(0.308, 3);
  });
});

describe("spec 5.6 capital per location", () => {
  it("flagship nets $1,710,000", () => {
    const c = computeCapex(BASE_ASSUMPTIONS);
    expect(c.total).toBe(1_710_000);
    const by = Object.fromEntries(c.lines.map((l) => [l.key, l.amount]));
    expect(by).toEqual({
      podUnitCost: 240_000,
      kitchenEquipment: 425_000,
      buildoutPerSqFt: 682_500,
      tenantImprovementAllowancePerSqFt: -192_500,
      techHardware: 95_000,
      designArchPermits: 165_000,
      ffeSignage: 110_000,
      preOpening: 185_000,
    });
  });
  it("locations 2 to 5 net $1,411,000", () => {
    const c = computeCapex(BASE_ASSUMPTIONS, SUBSEQUENT_UNIT_OVERRIDES);
    expect(c.total).toBe(1_411_000);
    const by = Object.fromEntries(c.lines.map((l) => [l.key, l.amount]));
    expect(by.podUnitCost).toBe(204_000);
    expect(by.buildoutPerSqFt).toBe(612_500);
    expect(by.tenantImprovementAllowancePerSqFt).toBe(-192_500);
  });
  it("payback from stabilization is ~1.6 years at base", () => {
    const u = computeUnit(BASE, { loan: DEFAULT_LOAN });
    expect(u.ramp.payback.fromStabilization).toBeCloseTo(1.5627, 3);
    // From opening through the ramp (levered). The spec's "~2.3" does not reproduce; see DECISIONS.md.
    expect(u.ramp.payback.fromOpening).toBeCloseTo(1.6037, 3);
  });
});

describe("spec 5.7 ramp", () => {
  it("year 1 flagship revenue is ~$4.01M and year 2 ~$4.40M at base", () => {
    const r = computeRamp(BASE_ASSUMPTIONS);
    expect(r.years[0]?.revenue).toBeCloseTo(4_008_859.6875, 3);
    expect(r.years[1]?.revenue).toBeCloseTo(4_400_992.6875, 3);
  });
  it("keeps the month 4 to 6 trough", () => {
    const r = computeRamp(BASE_ASSUMPTIONS);
    const idx = r.months.slice(0, 12).map((m) => m.index);
    expect(Math.min(...idx)).toBe(0.78);
    expect(idx.indexOf(0.78)).toBe(5);
  });
});

describe("spec 5.8 portfolio rollup with the spec's offsets", () => {
  const p = computePortfolio(OPENING_SCHEDULE, BASE, { years: 5 });
  it("opens four units in year 1 and the fifth in year 2", () => {
    expect(p.years.map((y) => y.locationsOpenAtEnd)).toEqual([4, 5, 5, 9, 9]);
    expect(p.years[0]?.openings).toEqual(["lehi", "slc", "south-jordan", "provo"]);
    expect(p.years[1]?.openings).toEqual(["st-george"]);
    expect(p.years[0]?.capexDeployed).toBe(1_710_000 + 3 * 1_411_000);
  });
  it("corporate revenue is ~$9.3M / $20.2M / $22.2M (engine wins over the spec's 3.9 / 9.4 / 20.1; see DECISIONS.md)", () => {
    expect(Math.round(p.years[0]?.revenue ?? 0)).toBe(9_337_667);
    expect(Math.round(p.years[1]?.revenue ?? 0)).toBe(20_187_847);
    expect(Math.round(p.years[2]?.revenue ?? 0)).toBe(22_173_020);
  });
  it("US metros land in the spec's $5.5M to $6.5M AUV range", () => {
    for (const loc of p.locations.filter((l) => l.openMonth >= 36)) {
      expect(loc.steadyRevenue).toBeGreaterThanOrEqual(5_500_000);
      expect(loc.steadyRevenue).toBeLessThanOrEqual(6_500_000);
    }
    expect(p.years[3]?.revenue).toBeGreaterThan(30_000_000);
    expect(p.years[3]?.revenue).toBeLessThan(40_000_000);
  });
});

describe("spec 5.10 and 5.11 platform and capital stack", () => {
  it("platform license at 40 locations is $864K ARR", () => {
    expect(FRANCHISE_TERMS.platformLicenseMonthly * 12 * 40).toBe(864_000);
  });
  it("SBA $1.5M over 10 years at 6% is ~$200K a year", () => {
    const d = computeDebtService(DEFAULT_LOAN);
    expect(Math.round(d.annualDebtService)).toBe(199_837);
  });
  it("DSCR clears 1.25x with room: ~6.5x base, ~3.1x conservative", () => {
    const ads = computeDebtService(DEFAULT_LOAN).annualDebtService;
    expect(computeDscr(computeLocation(BASE_ASSUMPTIONS).ebitda, ads)).toBeCloseTo(6.476, 2);
    expect(computeDscr(computeLocation(CONSERVATIVE.assumptions).ebitda, ads)).toBeCloseTo(3.145, 2);
  });
  it("conservative EBITDA is ~$628K (spec prose says ~$610K; engine wins)", () => {
    expect(computeLocation(CONSERVATIVE.assumptions).ebitda).toBeCloseTo(628_497.145, 2);
  });
});
