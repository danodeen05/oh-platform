import { COVERAGE_FACTOR, COVERAGE_SCHEDULE, coverageFTE, coverageHoursPerDay } from "../labor";
import { MENU_BASE, computeMenu } from "../menu";
import type { CapexAssumptions, LocationAssumptions, Scenario } from "../types";

/**
 * Ramp curve, re-based 2026-09-26 (finding P1). The spec's curve opened at
 * 118% of steady state and plateaued at 106% forever; a new unit does not
 * open above a Chipotle-class run rate. The opening month is soft (70%),
 * the launch push lands in months 2 and 3, the month 4 to 6 trough is kept
 * (spec 11.2; do not smooth it), and the unit reaches steady state at
 * month 12 and holds it. Growth after that comes from menuPriceGrowthPct.
 */
export const RAMP_CURVE: readonly number[] = Object.freeze([0.7, 1.05, 1.0, 0.85, 0.78, 0.78, 0.82, 0.86, 0.9, 0.94, 0.97, 1.0]);

/**
 * Locations 2 to 5 (spec 5.6): 15% pod tooling savings after the first
 * fabrication run, buildout learning curve, and the flagship carries the
 * prototype design cost. TI allowance is unchanged. The $1,411,000 total
 * holds after the 2026-09-26 split of pre-opening into pre-opening and
 * launch marketing (140K -> 90K + 50K).
 */
export const SUBSEQUENT_UNIT_OVERRIDES: Readonly<Partial<CapexAssumptions>> = Object.freeze({
  podUnitCost: 2720,
  kitchenEquipment: 395_000,
  buildoutPerSqFt: 175,
  techHardware: 72_000,
  designArchPermits: 85_000,
  ffeSignage: 95_000,
  preOpening: 90_000, // 2026-09-26 re-base: 140_000 -> 90_000 (K5; launch marketing split out)
  launchMarketing: 50_000, // 2026-09-26 re-base: new (M1)
});

const menu = computeMenu(MENU_BASE);
const operatingDaysPerYear = 313; // 2026-09-26 re-base: 355 -> 313 (R1; owner decision: closed Sundays)
const annualHoursPerFTE = 2080;
const kitchenHoursPerDay = coverageHoursPerDay(COVERAGE_SCHEDULE); // 75

/**
 * Base case, re-based 2026-09-26. Every changed field carries the old value,
 * the new value and the finding id from the diligence review (CHANGELOG.md).
 * Check components and foodCostPct come from computeMenu(MENU_BASE);
 * kitchenFTE comes from the coverage schedule in labor.ts. Delivery is
 * explicitly excluded from revenue.
 */
