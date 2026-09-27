import {
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  NO_DEBT,
  OPENING_SCHEDULE,
  computeCompany,
  computeLocation,
  computeRamp,
  computeUnit,
  withLever,
  type CompanyInput,
  type LeverKey,
  type LeverRange,
  type LocationAssumptions,
  type Scenario,
  type TriangularDist,
} from "@oh/plan-model";

/**
 * The stress list the Sensitivity page and the print route share (one
 * source, 2026-09-26). Each downside is a lever move in the engine, never a
 * paragraph: unit stresses re-run the location P&L (and the ramp for the
 * year-one ones, the flagship payback for the capex one); company stresses
 * re-run the consolidated model through year five.
 */
export type DownsideHeadline = "steady" | "y1" | "payback" | "company";

interface UnitDownside {
  key: string;
  kind: "unit";
  headline: "steady" | "y1" | "payback";
  apply: (a: LocationAssumptions) => LocationAssumptions;
}
interface CompanyDownside {
  key: string;
  kind: "company";
  headline: "company";
  apply: (input: CompanyInput) => CompanyInput;
}
export type Downside = UnitDownside | CompanyDownside;

const lever = (a: LocationAssumptions, key: LeverKey, value: number): LocationAssumptions => withLever(a, key, value);

export const DOWNSIDES: readonly Downside[] = [
  { key: "slowRamp", kind: "unit", headline: "y1", apply: (a) => ({ ...a, rampCurve: a.rampCurve.map((x) => x * 0.85), rampPlateau: a.rampPlateau * 0.95 }) },
  // Opening slips a quarter: three dead months in front of the same curve. Year one only; steady state is untouched.
  { key: "openingDelay", kind: "unit", headline: "y1", apply: (a) => ({ ...a, rampCurve: [0, 0, 0, ...a.rampCurve] }) },
  { key: "rentInflation", kind: "unit", headline: "steady", apply: (a) => lever(a, "rentPerSqFtAnnual", a.rentPerSqFtAnnual + 15) },
  { key: "beefSpike", kind: "unit", headline: "steady", apply: (a) => lever(a, "foodCostPct", a.foodCostPct + 0.05) },
  { key: "priceResistance", kind: "unit", headline: "steady", apply: (a) => lever(lever(a, "avgBowlPrice", a.avgBowlPrice - 2), "utilizationRate", a.utilizationRate * 0.9) },
  { key: "copycat", kind: "unit", headline: "steady", apply: (a) => lever(a, "utilizationRate", a.utilizationRate * 0.8) },
  { key: "memberProgramOverrun", kind: "unit", headline: "steady", apply: (a) => lever(lever(a, "memberProgramPct", a.memberProgramPct + 0.015), "memberSwagAnnual", a.memberSwagAnnual + 20_000) },
  { key: "commissaryFailure", kind: "unit", headline: "steady", apply: (a) => lever(lever(lever(a, "foodCostPct", a.foodCostPct + 0.02), "utilizationRate", a.utilizationRate * 0.9), "repairsMaintPct", a.repairsMaintPct + 0.005) },
  { key: "podReliability", kind: "unit", headline: "steady", apply: (a) => lever(lever(a, "repairsMaintPct", a.repairsMaintPct + 0.015), "pods", a.pods - 5) },
  { key: "accessibilityRedesign", kind: "unit", headline: "steady", apply: (a) => lever(lever(a, "pods", a.pods - 3), "buildoutPerSqFt", a.buildoutPerSqFt + 10) },
  { key: "laborShock", kind: "unit", headline: "steady", apply: (a) => lever(lever(a, "avgKitchenWage", a.avgKitchenWage + 3), "kitchenFTE", a.kitchenFTE + 1) },
  // Build runs 15% over on the lines a contractor controls; read as payback from opening, not margin.
  { key: "capexOverrun", kind: "unit", headline: "payback", apply: (a) => lever(lever(lever(a, "podUnitCost", a.podUnitCost * 1.15), "buildoutPerSqFt", a.buildoutPerSqFt * 1.15), "kitchenEquipment", a.kitchenEquipment * 1.15) },
  // One phase-one market never opens its later units and royalties collect at 85%.
  {
    key: "franchiseAttrition",
    kind: "company",
    headline: "company",
    apply: (input) => ({
      ...input,
      markets: input.markets.map((m) => (m.key === "seattle" ? { ...m, unitsByYear: Object.fromEntries(Object.entries(m.unitsByYear).filter(([y]) => Number(y) <= 4)) } : m)),
      franchiseTerms: { ...input.franchiseTerms, royaltyPct: input.franchiseTerms.royaltyPct * 0.85 },
    }),
  },
];

export interface DownsideResult {
  key: string;
  headline: DownsideHeadline;
  /** EBITDA delta in dollars, or years for the payback case. */
  value: number;
  /** Steady-state margin after the stress (unit cases). */
  marginAfter: number;
  y1Delta: number;
  steadyDelta: number;
}

