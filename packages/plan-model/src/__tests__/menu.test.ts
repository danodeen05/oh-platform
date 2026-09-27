import { describe, expect, it } from "vitest";
import { MENU_BASE, MENU_CURRENT_PRICES, computeMenu, proteinCost } from "../index";

describe("proteinCost", () => {
  it("converts a cooked portion to raw cost through the yield", () => {
    expect(proteinCost(4, 0.55, 6.25)).toBeCloseTo((4 / 0.55 / 16) * 6.25, 9);
    expect(proteinCost(4.5, 0.55, 11)).toBeCloseTo(5.625, 3);
    expect(() => proteinCost(4, 0, 6.25)).toThrow(RangeError);
  });
});

describe("computeMenu", () => {
  const reset = computeMenu(MENU_BASE);
  const current = computeMenu(MENU_CURRENT_PRICES);
  it("pins the per-bowl table at the reset prices", () => {
    const table = reset.bowls.map((b) => ({ key: b.key, price: b.price, protein: Number(b.proteinCost.toFixed(3)), food: Number(b.foodCost.toFixed(3)), pct: Number(b.foodCostPct.toFixed(3)) }));
    expect(table).toEqual([
      { key: "classic", price: 17.99, protein: 2.841, food: 5.941, pct: 0.33 },
      { key: "wagyu", price: 27.99, protein: 5.625, food: 8.725, pct: 0.312 },
      { key: "noBeef", price: 12.99, protein: 0, food: 3.1, pct: 0.239 },
    ]);
  });
  it("blends to a $19.39 bowl, a $23.18 check and 32.7% food cost at the reset prices", () => {
    expect(reset.blendedBowlPrice).toBeCloseTo(19.39, 9);
    expect(reset.check).toBeCloseTo(23.176, 9);
    expect(reset.cogsPerCover).toBeCloseTo(7.5816, 3);
    expect(reset.foodCostPct).toBeCloseTo(0.3271, 4);
    expect(reset.proteinCostPerBowl).toBeCloseTo(0.68 * 2.841 + 0.2 * 5.625, 2);
    expect(reset.bowlFoodCost).toBeCloseTo(reset.proteinCostPerBowl + 3.1, 9);
    expect(reset.addOnRevenue).toBeCloseTo(2.34, 9);
    expect(reset.beverageRevenue).toBeCloseTo(0.996, 9);
    expect(reset.retailRevenue).toBeCloseTo(0.45, 9);
  });
  it("at today's prices the check is $20.78 and food cost 36.5%", () => {
    expect(current.blendedBowlPrice).toBeCloseTo(16.99, 9);
    expect(current.check).toBeCloseTo(20.776, 9);
    expect(current.foodCostPct).toBeCloseTo(0.3649, 4);
    expect(current.cogsPerCover).toBeCloseTo(reset.cogsPerCover, 9);
  });
  it("rejects a mix that does not sum to one and handles a free menu", () => {
    expect(() => computeMenu({ ...MENU_BASE, classicMix: 0.5 })).toThrow(RangeError);
    const free = computeMenu({ ...MENU_BASE, classicPrice: 0, wagyuPrice: 0, noBeefPrice: 0, addOnAttachRate: 0, beverageAttachRate: 0, retailAttachRate: 0 });
    expect(free.check).toBe(0);
    expect(free.foodCostPct).toBe(0);
    expect(free.bowls[0]?.foodCostPct).toBe(0);
  });
});