export const BASE_ASSUMPTIONS: LocationAssumptions = Object.freeze({
  pods: 75,
  squareFeet: 3500,
  serviceHoursPerDay: 10,
  operatingDaysPerYear,
  avgDwellMinutes: 24,
  turnoverMinutes: 6,
  utilizationRate: 0.3,
  avgBowlPrice: menu.blendedBowlPrice, // 2026-09-26 re-base: 19.5 -> 19.39 (R2; menu reset $17.99 / $27.99 / $12.99 at 68/20/12)
  addOnAttachRate: MENU_BASE.addOnAttachRate, // 2026-09-26 re-base: 0.62 -> 0.60 (R2)
  avgAddOnSpend: MENU_BASE.avgAddOnSpend, // 2026-09-26 re-base: 6.25 -> 3.90 (R2; $1.99 to $5.99 add-ons)
  beverageAttachRate: MENU_BASE.beverageAttachRate, // 2026-09-26 re-base: 0.55 -> 0.40 (R2; free water)
  avgBeverageSpend: MENU_BASE.avgBeverageSpend, // 2026-09-26 re-base: 4.50 -> 2.49 (R2; $2.49 soda)
  retailAttachRate: MENU_BASE.retailAttachRate,
  avgRetailSpend: MENU_BASE.avgRetailSpend,
  foodCostPct: menu.foodCostPct, // 2026-09-26 re-base: 0.30 -> 0.327 (C1; bowl-level build with Prime and American Wagyu)
  packagingPct: 0.025,
  memberProgramPct: 0.014, // 2026-09-26 re-base: new (C2; cashback, referrals, challenges, perks at COGS)
  memberSwagAnnual: 30_000, // 2026-09-26 re-base: new (C2; swag, VIP gifts, events, Wall of Fame)
  discountsCompsPct: 0.015, // 2026-09-26 re-base: new (R3)
  salesTaxPct: 0.0835, // 2026-09-26 re-base: new (R5; Utah County combined rate, processing base only)
  kitchenFTE: coverageFTE(kitchenHoursPerDay, operatingDaysPerYear, COVERAGE_FACTOR, annualHoursPerFTE), // 2026-09-26 re-base: 7 -> 11.7 (L1; 75 h/day × 313 × 1.04 ÷ 2,080)
  kitchenHoursPerDay, // 2026-09-26 re-base: new (L1)
  coverageFactorPct: COVERAGE_FACTOR, // 2026-09-26 re-base: new (L1)
  managerFTE: 2,
  avgKitchenWage: 21.0, // 2026-09-26 re-base: 24.00 -> 21.00 (L3; blended by role at Utah County market rates)
  avgManagerSalary: 63_500, // 2026-09-26 re-base: 72_000 -> 63_500 (L3; GM $70K and AGM $57K)
  payrollBurdenPct: 0.22, // 2026-09-26 re-base: 0.18 -> 0.22 (L2; health benefits for salaried no-tip staff)
  annualHoursPerFTE,
  rentPerSqFtAnnual: 34.0,
  nnnPerSqFtAnnual: 9.0,
  utilitiesPct: 0.025, // 2026-09-26 re-base: 0.03 -> 0.025 (O4)
  paymentProcessingPct: 0.03, // 2026-09-26 re-base: 0.027 -> 0.030 (O3; card-only kiosks, charged on the gross ticket)
  marketingPct: 0.03,
  techPlatformPct: 0.018,
  suppliesPct: 0.015, // 2026-09-26 re-base: 0.022 -> 0.015 (O4)
  repairsMaintPct: 0.02,
  insuranceAnnual: 48_000,
  gaPct: 0.015, // 2026-09-26 re-base: 0.025 -> 0.015 (O1; corporate G&A moved to overhead.ts)
  contingencyPct: 0.01, // 2026-09-26 re-base: 0.02 -> 0.01 (O2)
  communityGivingPct: 0.01, // 2026-09-27 owner decision: new (1% of revenue to ONE RED STEP AT A TIME)
  rentEscalationPct: 0.03, // 2026-09-26 re-base: new (R6)
  wageInflationPct: 0.035, // 2026-09-26 re-base: new (R6)
  cogsInflationPct: 0.03, // 2026-09-26 re-base: new (R6)
  menuPriceGrowthPct: 0.025, // 2026-09-26 re-base: new (R6)
  maintenanceCapexPct: 0.015, // 2026-09-26 re-base: new (K4; from year 2)
  preOpeningMonths: 3, // 2026-09-26 re-base: new (K5; pre-opening expensed, not capitalized)
  podUnitCost: 3200,
  kitchenEquipment: 425_000,
  buildoutPerSqFt: 195,
  tenantImprovementAllowancePerSqFt: 55,
  techHardware: 95_000,
  designArchPermits: 165_000,
  ffeSignage: 110_000,
  preOpening: 110_000, // 2026-09-26 re-base: 185_000 -> 110_000 (K5; launch marketing split out, $1.71M total holds)
  launchMarketing: 75_000, // 2026-09-26 re-base: new (M1)
  rampCurve: RAMP_CURVE,
  rampPlateau: 1.0, // 2026-09-26 re-base: 1.06 -> 1.00 (P1)
});

export const BASE: Scenario = Object.freeze({
  key: "base",
  assumptions: BASE_ASSUMPTIONS,
  subsequentUnitOverrides: SUBSEQUENT_UNIT_OVERRIDES,
});
