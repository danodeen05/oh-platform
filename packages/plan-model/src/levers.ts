import type { LeverBounds, LeverKey } from "./types";

/**
 * Slider bounds for every lever the UI exposes. Share links are validated
 * against the same table, so a stale or hand-edited link cannot render a
 * value the sliders could not have produced.
 */
export const LEVER_BOUNDS: Readonly<Record<LeverKey, LeverBounds>> = Object.freeze({
  pods: { min: 20, max: 120, step: 1 },
  squareFeet: { min: 1500, max: 8000, step: 50 },
  serviceHoursPerDay: { min: 6, max: 18, step: 0.5 },
  operatingDaysPerYear: { min: 300, max: 365, step: 1 },
  avgDwellMinutes: { min: 12, max: 60, step: 1 },
  turnoverMinutes: { min: 2, max: 15, step: 1 },
  utilizationRate: { min: 0.05, max: 0.8, step: 0.01 },
  avgBowlPrice: { min: 10, max: 40, step: 0.25 },
  addOnAttachRate: { min: 0, max: 1, step: 0.01 },
  avgAddOnSpend: { min: 0, max: 20, step: 0.25 },
  beverageAttachRate: { min: 0, max: 1, step: 0.01 },
  avgBeverageSpend: { min: 0, max: 15, step: 0.25 },
  retailAttachRate: { min: 0, max: 0.5, step: 0.005 },
  avgRetailSpend: { min: 0, max: 60, step: 1 },
  foodCostPct: { min: 0.15, max: 0.5, step: 0.005 },
  packagingPct: { min: 0, max: 0.1, step: 0.005 },
  kitchenFTE: { min: 2, max: 20, step: 1 },
  managerFTE: { min: 0, max: 6, step: 1 },
  avgKitchenWage: { min: 12, max: 45, step: 0.5 },
  avgManagerSalary: { min: 40_000, max: 150_000, step: 1000 },
  payrollBurdenPct: { min: 0.05, max: 0.4, step: 0.01 },
  annualHoursPerFTE: { min: 1500, max: 2200, step: 10 },
  rentPerSqFtAnnual: { min: 10, max: 200, step: 1 },
  nnnPerSqFtAnnual: { min: 0, max: 60, step: 1 },
  utilitiesPct: { min: 0, max: 0.1, step: 0.005 },
  paymentProcessingPct: { min: 0, max: 0.05, step: 0.001 },
  marketingPct: { min: 0, max: 0.1, step: 0.005 },
  techPlatformPct: { min: 0, max: 0.05, step: 0.001 },
  suppliesPct: { min: 0, max: 0.1, step: 0.005 },
  repairsMaintPct: { min: 0, max: 0.1, step: 0.005 },
  insuranceAnnual: { min: 0, max: 200_000, step: 1000 },
  gaPct: { min: 0, max: 0.1, step: 0.005 },
  contingencyPct: { min: 0, max: 0.1, step: 0.005 },
  podUnitCost: { min: 1000, max: 8000, step: 50 },
  kitchenEquipment: { min: 100_000, max: 1_000_000, step: 5000 },
  buildoutPerSqFt: { min: 50, max: 500, step: 5 },
  tenantImprovementAllowancePerSqFt: { min: 0, max: 150, step: 5 },
  techHardware: { min: 0, max: 300_000, step: 5000 },
  designArchPermits: { min: 0, max: 400_000, step: 5000 },
  ffeSignage: { min: 0, max: 300_000, step: 5000 },
  preOpening: { min: 0, max: 500_000, step: 5000 },
  rampPlateau: { min: 0.7, max: 1.3, step: 0.01 },
});

export const LEVER_KEYS: readonly LeverKey[] = Object.freeze(Object.keys(LEVER_BOUNDS) as LeverKey[]);

export function isLeverKey(value: string): value is LeverKey {
  return Object.prototype.hasOwnProperty.call(LEVER_BOUNDS, value);
}

/** True when `value` is a finite number inside the lever's bounds. */
export function isWithinBounds(key: LeverKey, value: number): boolean {
  const b = LEVER_BOUNDS[key];
  return Number.isFinite(value) && value >= b.min && value <= b.max;
}

/** Clamp to bounds and snap to the lever's step. */
export function clampLever(key: LeverKey, value: number): number {
  const b = LEVER_BOUNDS[key];
  const clamped = Math.min(b.max, Math.max(b.min, value));
  const steps = Math.round((clamped - b.min) / b.step);
  // Round to the step's precision so 0.1 + 0.2 style noise does not leak into share links.
  const decimals = Math.max(0, -Math.floor(Math.log10(b.step)));
  return Number((b.min + steps * b.step).toFixed(decimals));
}
