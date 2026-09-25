import type { CostLine, LocationAssumptions, LocationModel } from "./types";

/** Spec 5.4, implemented precisely. */
export function computeAvgCheck(a: LocationAssumptions): number {
  return (
    a.avgBowlPrice +
    a.addOnAttachRate * a.avgAddOnSpend +
    a.beverageAttachRate * a.avgBeverageSpend +
    a.retailAttachRate * a.avgRetailSpend
  );
}

/** Share of revenue that scales with sales. Everything except labor, occupancy and insurance. */
export function variableCostPct(a: LocationAssumptions): number {
  return (
    a.foodCostPct +
    a.packagingPct +
    a.utilitiesPct +
    a.paymentProcessingPct +
    a.marketingPct +
    a.techPlatformPct +
    a.suppliesPct +
    a.repairsMaintPct +
    a.gaPct +
    a.contingencyPct
  );
}

/** Annual labor including burden. Kitchen is hourly, management is salaried. */
export function computeLabor(a: LocationAssumptions): number {
  const kitchen = a.kitchenFTE * a.avgKitchenWage * a.annualHoursPerFTE;
  const management = a.managerFTE * a.avgManagerSalary;
  return (kitchen + management) * (1 + a.payrollBurdenPct);
}

export function computeOccupancy(a: LocationAssumptions): number {
  return a.squareFeet * (a.rentPerSqFtAnnual + a.nnnPerSqFtAnnual);
}

/** Costs that do not move with revenue in a given year. */
export function fixedCosts(a: LocationAssumptions): number {
  return computeLabor(a) + computeOccupancy(a) + a.insuranceAnnual;
}

/**
 * Steady-state single-unit P&L (spec 5.4 and 5.5).
 * Pure: same assumptions in, same model out.
 */
