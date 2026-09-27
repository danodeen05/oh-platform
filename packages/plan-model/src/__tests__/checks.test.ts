import { describe, expect, it } from "vitest";
import { BASE, BASE_ASSUMPTIONS, FRANCHISE_MARKETS, PARTNERSHIP_TERMS, invariantContext, invariantsPass, runInvariants, type InvariantContext, type Scenario } from "../index";

describe("runInvariants", () => {
  const results = runInvariants();
  it("every invariant passes on the live presets", () => {
    const failing = results.filter((r) => !r.pass).map((r) => `${r.key}: ${r.detail}`);
    expect(failing).toEqual([]);
    expect(invariantsPass()).toBe(true);
    expect(invariantsPass(results)).toBe(true);
    expect(results.map((r) => r.key)).toEqual([
      "cost-lines-sum",
      "capex-sums",
      "owners-sum-and-cap",
      "scenarios-ordered",
      "break-even-below-base",
      "rounds-balance",
      "ramp-shape",
      "schedule-sorted",
      "levers-in-bounds",
      "territory-fees-in-band",
      "fx-usd-one",
      "base-cash-positive",
    ]);
    for (const r of results) expect(r.detail.length).toBeGreaterThan(0);
  });
  it("catches a broken preset", () => {
    const ctx = invariantContext();
    const bad = (patch: Partial<InvariantContext>): Record<string, boolean> => Object.fromEntries(runInvariants({ ...ctx, ...patch }).map((r) => [r.key, r.pass]));
    // Scenarios out of order and break-even above base.
    const dark: Scenario = { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, utilizationRate: 0.05 } };
    const dim = bad({ scenarios: { ...ctx.scenarios, base: dark } });
    expect(dim["scenarios-ordered"]).toBe(false);
    expect(dim["break-even-below-base"]).toBe(false);
    expect(dim["base-cash-positive"]).toBe(false);
    // Capex: later units dearer than the flagship.
    expect(bad({ scenarios: { ...ctx.scenarios, base: { ...BASE, subsequentUnitOverrides: { podUnitCost: 9000 } } } })["capex-sums"]).toBe(false);
    // Rounds and partner capital disagree.
    expect(bad({ terms: { ...PARTNERSHIP_TERMS, partnerCapital: 1 } })["rounds-balance"]).toBe(false);
    expect(bad({ rounds: [{ key: "x", sources: [{ key: "partnerEquity", amount: 10_500_000 }], uses: [] }] })["rounds-balance"]).toBe(false);
    const { partnerCapitalSchedule: _s, ...noSchedule } = PARTNERSHIP_TERMS;
    void _s;
    expect(bad({ terms: noSchedule })["rounds-balance"]).toBe(true);
    // Ramp: no trough, wrong plateau, empty curve.
    expect(bad({ scenarios: { ...ctx.scenarios, base: { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, rampCurve: new Array<number>(12).fill(1) } } } })["ramp-shape"]).toBe(false);
    expect(bad({ scenarios: { ...ctx.scenarios, base: { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, rampPlateau: 1.2 } } } })["ramp-shape"]).toBe(false);
    expect(bad({ scenarios: { ...ctx.scenarios, base: { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, rampCurve: [] } } } })["ramp-shape"]).toBe(false);
    // Schedule: two flagships, out of order, flagship not at T0.
    const lehi = ctx.schedule[0]!;
    expect(bad({ schedule: [lehi, { ...lehi, key: "x", openMonth: 3 }] })["schedule-sorted"]).toBe(false);
    expect(bad({ schedule: [{ ...lehi, openMonth: 5 }, { ...lehi, key: "y", flagship: false, openMonth: 2 }] })["schedule-sorted"]).toBe(false);
    expect(bad({ schedule: [{ ...lehi, openMonth: 5 }] })["schedule-sorted"]).toBe(false);
    // Levers out of bounds.
    expect(bad({ scenarios: { ...ctx.scenarios, base: { ...BASE, assumptions: { ...BASE_ASSUMPTIONS, pods: 9999 } } } })["levers-in-bounds"]).toBe(false);
    // Territory fees.
    const tokyo = FRANCHISE_MARKETS.find((m) => m.key === "tokyo")!;
    expect(bad({ markets: [{ ...tokyo, territoryFee: 1 }] })["territory-fees-in-band"]).toBe(false);
    expect(bad({ markets: [{ ...tokyo, structure: "sub-franchise" }] })["territory-fees-in-band"]).toBe(false);
    expect(bad({ markets: [{ ...tokyo, structure: "franchise" }] })["territory-fees-in-band"]).toBe(false);
    // FX.
    expect(bad({ fx: { ratesAsOf: "2026-01-01", rates: { ...ctx.fx.rates, USD: 2 } } })["fx-usd-one"]).toBe(false);
    // Owners: a cap the preferred construct also respects.
    expect(bad({ terms: { ...PARTNERSHIP_TERMS, partnerPctCap: 0.3 } })["owners-sum-and-cap"]).toBe(true);
  });
});
