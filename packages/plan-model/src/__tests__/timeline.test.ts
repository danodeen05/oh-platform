import { describe, expect, it } from "vitest";
import { BASE, BASE_ASSUMPTIONS, FRANCHISE_MARKETS, OPENING_SCHEDULE, computeLocation, computeTimeline, franchiseOpenMonths } from "../index";

describe("franchiseOpenMonths", () => {
  it("spreads a year's openings across its months, sorted", () => {
    expect(franchiseOpenMonths({ 4: 1, 5: 1 })).toEqual([36, 48]);
    expect(franchiseOpenMonths({ 4: 3 })).toEqual([36, 40, 44]);
    expect(franchiseOpenMonths({ 5: 2, 4: 2 })).toEqual([36, 42, 48, 54]);
    expect(franchiseOpenMonths({})).toEqual([]);
  });
});

describe("computeTimeline", () => {
  const t = computeTimeline(OPENING_SCHEDULE, FRANCHISE_MARKETS, BASE);
  const base = computeLocation(BASE_ASSUMPTIONS);
  it("defaults to 72 months and lists every corporate and franchise unit", () => {
    expect(t.months).toHaveLength(72);
    const franchiseCount = FRANCHISE_MARKETS.reduce((s, m) => s + Object.values(m.unitsByYear).reduce((a, b) => a + b, 0), 0);
    expect(t.units).toHaveLength(OPENING_SCHEDULE.length + franchiseCount);
    expect(t.units.filter((u) => u.structure === "corporate").map((u) => u.key)).toEqual(OPENING_SCHEDULE.map((o) => o.key));
    expect(t.units.find((u) => u.key === "nyc-1")?.steadyRevenue).toBeCloseTo(base.annualRevenue * 1.5, 6);
  });
  it("opens the flagship at month 0 and counts pods, locations and run rate", () => {
    const m0 = t.months[0];
    expect(m0?.openings).toEqual(["lehi"]);
    expect(m0?.locationsOpen).toBe(1);
    expect(m0?.podsInService).toBe(75);
    expect(m0?.runRateRevenue).toBeCloseTo(base.annualRevenue * 1.18, 6);
    expect(m0?.cumulativeCovers).toBeCloseTo(base.actualCoversPerDay * (355 / 12) * 1.18, 6);
    expect(t.months[16]?.openings).toEqual(["slc"]);
    expect(t.months[35]?.corporateOpen).toBe(5);
    expect(t.months[35]?.franchiseOpen).toBe(0);
    expect(t.months[36]?.franchiseOpen).toBeGreaterThan(0);
    expect(t.months[71]?.locationsOpen).toBe(t.units.filter((u) => u.openMonth <= 71).length);
  });
  it("accumulates sales and covers monotonically", () => {
    for (let i = 1; i < t.months.length; i += 1) {
      expect(t.months[i]?.cumulativeSystemSales).toBeGreaterThan(t.months[i - 1]?.cumulativeSystemSales ?? 0);
      expect(t.months[i]?.cumulativeCovers).toBeGreaterThan(t.months[i - 1]?.cumulativeCovers ?? 0);
    }
  });
  it("handles a horizon shorter than the schedule and a unit opening after it", () => {
    const short = computeTimeline(OPENING_SCHEDULE, [], BASE, { months: 6 });
    expect(short.months).toHaveLength(6);
    expect(short.months[5]?.locationsOpen).toBe(1);
    const one = computeTimeline([{ ...OPENING_SCHEDULE[0]!, openMonth: 0 }], [], BASE, { months: 1 });
    expect(one.months[0]?.runRateRevenue).toBeCloseTo(base.annualRevenue * 1.18, 6);
  });
});
