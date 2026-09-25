import { describe, expect, it } from "vitest";
import {
  BASE_ASSUMPTIONS,
  TRADITIONAL_RESTAURANT,
  compareToTraditional,
  computeAvgCheck,
  computeLabor,
  computeLocation,
  computeOccupancy,
  fixedCosts,
  variableCostPct,
} from "../index";

describe("location helpers", () => {
  it("average check is the sum of bowl plus attach-weighted spends", () => {
    expect(computeAvgCheck(BASE_ASSUMPTIONS)).toBeCloseTo(26.3, 9);
  });
  it("variable cost share excludes labor, occupancy and insurance", () => {
    expect(variableCostPct(BASE_ASSUMPTIONS)).toBeCloseTo(0.517, 9);
  });
  it("labor is hourly kitchen plus salaried management, burdened", () => {
    expect(computeLabor(BASE_ASSUMPTIONS)).toBeCloseTo(582_259.2, 6);
    expect(computeLabor({ ...BASE_ASSUMPTIONS, annualHoursPerFTE: 1850 })).toBeCloseTo(536_664, 6);
  });
  it("occupancy is all-in rent per square foot", () => {
    expect(computeOccupancy(BASE_ASSUMPTIONS)).toBe(150_500);
    expect(fixedCosts(BASE_ASSUMPTIONS)).toBeCloseTo(780_759.2, 6);
  });
});

describe("computeLocation", () => {
  const m = computeLocation(BASE_ASSUMPTIONS);
  it("break-even is fixed costs over contribution margin", () => {
    expect(m.fixedCosts).toBeCloseTo(780_759.2, 6);
    expect(m.variableCostPct).toBeCloseTo(0.517, 9);
    expect(m.breakEvenRevenue).toBeCloseTo(780_759.2 / 0.483, 3);
    expect(m.breakEvenCoversPerDay).toBeCloseTo(780_759.2 / 0.483 / (26.3 * 355), 6);
  });
  it("cost lines reconcile to the totals", () => {
    expect(m.lines).toHaveLength(13);
    const cogs = m.lines.filter((l) => l.group === "cogs").reduce((s, l) => s + l.amount, 0);
    const opex = m.lines.filter((l) => l.group === "opex").reduce((s, l) => s + l.amount, 0);
    expect(cogs).toBeCloseTo(m.foodCost + m.packaging, 6);
    expect(opex).toBeCloseTo(m.totalOpex, 6);
    expect(m.grossProfit - m.totalOpex).toBeCloseTo(m.ebitda, 6);
    expect(m.lines.filter((l) => l.fixed).map((l) => l.key)).toEqual(["labor", "occupancy", "insurance"]);
  });
  it("reports no break-even when contribution margin is not positive", () => {
    const bad = computeLocation({ ...BASE_ASSUMPTIONS, foodCostPct: 0.9 });
    expect(bad.breakEvenRevenue).toBe(Number.POSITIVE_INFINITY);
    expect(bad.breakEvenCoversPerDay).toBe(Number.POSITIVE_INFINITY);
    expect(bad.ebitda).toBeLessThan(0);
  });
  it("handles zero revenue without dividing by zero", () => {
    const dark = computeLocation({ ...BASE_ASSUMPTIONS, utilizationRate: 0 });
    expect(dark.annualRevenue).toBe(0);
    expect(dark.grossMarginPct).toBe(0);
    expect(dark.laborPct).toBe(0);
    expect(dark.ebitdaMarginPct).toBe(0);
    expect(dark.ebitda).toBeCloseTo(-780_759.2, 6);
    expect(dark.lines.find((l) => l.key === "labor")?.pct).toBe(0);
  });
  it("is deterministic", () => {
    expect(computeLocation(BASE_ASSUMPTIONS)).toEqual(m);
  });
});

describe("compareToTraditional", () => {
  it("returns five rows with the benchmark column fixed", () => {
    const rows = compareToTraditional(computeLocation(BASE_ASSUMPTIONS));
    expect(rows.map((r) => r.key)).toEqual(["foodCost", "labor", "occupancy", "otherOpex", "ebitda"]);
    expect(rows[0]?.traditional).toBe(TRADITIONAL_RESTAURANT.foodCostPct);
    expect(rows[0]?.oh).toBeCloseTo(0.3, 9);
    // Other opex = every opex line except labor and occupancy, plus packaging.
    expect(rows[3]?.oh).toBeCloseTo((1_587_432.8 - 582_259.2 - 150_500 + 105_035.625) / 4_201_425, 6);
  });
  it("returns zeros for a dark location", () => {
    const rows = compareToTraditional(computeLocation({ ...BASE_ASSUMPTIONS, utilizationRate: 0 }));
    expect(rows.every((r) => r.oh === 0)).toBe(true);
  });
});
