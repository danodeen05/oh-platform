import { describe, expect, it } from "vitest";
import { BASE, BASE_ASSUMPTIONS, DEFAULT_LOAN, computeUnit } from "../index";

describe("computeUnit", () => {
  it("bundles the flagship story by default", () => {
    const u = computeUnit(BASE, { loan: DEFAULT_LOAN });
    expect(u.scenario).toBe("base");
    expect(u.flagship).toBe(true);
    expect(u.capex.total).toBe(1_710_000);
    expect(u.dscr).toBeCloseTo(6.476, 2);
    expect(u.ramp.months).toHaveLength(120);
    expect(u.ramp.payback.fromOpening).not.toBeNull();
  });
  it("uses subsequent-unit capex and a custom horizon", () => {
    const u = computeUnit(BASE, { loan: DEFAULT_LOAN, flagship: false, months: 24 });
    expect(u.capex.total).toBe(1_411_000);
    expect(u.ramp.months).toHaveLength(24);
  });
  it("accepts slider state in place of the preset", () => {
    const u = computeUnit(BASE, { loan: { principal: 0, termMonths: 0, annualRate: 0 }, assumptions: { ...BASE_ASSUMPTIONS, utilizationRate: 0.4 } });
    expect(u.location.actualCoversPerDay).toBeCloseTo(600, 6);
    expect(u.dscr).toBeNull();
  });
});
