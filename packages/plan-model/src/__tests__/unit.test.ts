import { describe, expect, it } from "vitest";
// Unit bundling on the frozen 2026-09-25 presets; the re-based unit is pinned in rebase-2026-09-26.test.ts.
import { LEGACY_BASE, LEGACY_BASE_ASSUMPTIONS, NO_DEBT, SBA_REFERENCE_LOAN, computeUnit } from "../index";

describe("computeUnit", () => {
  it("bundles the flagship story by default", () => {
    const u = computeUnit(LEGACY_BASE, { loan: SBA_REFERENCE_LOAN });
    expect(u.scenario).toBe("base");
    expect(u.flagship).toBe(true);
    expect(u.capex.total).toBe(1_710_000);
    expect(u.dscr).toBeCloseTo(6.248, 2);
    expect(u.ramp.months).toHaveLength(120);
    expect(u.ramp.payback.fromOpening).not.toBeNull();
    expect(u.depreciation.annual).toBeCloseTo(240_000 / 7 + 425_000 / 7 + 110_000 / 7 + 490_000 / 10 + 95_000 / 3 + 165_000 / 10, 6);
    expect(u.ramp.preOpening).toEqual([]);
  });
  it("uses subsequent-unit capex and a custom horizon", () => {
    const u = computeUnit(LEGACY_BASE, { loan: NO_DEBT, flagship: false, months: 24 });
    expect(u.dscr).toBeNull();
    expect(u.capex.total).toBe(1_411_000);
    expect(u.ramp.months).toHaveLength(24);
  });
  it("accepts slider state in place of the preset", () => {
    const u = computeUnit(LEGACY_BASE, { loan: { principal: 0, termMonths: 0, annualRate: 0 }, assumptions: { ...LEGACY_BASE_ASSUMPTIONS, utilizationRate: 0.4 } });
    expect(u.location.actualCoversPerDay).toBeCloseTo(600, 6);
    expect(u.dscr).toBeNull();
  });
});
