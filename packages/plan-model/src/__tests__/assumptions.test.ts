import { describe, expect, it } from "vitest";
import {
  AGGRESSIVE,
  BASE,
  BASE_ASSUMPTIONS,
  CONSERVATIVE,
  FRANCHISE_MARKETS,
  FX_RATES,
  OPENING_SCHEDULE,
  OWNERS,
  RAMP_CURVE,
  ROUND_ONE,
  ROUND_TWO,
  SCENARIOS,
  SCENARIO_KEYS,
  computeCapitalStack,
  isScenarioKey,
} from "../index";

describe("scenario presets", () => {
  it("expose three keyed, frozen scenarios", () => {
    expect(SCENARIO_KEYS).toEqual(["conservative", "base", "aggressive"]);
    expect(SCENARIOS.base).toBe(BASE);
    expect(SCENARIOS.conservative).toBe(CONSERVATIVE);
    expect(SCENARIOS.aggressive).toBe(AGGRESSIVE);
    expect(Object.isFrozen(BASE_ASSUMPTIONS)).toBe(true);
    expect(Object.isFrozen(RAMP_CURVE)).toBe(true);
    for (const key of SCENARIO_KEYS) expect(SCENARIOS[key].key).toBe(key);
  });
  it("only utilization and check components differ from base", () => {
    const differing = (a: object, b: object) => {
      const ra = a as Record<string, unknown>;
      const rb = b as Record<string, unknown>;
      return Object.keys(ra).filter((k) => ra[k] !== rb[k]);
    };
    expect(differing(CONSERVATIVE.assumptions, BASE_ASSUMPTIONS).sort()).toEqual(
      ["addOnAttachRate", "avgAddOnSpend", "avgBeverageSpend", "avgBowlPrice", "beverageAttachRate", "retailAttachRate", "utilizationRate"].sort(),
    );
    expect(differing(AGGRESSIVE.assumptions, BASE_ASSUMPTIONS).sort()).toEqual(
      ["addOnAttachRate", "avgBowlPrice", "beverageAttachRate", "retailAttachRate", "utilizationRate"].sort(),
    );
  });
  it("isScenarioKey guards strings", () => {
    expect(isScenarioKey("base")).toBe(true);
    expect(isScenarioKey("BASE")).toBe(false);
    expect(isScenarioKey("")).toBe(false);
  });
  it("ramp curve has 18 months and ends at the plateau", () => {
    expect(RAMP_CURVE).toHaveLength(18);
    expect(RAMP_CURVE[17]).toBe(BASE_ASSUMPTIONS.rampPlateau);
  });
});

describe("reference data", () => {
  it("opening schedule is in date order with one flagship at T0", () => {
    const offsets = OPENING_SCHEDULE.map((o) => o.openMonth);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    expect(OPENING_SCHEDULE.filter((o) => o.flagship)).toHaveLength(1);
    expect(OPENING_SCHEDULE[0]?.openMonth).toBe(0);
    expect(OPENING_SCHEDULE.slice(0, 5).map((o) => o.openMonth)).toEqual([0, 4, 7, 10, 13]);
  });
  it("both rounds balance", () => {
    expect(computeCapitalStack(ROUND_ONE).totalSources).toBe(3_200_000);
    expect(computeCapitalStack(ROUND_ONE).unallocated).toBe(0);
    expect(computeCapitalStack(ROUND_TWO).totalSources).toBe(10_000_000);
    expect(computeCapitalStack(ROUND_TWO).unallocated).toBe(0);
  });
  it("owners sum to 100%", () => {
    expect(OWNERS.reduce((s, o) => s + o.pct, 0)).toBeCloseTo(1, 9);
  });
  it("territory fees sit in the spec's range and Paris is a sub-franchise", () => {
    for (const m of FRANCHISE_MARKETS) {
      if (m.structure === "sub-franchise") expect(m.territoryFee).toBe(0);
      else {
        expect(m.territoryFee).toBeGreaterThanOrEqual(250_000);
        expect(m.territoryFee).toBeLessThanOrEqual(750_000);
      }
    }
  });
  it("fx table covers every supported currency with a dated snapshot", () => {
    expect(Object.keys(FX_RATES.rates).sort()).toEqual(["AUD", "EUR", "GBP", "JPY", "SGD", "TWD", "USD"]);
    expect(FX_RATES.rates.USD).toBe(1);
    expect(FX_RATES.ratesAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
