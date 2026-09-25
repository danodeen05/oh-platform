import { describe, expect, it } from "vitest";
import { BASE_ASSUMPTIONS, LEVER_BOUNDS, LEVER_KEYS, clampLever, isLeverKey, isWithinBounds } from "../index";

describe("levers", () => {
  it("covers every numeric assumption except the ramp curve", () => {
    const numeric = Object.keys(BASE_ASSUMPTIONS).filter((k) => k !== "rampCurve").sort();
    expect([...LEVER_KEYS].sort()).toEqual(numeric);
    for (const key of LEVER_KEYS) {
      const b = LEVER_BOUNDS[key];
      expect(b.min).toBeLessThan(b.max);
      expect(b.step).toBeGreaterThan(0);
      expect(isWithinBounds(key, BASE_ASSUMPTIONS[key])).toBe(true);
    }
  });
  it("guards keys and bounds", () => {
    expect(isLeverKey("pods")).toBe(true);
    expect(isLeverKey("rampCurve")).toBe(false);
    expect(isLeverKey("toString")).toBe(false);
    expect(isWithinBounds("utilizationRate", 0.9)).toBe(false);
    expect(isWithinBounds("utilizationRate", Number.NaN)).toBe(false);
  });
  it("clamps and snaps to the step", () => {
    expect(clampLever("utilizationRate", 0.2549)).toBe(0.25);
    expect(clampLever("utilizationRate", 2)).toBe(0.8);
    expect(clampLever("pods", 5)).toBe(20);
    expect(clampLever("pods", 75.6)).toBe(76);
    expect(clampLever("avgBowlPrice", 19.62)).toBe(19.5);
    expect(clampLever("avgManagerSalary", 72_499)).toBe(72_000);
    expect(clampLever("foodCostPct", 0.3049)).toBe(0.305);
  });
});
