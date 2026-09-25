import type { LeverKey } from "@oh/plan-model";

export type LeverFormat = "percent" | "currency" | "currency2" | "integer" | "minutes";

export interface ModelLever {
  key: LeverKey;
  format: LeverFormat;
  /** Narrower slider range than the engine bounds where the full range is silly for a first conversation. */
  min?: number;
  max?: number;
  step?: number;
}

/** Spec 6.1: utilization, check (via bowl price), food cost, rent, pods, labor, dwell. */
export const MODEL_LEVERS: readonly ModelLever[] = [
  { key: "utilizationRate", format: "percent", min: 0.1, max: 0.6, step: 0.01 },
  { key: "avgBowlPrice", format: "currency2", min: 14, max: 28, step: 0.25 },
  { key: "foodCostPct", format: "percent", min: 0.22, max: 0.4, step: 0.005 },
  { key: "rentPerSqFtAnnual", format: "currency", min: 18, max: 80, step: 1 },
  { key: "pods", format: "integer", min: 40, max: 110, step: 1 },
  { key: "kitchenFTE", format: "integer", min: 4, max: 12, step: 1 },
  { key: "avgDwellMinutes", format: "minutes", min: 15, max: 40, step: 1 },
];
