import type { CapexAssumptions, LocationAssumptions, Scenario } from "../types";

/**
 * Spec 5.7 ramp curve: opening spike, month 4 to 6 trough, recovery.
 * The trough is deliberate (spec 11.2); do not smooth it.
 */
export const RAMP_CURVE: readonly number[] = Object.freeze([
  1.18, 1.22, 1.1, 0.88, 0.8, 0.78, 0.82, 0.86, 0.9, 0.94, 0.97, 1.0, 1.01, 1.02, 1.03, 1.04, 1.05, 1.06,
]);

/**
 * Locations 2 to 5 (spec 5.6): 15% pod tooling savings after the first
 * fabrication run, buildout learning curve, and the flagship carries the
 * prototype design cost. TI allowance is unchanged.
 */
export const SUBSEQUENT_UNIT_OVERRIDES: Readonly<Partial<CapexAssumptions>> = Object.freeze({
  podUnitCost: 2720,
  kitchenEquipment: 395_000,
  buildoutPerSqFt: 175,
  techHardware: 72_000,
  designArchPermits: 85_000,
  ffeSignage: 95_000,
  preOpening: 140_000,
});

/**
 * Base case, spec 5.3 verbatim with one documented change: retailAttachRate
 * is 0.025 instead of 0.04 so the average check lands on the table's $26.30
 * (0.04 gives $26.57, which nothing else in the spec supports).
 */
export const BASE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
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
  kitchenFTE: 7,
  managerFTE: 2,
  avgKitchenWage: 24.0,
  avgManagerSalary: 72_000,
  payrollBurdenPct: 0.18,
  // Owner decision 2026-09-25: the CPA convention, 2,080. Labor is $582,259
  // (13.9%) and base EBITDA 29.7%. 1,850 would reproduce the spec 5.5 table
  // ($537K, 12.8%, 30.8%) but is not a defensible staffing assumption.
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
  podUnitCost: 3200,
  kitchenEquipment: 425_000,
  buildoutPerSqFt: 195,
  tenantImprovementAllowancePerSqFt: 55,
  techHardware: 95_000,
  designArchPermits: 165_000,
  ffeSignage: 110_000,
  preOpening: 185_000,
  rampCurve: RAMP_CURVE,
  // The spec's curve ends at 1.06 and says nothing about what follows; hold it.
  rampPlateau: 1.06,
});

export const BASE: Scenario = Object.freeze({
  key: "base",
  assumptions: BASE_ASSUMPTIONS,
  subsequentUnitOverrides: SUBSEQUENT_UNIT_OVERRIDES,
});
