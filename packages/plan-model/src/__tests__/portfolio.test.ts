import { describe, expect, it } from "vitest";
import { LEGACY_BASE, LEGACY_BASE_ASSUMPTIONS, OPENING_SCHEDULE, computeLocation, computePortfolio, locationAssumptions, type OpeningPlan } from "../index";
// Rollup mechanics on the frozen 2026-09-25 presets with overhead switched
// off, so the spec's revenue table reproduces. The consolidated rows, cash
// and overhead are covered in rebase-2026-09-26.test.ts.
const FOUR_WALL = { overhead: null } as const;

const lehi = OPENING_SCHEDULE[0] as OpeningPlan;
const metro: OpeningPlan = {
  key: "metro",
  name: "Metro test",
  region: "us-metro",
  openMonth: 36,
  flagship: false,
  structure: "corporate",
  overrides: { rentPerSqFtAnnual: 120, utilizationRate: 0.4 },
};

describe("locationAssumptions", () => {
  it("returns the scenario preset when there are no overrides", () => {
    expect(locationAssumptions(LEGACY_BASE, lehi)).toBe(LEGACY_BASE_ASSUMPTIONS);
  });
  it("layers market overrides", () => {
    const a = locationAssumptions(LEGACY_BASE, metro);
    expect(a.rentPerSqFtAnnual).toBe(120);
    expect(a.pods).toBe(75);
  });
});

describe("computePortfolio", () => {
  const p = computePortfolio(OPENING_SCHEDULE, LEGACY_BASE, FOUR_WALL);
  it("defaults to five years", () => {
    expect(p.years).toHaveLength(5);
    expect(p.locations).toHaveLength(OPENING_SCHEDULE.length);
  });
  it("uses flagship capex once and subsequent-unit capex elsewhere", () => {
    expect(p.locations[0]?.capex).toBe(1_710_000);
    expect(p.locations.slice(1).every((l) => l.capex === 1_411_000)).toBe(true);
  });
  it("counts pods and covers for open locations", () => {
    expect(p.years[0]?.podsAtEnd).toBe(75);
    expect(p.years[1]?.coversPerDayAtEnd).toBeCloseTo(450 * 4, 6);
    expect(p.years[3]?.openings).toEqual([]);
    expect(p.years[3]?.capexDeployed).toBe(0);
    expect(p.years[4]?.cumulativeCapex).toBe(1_710_000 + 4 * 1_411_000);
  });
  it("year 2 is the sum of each open unit's ramp months", () => {
    const monthly = 4_201_425 / 12;
    const curve = LEGACY_BASE_ASSUMPTIONS.rampCurve;
    const sum = (from: number, to: number) => curve.slice(from, to).reduce((s, x) => s + x, 0) * monthly;
    // Flagship months 13..24 (indexes 12..17 then plateau), SLC 8 months, South Jordan 5, Provo 2.
    const flagshipY2 = sum(12, 18) + 6 * 1.06 * monthly;
    expect(p.years[1]?.revenue).toBeCloseTo(flagshipY2 + sum(0, 8) + sum(0, 5) + sum(0, 2), 3);
  });
  it("applies overrides through to steady EBITDA and capex", () => {
    const withMetro = computePortfolio([lehi, metro], LEGACY_BASE, { years: 4, ...FOUR_WALL });
    const loc = withMetro.locations.find((l) => l.key === "metro");
    expect(loc?.steadyEbitda).toBeCloseTo(computeLocation(locationAssumptions(LEGACY_BASE, metro)).ebitda, 6);
    expect(withMetro.years[3]?.openings).toEqual(["metro"]);
    expect(withMetro.years[3]?.locationsOpenAtEnd).toBe(2);
  });
  it("ignores locations that open after the horizon", () => {
    const one = computePortfolio(OPENING_SCHEDULE, LEGACY_BASE, { years: 1, ...FOUR_WALL });
    expect(one.years[0]?.locationsOpenAtEnd).toBe(1);
    expect(one.locations).toHaveLength(OPENING_SCHEDULE.length);
    expect(one.years[0]?.revenue).toBeCloseTo(p.years[0]?.revenue ?? 0, 6);
  });
  it("handles an empty schedule", () => {
    const none = computePortfolio([], LEGACY_BASE, { years: 2, ...FOUR_WALL });
    expect(none.years.map((y) => y.revenue)).toEqual([0, 0]);
    expect(computePortfolio([], LEGACY_BASE, { years: 0 }).minimumCash).toBe(0);
  });
});
