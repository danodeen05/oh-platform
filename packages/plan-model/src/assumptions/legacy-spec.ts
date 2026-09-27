import type { CapexAssumptions, FranchiseMarket, LocationAssumptions, Scenario } from "../types";

/**
 * The presets as they stood on 2026-09-25, frozen verbatim.
 *
 * These reproduce docs/OH_BUSINESS_PLAN_BUILD_SPEC.md sections 5.3 to 5.11
 * (with the owner decisions of 2026-09-25 applied) and are kept so the
 * spec-drift tests can prove the engine still computes the spec's tables
 * when fed the spec's inputs. They are superseded by the 2026-09-26
 * re-baseline (see CHANGELOG.md) and must not be used by the plan.
 *
 * The fields added on 2026-09-26 are present here at their neutral values
 * (zero program cost, zero escalation, no pre-opening months, no launch
 * marketing) so the legacy P&L is exactly what the spec printed.
 */
export const LEGACY_RAMP_CURVE: readonly number[] = Object.freeze([
  1.18, 1.22, 1.1, 0.88, 0.8, 0.78, 0.82, 0.86, 0.9, 0.94, 0.97, 1.0, 1.01, 1.02, 1.03, 1.04, 1.05, 1.06,
]);

export const LEGACY_SUBSEQUENT_UNIT_OVERRIDES: Readonly<Partial<CapexAssumptions>> = Object.freeze({
  podUnitCost: 2720,
  kitchenEquipment: 395_000,
  buildoutPerSqFt: 175,
  techHardware: 72_000,
  designArchPermits: 85_000,
  ffeSignage: 95_000,
  preOpening: 140_000,
  launchMarketing: 0,
});

export const LEGACY_BASE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
  pods: 75,
  squareFeet: 3500,
  serviceHoursPerDay: 10,
  operatingDaysPerYear: 355,
  avgDwellMinutes: 24,
  turnoverMinutes: 6,
  utilizationRate: 0.3,
  avgBowlPrice: 19.5,
  addOnAttachRate: 0.62,
  avgAddOnSpend: 6.25,
  beverageAttachRate: 0.55,
  avgBeverageSpend: 4.5,
  retailAttachRate: 0.025,
  avgRetailSpend: 18.0,
  foodCostPct: 0.3,
  packagingPct: 0.025,
  memberProgramPct: 0,
  memberSwagAnnual: 0,
  discountsCompsPct: 0,
  salesTaxPct: 0,
  kitchenFTE: 7,
  // The spec staffed one day's schedule (7 people × 10 hours); FTE was not derived from coverage.
  kitchenHoursPerDay: 70,
  coverageFactorPct: 0,
  managerFTE: 2,
  avgKitchenWage: 24.0,
  avgManagerSalary: 72_000,
  payrollBurdenPct: 0.18,
  annualHoursPerFTE: 2080,
  rentPerSqFtAnnual: 34.0,
  nnnPerSqFtAnnual: 9.0,
  utilitiesPct: 0.03,
  paymentProcessingPct: 0.027,
  marketingPct: 0.03,
  techPlatformPct: 0.018,
  suppliesPct: 0.022,
  repairsMaintPct: 0.02,
  insuranceAnnual: 48_000,
  gaPct: 0.025,
  contingencyPct: 0.02,
  communityGivingPct: 0,
  rentEscalationPct: 0,
  wageInflationPct: 0,
  cogsInflationPct: 0,
  menuPriceGrowthPct: 0,
  maintenanceCapexPct: 0,
  preOpeningMonths: 0,
  podUnitCost: 3200,
  kitchenEquipment: 425_000,
  buildoutPerSqFt: 195,
  tenantImprovementAllowancePerSqFt: 55,
  techHardware: 95_000,
  designArchPermits: 165_000,
  ffeSignage: 110_000,
  preOpening: 185_000,
  launchMarketing: 0,
  rampCurve: LEGACY_RAMP_CURVE,
  rampPlateau: 1.06,
});

export const LEGACY_CONSERVATIVE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
  ...LEGACY_BASE_ASSUMPTIONS,
  utilizationRate: 0.22,
  avgBowlPrice: 18.5,
  addOnAttachRate: 0.54,
  avgAddOnSpend: 6.0,
  beverageAttachRate: 0.5,
  avgBeverageSpend: 4.0,
  retailAttachRate: 0.02,
});

export const LEGACY_AGGRESSIVE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
  ...LEGACY_BASE_ASSUMPTIONS,
  utilizationRate: 0.4,
  avgBowlPrice: 21.0,
  addOnAttachRate: 0.74,
  beverageAttachRate: 0.59,
  retailAttachRate: 0.04,
});

