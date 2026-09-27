import type { MenuAssumptions, MenuBowlCost, MenuModel } from "./types";

/**
 * Bowl-level cost build (2026-09-26 re-baseline, findings R2 and C1).
 *
 * The spec carried a flat 30% food cost and a $26.30 check that the live
 * menu could not produce. The check and the food-cost share now come from
 * the menu itself: three bowls, a sales mix, raw protein prices, a cooked
 * yield and a portion. Presets call computeMenu when they are built, so
 * avgBowlPrice and foodCostPct stay ordinary levers downstream.
 *
 * Public price ranges used (wholesale, boxed, 2026): USDA Prime brisket
 * $5.50 to $7.00 per lb; American Wagyu brisket (Snake River Farms class)
 * $9.00 to $13.00 per lb. Both sit at the midpoint. Yield 55% covers trim,
 * smoke and braise loss. Supplier quotes are an open item in the integrity
 * section; when they land, change these two numbers and the plan follows.
 */
export const MENU_BASE: MenuAssumptions = Object.freeze({
  // Owner decision 2026-09-26: menu price reset as the base case.
  classicPrice: 17.99,
  wagyuPrice: 27.99,
  noBeefPrice: 12.99,
  classicMix: 0.68,
  wagyuMix: 0.2,
  noBeefMix: 0.12,
  primeCostPerLb: 6.25, // $5.50 to $7.00
  wagyuCostPerLb: 11.0, // $9.00 to $13.00
  cookedYield: 0.55,
  primePortionOz: 4.0,
  wagyuPortionOz: 4.5,
  baseBowlCost: 3.1,
  // Attach rates and spends re-derived from the live menu (R2): $1.99 to
  // $5.99 add-ons, $2.49 sodas with free water, retail at the exit.
  addOnAttachRate: 0.6,
  avgAddOnSpend: 3.9,
  addOnCogsPct: 0.33,
  beverageAttachRate: 0.4,
  avgBeverageSpend: 2.49,
  beverageCogsPct: 0.28,
  retailAttachRate: 0.025,
  avgRetailSpend: 18.0,
  retailCogsPct: 0.5,
  wastePct: 0.02,
});

/** The menu at today's prices ($15.99 / $23.99 / $10.99); the conservative case keeps them. */
export const MENU_CURRENT_PRICES: MenuAssumptions = Object.freeze({
  ...MENU_BASE,
  classicPrice: 15.99,
  wagyuPrice: 23.99,
  noBeefPrice: 10.99,
});

/** Owner decision 2026-09-26: the public four-wall EBITDA target (was 25%). */
export const PUBLIC_EBITDA_TARGET = 0.15;
/** Owner decision 2026-09-26: the stretch target at maturity. */
export const MATURITY_EBITDA_TARGET = 0.2;

const OZ_PER_LB = 16;

/** Raw protein cost for a cooked portion. */
export function proteinCost(cookedOz: number, cookedYield: number, rawCostPerLb: number): number {
  if (cookedYield <= 0) throw new RangeError("cookedYield must be positive");
  return (cookedOz / cookedYield / OZ_PER_LB) * rawCostPerLb;
}

export function computeMenu(m: MenuAssumptions): MenuModel {
  const mixTotal = m.classicMix + m.wagyuMix + m.noBeefMix;
  if (Math.abs(mixTotal - 1) > 1e-9) throw new RangeError("bowl mix must sum to 1");
  const bowl = (key: MenuBowlCost["key"], price: number, mix: number, protein: number): MenuBowlCost => {
    const foodCost = m.baseBowlCost + protein;
    return { key, price, mix, proteinCost: protein, foodCost, foodCostPct: price > 0 ? foodCost / price : 0 };
  };
  const bowls: MenuBowlCost[] = [
    bowl("classic", m.classicPrice, m.classicMix, proteinCost(m.primePortionOz, m.cookedYield, m.primeCostPerLb)),
    bowl("wagyu", m.wagyuPrice, m.wagyuMix, proteinCost(m.wagyuPortionOz, m.cookedYield, m.wagyuCostPerLb)),
    bowl("noBeef", m.noBeefPrice, m.noBeefMix, 0),
  ];
  const blendedBowlPrice = bowls.reduce((s, b) => s + b.price * b.mix, 0);
  const proteinCostPerBowl = bowls.reduce((s, b) => s + b.proteinCost * b.mix, 0);
  const bowlFoodCost = bowls.reduce((s, b) => s + b.foodCost * b.mix, 0);
  const addOnRevenue = m.addOnAttachRate * m.avgAddOnSpend;
  const beverageRevenue = m.beverageAttachRate * m.avgBeverageSpend;
  const retailRevenue = m.retailAttachRate * m.avgRetailSpend;
  const check = blendedBowlPrice + addOnRevenue + beverageRevenue + retailRevenue;
  const recipe = bowlFoodCost + addOnRevenue * m.addOnCogsPct + beverageRevenue * m.beverageCogsPct + retailRevenue * m.retailCogsPct;
  const cogsPerCover = recipe * (1 + m.wastePct);
  return {
    bowls,
    blendedBowlPrice,
    proteinCostPerBowl,
    bowlFoodCost,
    addOnRevenue,
    beverageRevenue,
    retailRevenue,
    check,
    cogsPerCover,
    foodCostPct: check > 0 ? cogsPerCover / check : 0,
  };
}