/** Company input for a scenario, the same one the Financials page uses. */
export function companyInput(scenario: Scenario): CompanyInput {
  return { scenario, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };
}

export function computeDownsides(scenario: Scenario, list: readonly Downside[] = DOWNSIDES): readonly DownsideResult[] {
  const a = scenario.assumptions;
  const base = computeLocation(a);
  const y1Base = computeRamp(a, { months: 12 }).years[0]?.ebitda ?? 0;
  const baseCompany = computeCompany(companyInput(scenario), { years: 5 });
  const baseY5 = baseCompany.years[4]?.consolidatedEbitda ?? 0;
  return list.map((d): DownsideResult => {
    if (d.kind === "company") {
      const stressed = computeCompany(d.apply(companyInput(scenario)), { years: 5 });
      const delta = (stressed.years[4]?.consolidatedEbitda ?? 0) - baseY5;
      return { key: d.key, headline: "company", value: delta, marginAfter: base.ebitdaMarginPct, y1Delta: 0, steadyDelta: delta };
    }
    const stressed = d.apply(a);
    const loc = computeLocation(stressed);
    const y1 = computeRamp(stressed, { months: 12 }).years[0]?.ebitda ?? 0;
    const steadyDelta = loc.ebitda - base.ebitda;
    const y1Delta = y1 - y1Base;
    let value = steadyDelta;
    if (d.headline === "y1") value = y1Delta;
    if (d.headline === "payback") {
      const basePayback = computeUnit(scenario, { loan: NO_DEBT }).ramp.payback.fromOpening;
      const stressedPayback = computeUnit(scenario, { loan: NO_DEBT, assumptions: stressed }).ramp.payback.fromOpening;
      value = basePayback !== null && stressedPayback !== null ? stressedPayback - basePayback : Number.NaN;
    }
    return { key: d.key, headline: d.headline, value, marginAfter: loc.ebitdaMarginPct, y1Delta, steadyDelta };
  });
}

/** Tornado ranges, each lever swung both ways from its preset. Shared by the page and the print route. */
export function tornadoRanges(a: LocationAssumptions): LeverRange[] {
  return [
    { key: "utilizationRate", low: a.utilizationRate * 0.8, high: a.utilizationRate * 1.2 },
    { key: "avgBowlPrice", low: a.avgBowlPrice - 2, high: a.avgBowlPrice + 2 },
    { key: "foodCostPct", low: a.foodCostPct + 0.03, high: a.foodCostPct - 0.03 },
    { key: "rentPerSqFtAnnual", low: a.rentPerSqFtAnnual + 10, high: a.rentPerSqFtAnnual - 10 },
    { key: "kitchenFTE", low: a.kitchenFTE + 2, high: a.kitchenFTE - 2 },
    { key: "memberProgramPct", low: a.memberProgramPct + 0.015, high: Math.max(0, a.memberProgramPct - 0.007) },
    { key: "avgDwellMinutes", low: a.avgDwellMinutes + 5, high: a.avgDwellMinutes - 5 },
    { key: "pods", low: a.pods - 10, high: a.pods + 10 },
    { key: "payrollBurdenPct", low: a.payrollBurdenPct + 0.04, high: a.payrollBurdenPct - 0.04 },
  ];
}

/** Monte Carlo distributions: symmetric on the revenue levers, skewed against us on costs. */
export function monteCarloDists(a: LocationAssumptions): TriangularDist[] {
  return [
    { key: "utilizationRate", min: a.utilizationRate * 0.75, mode: a.utilizationRate, max: a.utilizationRate * 1.25 },
    { key: "avgBowlPrice", min: a.avgBowlPrice - 2, mode: a.avgBowlPrice, max: a.avgBowlPrice + 2 },
    { key: "foodCostPct", min: a.foodCostPct - 0.02, mode: a.foodCostPct, max: a.foodCostPct + 0.04 },
    { key: "rentPerSqFtAnnual", min: a.rentPerSqFtAnnual - 4, mode: a.rentPerSqFtAnnual, max: a.rentPerSqFtAnnual + 10 },
    { key: "kitchenFTE", min: a.kitchenFTE - 1, mode: a.kitchenFTE, max: a.kitchenFTE + 2 },
    { key: "memberProgramPct", min: Math.max(0, a.memberProgramPct - 0.004), mode: a.memberProgramPct, max: a.memberProgramPct + 0.015 },
  ];
}

/** Risks disclosed rather than modeled (plan.sensitivity.register.items.*). Order is the reading order. */
export const RISK_REGISTER = [
  "fireCodeAda",
  "foodCode",
  "techOutage",
  "beefSupply",
  "reviewBacklash",
  "cannibalization",
  "keyPerson",
  "relatedParty",
  "ip",
  "dataPrivacy",
  "pci",
  "fx",
  "exitMultiple",
  "sundayClosure",
  "deliveryExcluded",
  "seasonality",
  "giftCardLiability",
  "cateringExcluded",
  "investorReporting",
] as const;