export const LEGACY_BASE: Scenario = Object.freeze({ key: "base", assumptions: LEGACY_BASE_ASSUMPTIONS, subsequentUnitOverrides: LEGACY_SUBSEQUENT_UNIT_OVERRIDES });
export const LEGACY_CONSERVATIVE: Scenario = Object.freeze({ key: "conservative", assumptions: LEGACY_CONSERVATIVE_ASSUMPTIONS, subsequentUnitOverrides: LEGACY_SUBSEQUENT_UNIT_OVERRIDES });
export const LEGACY_AGGRESSIVE: Scenario = Object.freeze({ key: "aggressive", assumptions: LEGACY_AGGRESSIVE_ASSUMPTIONS, subsequentUnitOverrides: LEGACY_SUBSEQUENT_UNIT_OVERRIDES });

export const LEGACY_SCENARIOS: Readonly<Record<Scenario["key"], Scenario>> = Object.freeze({
  conservative: LEGACY_CONSERVATIVE,
  base: LEGACY_BASE,
  aggressive: LEGACY_AGGRESSIVE,
});

/** The 2026-09-26 "third option" market list: 36 franchise units in 26 markets by year 5. Kept only for drift tests. */
const legacyMarkets: FranchiseMarket[] = [
  { key: "nyc", name: "New York City", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1 }, auvIndex: 1.5 },
  { key: "la", name: "Los Angeles", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1 }, auvIndex: 1.45 },
  { key: "las-vegas", name: "Las Vegas", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1 }, auvIndex: 1.4 },
  { key: "seattle", name: "Seattle", structure: "franchise", territoryFee: 100_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1 }, auvIndex: 1.3 },
  { key: "taipei", name: "Taipei", structure: "master-franchise", territoryFee: 500_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1 }, auvIndex: 0.85 },
  { key: "tokyo", name: "Tokyo", structure: "jv", territoryFee: 750_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1 }, auvIndex: 1.05 },
  { key: "london", name: "London", structure: "master-franchise", territoryFee: 500_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1 }, auvIndex: 1.1 },
  { key: "paris", name: "Paris", structure: "sub-franchise", territoryFee: 0, territoryYear: 5, unitsByYear: { 5: 2 }, auvIndex: 1.0 },
  { key: "singapore", name: "Singapore", structure: "master-franchise", territoryFee: 350_000, territoryYear: 4, unitsByYear: { 4: 1, 5: 1 }, auvIndex: 1.15 },
  { key: "melbourne", name: "Melbourne", structure: "master-franchise", territoryFee: 250_000, territoryYear: 5, unitsByYear: { 5: 2 }, auvIndex: 0.95 },
  { key: "hong-kong", name: "Hong Kong", structure: "master-franchise", territoryFee: 500_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 1.2 },
  { key: "shanghai", name: "Shanghai", structure: "jv", territoryFee: 750_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 1.0 },
  { key: "kuala-lumpur", name: "Kuala Lumpur", structure: "master-franchise", territoryFee: 250_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.7 },
  { key: "bangkok", name: "Bangkok", structure: "master-franchise", territoryFee: 300_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.75 },
  { key: "toronto", name: "Toronto", structure: "master-franchise", territoryFee: 350_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 1.15 },
  { key: "vancouver", name: "Vancouver", structure: "master-franchise", territoryFee: 250_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 1.1 },
  { key: "beijing", name: "Beijing", structure: "jv", territoryFee: 500_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.95 },
  { key: "chengdu", name: "Chengdu", structure: "jv", territoryFee: 350_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.8 },
  { key: "jakarta", name: "Jakarta", structure: "master-franchise", territoryFee: 250_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.65 },
  { key: "manila", name: "Manila", structure: "master-franchise", territoryFee: 250_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.65 },
  { key: "dubai", name: "Dubai", structure: "master-franchise", territoryFee: 500_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 1.25 },
  { key: "mexico-city", name: "Mexico City", structure: "master-franchise", territoryFee: 300_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.7 },
  { key: "geneva", name: "Geneva", structure: "sub-franchise", territoryFee: 0, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 1.3 },
  { key: "barcelona", name: "Barcelona", structure: "sub-franchise", territoryFee: 0, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.95 },
  { key: "rome", name: "Rome", structure: "sub-franchise", territoryFee: 0, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.95 },
  { key: "sao-paulo", name: "São Paulo", structure: "master-franchise", territoryFee: 300_000, territoryYear: 5, unitsByYear: { 5: 1 }, auvIndex: 0.7 },
];
export const LEGACY_FRANCHISE_MARKETS: readonly FranchiseMarket[] = Object.freeze(legacyMarkets);
