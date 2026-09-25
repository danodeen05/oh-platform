import { describe, expect, it } from "vitest";
import { BASE, BASE_ASSUMPTIONS, OPENING_SCHEDULE, computeLocation, computePortfolio, locationAssumptions, type OpeningPlan } from "../index";

const lehi = OPENING_SCHEDULE[0] as OpeningPlan;
const nyc = OPENING_SCHEDULE.find((o) => o.key === "nyc") as OpeningPlan;

describe("locationAssumptions", () => {
  it("returns the scenario preset when there are no overrides", () => {
    expect(locationAssumptions(BASE, lehi)).toBe(BASE_ASSUMPTIONS);
  });
  it("layers market overrides", () => {
    const a = locationAssumptions(BASE, nyc);
    expect(a.rentPerSqFtAnnual).toBe(120);
    expect(a.pods).toBe(75);
  });
});

describe("computePortfolio", () => {
  const p = computePortfolio(OPENING_SCHEDULE, BASE);
  it("defaults to five years", () => {
    expect(p.years).toHaveLength(5);
    expect(p.locations).toHaveLength(OPENING_SCHEDULE.length);
  });
  it("uses flagship capex once and subsequent-unit capex elsewhere", () => {
    expect(p.locations[0]?.capex).toBe(1_710_000);
    expect(p.locations.slice(1).every((l) => l.capex === 1_411_000)).toBe(true);
  });
  it("counts pods and covers for open locations", () => {
    expect(p.years[0]?.podsAtEnd).toBe(300);
    expect(p.years[1]?.coversPerDayAtEnd).toBeCloseTo(450 * 5, 6);
    expect(p.years[2]?.openings).toEqual([]);
    expect(p.years[2]?.capexDeployed).toBe(0);
    expect(p.years[4]?.cumulativeCapex).toBe(1_710_000 + 8 * 1_411_000);
  });
  it("year 1 is the sum of each open unit's ramp months", () => {
    const monthly = 4_201_425 / 12;
    const curve = BASE_ASSUMPTIONS.rampCurve;
    const sum = (n: number) => curve.slice(0, n).reduce((s, x) => s + x, 0) * monthly;
    expect(p.years[0]?.revenue).toBeCloseTo(sum(12) + sum(8) + sum(5) + sum(2), 3);
  });
  it("steady EBITDA matches computeLocation with overrides", () => {
    const loc = p.locations.find((l) => l.key === "nyc");
    expect(loc?.steadyEbitda).toBeCloseTo(computeLocation(locationAssumptions(BASE, nyc)).ebitda, 6);
  });
  it("ignores locations that open after the horizon", () => {
    const one = computePortfolio(OPENING_SCHEDULE, BASE, { years: 1 });
    expect(one.years[0]?.locationsOpenAtEnd).toBe(4);
    expect(one.locations).toHaveLength(OPENING_SCHEDULE.length);
    expect(one.years[0]?.revenue).toBeCloseTo(p.years[0]?.revenue ?? 0, 6);
  });
  it("handles an empty schedule", () => {
    const none = computePortfolio([], BASE, { years: 2 });
    expect(none.years.map((y) => y.revenue)).toEqual([0, 0]);
  });
});