export function computeLocation(a: LocationAssumptions): LocationModel {
  const cycleMinutes = a.avgDwellMinutes + a.turnoverMinutes;
  const turnsPerPodPerDay = (a.serviceHoursPerDay * 60) / cycleMinutes;
  const theoreticalCoversPerDay = a.pods * turnsPerPodPerDay;
  const actualCoversPerDay = theoreticalCoversPerDay * a.utilizationRate;
  const avgCheck = computeAvgCheck(a);
  const dailyRevenue = actualCoversPerDay * avgCheck;
  const annualRevenue = dailyRevenue * a.operatingDaysPerYear;
  const revenuePerSqFt = annualRevenue / a.squareFeet;

  const foodCost = annualRevenue * a.foodCostPct;
  const packaging = annualRevenue * a.packagingPct;
  const grossProfit = annualRevenue - foodCost - packaging;

  const labor = computeLabor(a);
  const occupancy = computeOccupancy(a);
  const utilities = annualRevenue * a.utilitiesPct;
  const paymentProcessing = annualRevenue * a.paymentProcessingPct;
  const marketing = annualRevenue * a.marketingPct;
  const techPlatform = annualRevenue * a.techPlatformPct;
  const supplies = annualRevenue * a.suppliesPct;
  const repairsMaint = annualRevenue * a.repairsMaintPct;
  const insurance = a.insuranceAnnual;
  const ga = annualRevenue * a.gaPct;
  const contingency = annualRevenue * a.contingencyPct;

  const totalOpex =
    labor + occupancy + utilities + paymentProcessing + marketing + techPlatform + supplies + repairsMaint + insurance + ga + contingency;
  const ebitda = grossProfit - totalOpex;

  const fixed = labor + occupancy + insurance;
  const varPct = variableCostPct(a);
  const contribution = 1 - varPct;
  // With a non-positive contribution margin there is no break-even; report Infinity so the UI can say so.
  const breakEvenRevenue = contribution > 0 ? fixed / contribution : Number.POSITIVE_INFINITY;
  const breakEvenCoversPerDay = breakEvenRevenue / (avgCheck * a.operatingDaysPerYear);

  const pct = (amount: number): number => (annualRevenue > 0 ? amount / annualRevenue : 0);
  const lines: CostLine[] = [
    { key: "foodCost", amount: foodCost, pct: a.foodCostPct, fixed: false, group: "cogs" },
    { key: "packaging", amount: packaging, pct: a.packagingPct, fixed: false, group: "cogs" },
    { key: "labor", amount: labor, pct: pct(labor), fixed: true, group: "opex" },
    { key: "occupancy", amount: occupancy, pct: pct(occupancy), fixed: true, group: "opex" },
    { key: "utilities", amount: utilities, pct: a.utilitiesPct, fixed: false, group: "opex" },
    { key: "paymentProcessing", amount: paymentProcessing, pct: a.paymentProcessingPct, fixed: false, group: "opex" },
    { key: "marketing", amount: marketing, pct: a.marketingPct, fixed: false, group: "opex" },
    { key: "techPlatform", amount: techPlatform, pct: a.techPlatformPct, fixed: false, group: "opex" },
    { key: "supplies", amount: supplies, pct: a.suppliesPct, fixed: false, group: "opex" },
    { key: "repairsMaint", amount: repairsMaint, pct: a.repairsMaintPct, fixed: false, group: "opex" },
    { key: "insurance", amount: insurance, pct: pct(insurance), fixed: true, group: "opex" },
    { key: "ga", amount: ga, pct: a.gaPct, fixed: false, group: "opex" },
    { key: "contingency", amount: contingency, pct: a.contingencyPct, fixed: false, group: "opex" },
  ];

  return {
    cycleMinutes,
    turnsPerPodPerDay,
    theoreticalCoversPerDay,
    actualCoversPerDay,
    avgCheck,
    dailyRevenue,
    annualRevenue,
    revenuePerSqFt,
    foodCost,
    packaging,
    grossProfit,
    grossMarginPct: pct(grossProfit),
    labor,
    laborPct: pct(labor),
    occupancy,
    utilities,
    paymentProcessing,
    marketing,
    techPlatform,
    supplies,
    repairsMaint,
    insurance,
    ga,
    contingency,
    totalOpex,
    totalOpexPct: pct(totalOpex),
    ebitda,
    ebitdaMarginPct: pct(ebitda),
    fixedCosts: fixed,
    variableCostPct: varPct,
    breakEvenRevenue,
    breakEvenCoversPerDay,
    lines,
  };
}

/**
 * Spec 5.5 traditional full-service comparison (spec numbers, not derived).
 * Oh! values come from the model so the bar always reflects live assumptions.
 */
export const TRADITIONAL_RESTAURANT = Object.freeze({
  foodCostPct: 0.3,
  laborPct: 0.3,
  occupancyPct: 0.08,
  otherOpexPct: 0.2,
  ebitdaPct: 0.12,
});

export interface ComparisonRow {
  key: "foodCost" | "labor" | "occupancy" | "otherOpex" | "ebitda";
  traditional: number;
  oh: number;
}

export function compareToTraditional(m: LocationModel): readonly ComparisonRow[] {
  const rev = m.annualRevenue;
  const share = (amount: number): number => (rev > 0 ? amount / rev : 0);
  const otherOpex = m.totalOpex - m.labor - m.occupancy + m.packaging;
  return [
    { key: "foodCost", traditional: TRADITIONAL_RESTAURANT.foodCostPct, oh: share(m.foodCost) },
    { key: "labor", traditional: TRADITIONAL_RESTAURANT.laborPct, oh: share(m.labor) },
    { key: "occupancy", traditional: TRADITIONAL_RESTAURANT.occupancyPct, oh: share(m.occupancy) },
    { key: "otherOpex", traditional: TRADITIONAL_RESTAURANT.otherOpexPct, oh: share(otherOpex) },
    { key: "ebitda", traditional: TRADITIONAL_RESTAURANT.ebitdaPct, oh: share(m.ebitda) },
  ];
}
