/**
 * Spec drift tests (superseded by the 2026-09-26 re-baseline).
 *
 * Anchors from docs/OH_BUSINESS_PLAN_BUILD_SPEC.md, verified by computation
 * against the presets frozen in assumptions/legacy-spec.ts. The live presets
 * were re-based on 2026-09-26 (see CHANGELOG.md and rebase-2026-09-26.test.ts);
 * these tests prove the engine still reproduces the spec's tables when fed
 * the spec's inputs, so a mechanical change to the engine cannot hide behind
 * an assumption change. If one of these fails, the engine drifted.
 */
import { describe, expect, it } from "vitest";
import {
  LEGACY_BASE,
  LEGACY_BASE_ASSUMPTIONS,
  LEGACY_CONSERVATIVE,
  LEGACY_FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  NO_DEBT,
  PARTNERSHIP_TERMS,
  SBA_REFERENCE_LOAN,
  OPENING_SCHEDULE,
  LEGACY_SCENARIOS,
  LEGACY_SUBSEQUENT_UNIT_OVERRIDES,
  MODEL_SNAPSHOTS,
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

describe("spec drift (superseded by the 2026-09-26 re-baseline): spec 5.4 revenue table", () => {
  const rows: Record<ScenarioKey, { covers: number; check: number; daily: number; annual: number; rsf: number }> = {
    conservative: { covers: 330, check: 24.1, daily: 7953, annual: 2_823_315, rsf: 806.66 },
    base: { covers: 450, check: 26.3, daily: 11_835, annual: 4_201_425, rsf: 1200.41 },
    aggressive: { covers: 600, check: 29.0, daily: 17_400, annual: 6_177_000, rsf: 1764.86 },
  };
  for (const key of Object.keys(rows) as ScenarioKey[]) {
    it(`${key} reproduces the table`, () => {
      const m = computeLocation(LEGACY_SCENARIOS[key].assumptions);
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

describe("spec drift (superseded by the 2026-09-26 re-baseline): spec 5.5 cost structure, base case at the $4.2M basis (2,080 hours per FTE)", () => {
  const m = computeLocation(LEGACY_BASE_ASSUMPTIONS);
  const pct: Record<CostLineKey, number> = {
    foodCost: 0.3,
    packaging: 0.025,
    memberProgram: 0,
    discountsComps: 0,
    labor: 0.139, // spec prints 12.8% at 1,850 hours; owner chose the 2,080-hour CPA convention
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
    communityGiving: 0, // 2026-09-27 pledge; not in the spec
  };
  // Table amounts. Labor is the one line that departs from the spec: the spec
  // prints $537,000 (1,850 hours); at 2,080 hours it is $582,259.20.
  const amount: Record<CostLineKey, number> = {
    foodCost: 1_260_000,
    packaging: 105_000,
    memberProgram: 0,
    discountsComps: 0,
    labor: 582_259.2,
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
    communityGiving: 0,
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
    expect(opexAtBasis).toBeCloseTo(1_587_159.2, 0); // spec prints 1,541,900 at 1,850 hours
    expect(2_835_000 - opexAtBasis).toBeCloseTo(1_247_840.8, 0); // spec prints 1,293,100
    expect(m.totalOpexPct).toBeCloseTo(0.378, 3);
    expect(m.ebitdaMarginPct).toBeCloseTo(0.297, 3);
  });

  it("golden: exact-revenue EBITDA (pins the day count and hours)", () => {
    expect(m.annualRevenue).toBeCloseTo(4_201_425, 6);
    expect(m.ebitda).toBeCloseTo(1_248_529.075, 3);
  });

  it("traditional comparison keeps the spec's benchmark column", () => {
    const rows = compareToTraditional(m);
    expect(rows.map((r) => r.traditional)).toEqual([0.3, 0.3, 0.08, 0.2, 0.12]);
    expect(rows.find((r) => r.key === "labor")?.oh).toBeCloseTo(0.139, 3);
    expect(rows.find((r) => r.key === "ebitda")?.oh).toBeCloseTo(0.297, 3);
  });
});

describe("spec drift (superseded by the 2026-09-26 re-baseline): spec 5.6 capital per location", () => {
  it("flagship nets $1,710,000", () => {
    const c = computeCapex(LEGACY_BASE_ASSUMPTIONS);
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
      launchMarketing: 0,
    });
  });
  it("locations 2 to 5 net $1,411,000", () => {
    const c = computeCapex(LEGACY_BASE_ASSUMPTIONS, LEGACY_SUBSEQUENT_UNIT_OVERRIDES);
    expect(c.total).toBe(1_411_000);
    const by = Object.fromEntries(c.lines.map((l) => [l.key, l.amount]));
    expect(by.podUnitCost).toBe(204_000);
    expect(by.buildoutPerSqFt).toBe(612_500);
    expect(by.tenantImprovementAllowancePerSqFt).toBe(-192_500);
  });
  it("unlevered payback is ~1.4 years at base (no debt in the base case)", () => {
    const u = computeUnit(LEGACY_BASE, { loan: NO_DEBT });
    expect(u.dscr).toBeNull();
    expect(u.ramp.payback.fromStabilization).toBeCloseTo(1_710_000 / 1_248_529.075, 6);
    // From opening through the ramp. The spec's "~2.3" does not reproduce; see DECISIONS.md.
    expect(u.ramp.payback.fromOpening).toBeCloseTo(1.4232, 3);
  });
  it("with the SBA reference loan, levered payback is ~1.6 years", () => {
    const u = computeUnit(LEGACY_BASE, { loan: SBA_REFERENCE_LOAN });
    expect(u.ramp.payback.fromStabilization).toBeCloseTo(1_710_000 / (1_248_529.075 - 199_836.9035), 4);
  });
});

describe("spec drift (superseded by the 2026-09-26 re-baseline): spec 5.7 ramp", () => {
  it("year 1 flagship revenue is ~$4.01M and year 2 ~$4.40M at base", () => {
    const r = computeRamp(LEGACY_BASE_ASSUMPTIONS);
    expect(r.years[0]?.revenue).toBeCloseTo(4_008_859.6875, 3);
    expect(r.years[1]?.revenue).toBeCloseTo(4_400_992.6875, 3);
  });
  it("keeps the month 4 to 6 trough", () => {
    const r = computeRamp(LEGACY_BASE_ASSUMPTIONS);
    const idx = r.months.slice(0, 12).map((m) => m.index);
    expect(Math.min(...idx)).toBe(0.78);
    expect(idx.indexOf(0.78)).toBe(5);
  });
});

describe("spec drift (superseded by the 2026-09-26 re-baseline): spec 5.8 portfolio rollup, five corporate units at T0+0/16/19/22/25", () => {
  const p = computePortfolio(OPENING_SCHEDULE, LEGACY_BASE, { years: 5, overhead: null });
  it("opens the flagship in year 1, three units in year 2 and the fifth in year 3", () => {
    expect(p.locations).toHaveLength(5);
    expect(p.years.map((y) => y.locationsOpenAtEnd)).toEqual([1, 4, 5, 5, 5]);
    expect(p.years[0]?.openings).toEqual(["lehi"]);
    expect(p.years[1]?.openings).toEqual(["slc", "south-jordan", "provo"]);
    expect(p.years[2]?.openings).toEqual(["st-george"]);
    expect(p.years[1]?.capexDeployed).toBe(3 * 1_411_000);
    expect(p.years[4]?.cumulativeCapex).toBe(1_710_000 + 4 * 1_411_000);
  });
  it("reproduces the spec table: ~$3.9M / $9.4M / $20.1M reads as $4.0M / $9.7M / $20.2M", () => {
    expect(Math.round(p.years[0]?.revenue ?? 0)).toBe(4_008_860);
    expect(Math.round(p.years[1]?.revenue ?? 0)).toBe(9_729_800);
    expect(Math.round(p.years[2]?.revenue ?? 0)).toBe(20_240_365);
  });
  it("US metros are franchise units in the spec's $5.5M to $6.5M AUV range", () => {
    const base = computeLocation(LEGACY_BASE_ASSUMPTIONS).annualRevenue;
    const metros = LEGACY_FRANCHISE_MARKETS.filter((m) => m.structure === "franchise");
    expect(metros.map((m) => m.key)).toEqual(["nyc", "la", "las-vegas", "seattle"]);
    for (const m of metros) {
      expect(base * m.auvIndex).toBeGreaterThanOrEqual(5_400_000);
      expect(base * m.auvIndex).toBeLessThanOrEqual(6_500_000);
      expect(m.territoryYear).toBe(4);
    }
  });
});

describe("spec drift (superseded by the 2026-09-26 re-baseline): spec 5.10 and 5.11 platform and capital", () => {
  it("platform license at 40 locations is $864K ARR", () => {
    expect(FRANCHISE_TERMS.platformLicenseMonthly * 12 * 40).toBe(864_000);
  });
  it("the SBA reference loan ($1.5M, 10 years, 6%) is ~$200K a year, kept as a lender lever", () => {
    const d = computeDebtService(SBA_REFERENCE_LOAN);
    expect(Math.round(d.annualDebtService)).toBe(199_837);
    expect(NO_DEBT.principal).toBe(0);
  });
  it("if a lender is ever in the room, DSCR clears 1.25x: ~6.2x base, ~2.9x conservative", () => {
    const ads = computeDebtService(SBA_REFERENCE_LOAN).annualDebtService;
    expect(computeDscr(computeLocation(LEGACY_BASE_ASSUMPTIONS).ebitda, ads)).toBeCloseTo(6.248, 2);
    expect(computeDscr(computeLocation(LEGACY_CONSERVATIVE.assumptions).ebitda, ads)).toBeCloseTo(2.917, 2);
  });
  it("conservative EBITDA is ~$583K at 2,080 hours (spec prose says ~$610K)", () => {
    expect(computeLocation(LEGACY_CONSERVATIVE.assumptions).ebitda).toBeCloseTo(582_901.945, 2);
  });
});

describe("spec drift (superseded by the 2026-09-26 re-baseline): single financial partner (owner decision 2026-09-25)", () => {
  // The 2026-09-25 partner math (45% at base, 3.02x, exit EBITDA $11.7M) ran on
  // unit EBITDA with no overhead and capitalized one-time fees. It cannot be
  // reproduced by the re-based engine and is recorded as the previous snapshot.
  it("is recorded as the 2026.09.25 snapshot, not recomputed", () => {
    const prev = MODEL_SNAPSHOTS.find((x) => x.version === "2026.09.25");
    expect(prev).toBeDefined();
    expect(prev?.totalCapital).toBe(10_700_000);
    expect(prev?.partnerPct).toBe(0.45);
    expect(prev?.partnerMultiple).toBeCloseTo(3.02, 2);
    expect(prev?.exitEbitda).toBe(11_741_284);
    expect(prev?.unitRevenue).toBe(4_201_425);
    expect(prev?.ebitdaMargin).toBeCloseTo(0.297, 3);
    expect(prev?.paybackFromOpening).toBeCloseTo(1.4232, 3);
  });
  it("still raises $10.7M in total: $3.2M round 1 and $7.5M round 2", () => {
    expect(PARTNERSHIP_TERMS.founderCapital + PARTNERSHIP_TERMS.partnerCapital).toBe(10_700_000);
  });
});
