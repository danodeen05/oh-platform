/**
 * Engine-backed facts and the what-if calculator for Chappy. Pure: no I/O,
 * so it is unit tested against @oh/plan-model directly.
 */

import {
  LEVER_BOUNDS,
  NO_DEBT,
  SCENARIOS,
  SCENARIO_KEYS,
  clampLever,
  computeUnit,
  isLeverKey,
  isScenarioKey,
  withLever,
  type LeverKey,
  type ScenarioKey,
  type UnitModel,
} from "@oh/plan-model";

export interface UnitSnapshot {
  annualRevenue: number;
  avgCheck: number;
  coversPerDay: number;
  foodCostPct: number;
  laborPct: number;
  occupancyPct: number;
  ebitda: number;
  ebitdaMarginPct: number;
  breakEvenCoversPerDay: number;
  buildCost: number;
  paybackYearsFromOpening: number | null;
}

const round = (n: number, d = 0) => Number(n.toFixed(d));

export function unitSnapshot(u: UnitModel): UnitSnapshot {
  const l = u.location;
  const pct = (v: number) => round((v / (l.annualRevenue || 1)) * 100, 1);
  return {
    annualRevenue: round(l.annualRevenue),
    avgCheck: round(l.avgCheck, 2),
    coversPerDay: round(l.actualCoversPerDay),
    foodCostPct: pct(l.foodCost),
    laborPct: round(l.laborPct * 100, 1),
    occupancyPct: pct(l.occupancy),
    ebitda: round(l.ebitda),
    ebitdaMarginPct: round(l.ebitdaMarginPct * 100, 1),
    breakEvenCoversPerDay: round(l.breakEvenCoversPerDay),
    buildCost: round(u.capex.total),
    paybackYearsFromOpening: u.ramp.payback.fromOpening === null ? null : round(u.ramp.payback.fromOpening, 1),
  };
}

const unitFor = (s: ScenarioKey) => computeUnit(SCENARIOS[s], { loan: NO_DEBT });

/** Flagship unit economics in all three scenarios, as a compact text table. */
export function scenarioComparisonText(): string {
  const rows = SCENARIO_KEYS.map((k) => [k, unitSnapshot(unitFor(k))] as const);
  const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const line = (label: string, f: (s: UnitSnapshot) => string) => `| ${label} | ${rows.map(([, s]) => f(s)).join(" | ")} |`;
  return [
    `| Flagship unit, no debt | ${rows.map(([k]) => k).join(" | ")} |`,
    line("Annual revenue", (s) => usd(s.annualRevenue)),
    line("Average check", (s) => `$${s.avgCheck.toFixed(2)}`),
    line("Guests per day", (s) => String(s.coversPerDay)),
    line("Food cost % of sales", (s) => `${s.foodCostPct}%`),
    line("Labor % of sales", (s) => `${s.laborPct}%`),
    line("Occupancy % of sales", (s) => `${s.occupancyPct}%`),
    line("Four-wall EBITDA", (s) => usd(s.ebitda)),
    line("EBITDA margin", (s) => `${s.ebitdaMarginPct}%`),
    line("Break-even guests per day", (s) => String(s.breakEvenCoversPerDay)),
    line("Build cost (net capex)", (s) => usd(s.buildCost)),
    line("Payback from opening, years", (s) => (s.paybackYearsFromOpening === null ? "never" : String(s.paybackYearsFromOpening))),
  ].join("\n");
}

/** Lever names, bounds and base values, for the what_if tool description. */
export function leverCatalog(): string {
  const base = SCENARIOS.base.assumptions as unknown as Record<string, number>;
  return (Object.keys(LEVER_BOUNDS) as LeverKey[])
    .map((k) => `${k} (base ${base[k]}, ${LEVER_BOUNDS[k].min} to ${LEVER_BOUNDS[k].max})`)
    .join("; ");
}

export interface WhatIfChange {
  lever: string;
  value?: number;
  changePct?: number;
}

export interface WhatIfResult {
  scenario: ScenarioKey;
  applied: { lever: string; from: number; to: number; clamped: boolean }[];
  rejected: string[];
  before: UnitSnapshot;
  after: UnitSnapshot;
}

/**
 * Recompute the flagship unit with some levers changed. Values are clamped
 * to the same bounds the Model page sliders use, so Chappy can never quote a
 * number the plan itself could not produce.
 */
export function whatIf(input: { scenario?: string; changes?: WhatIfChange[] }): WhatIfResult {
  const scenario: ScenarioKey = input.scenario && isScenarioKey(input.scenario) ? input.scenario : "base";
  let a = SCENARIOS[scenario].assumptions;
  const applied: WhatIfResult["applied"] = [];
  const rejected: string[] = [];
  for (const c of (input.changes ?? []).slice(0, 8)) {
    if (!c || typeof c.lever !== "string" || !isLeverKey(c.lever)) {
      rejected.push(String(c?.lever ?? "?"));
      continue;
    }
    const from = (a as unknown as Record<string, number>)[c.lever] ?? 0;
    const raw = typeof c.value === "number" ? c.value : typeof c.changePct === "number" ? from * (1 + c.changePct / 100) : NaN;
    if (!Number.isFinite(raw)) {
      rejected.push(c.lever);
      continue;
    }
    const to = clampLever(c.lever, raw);
    a = withLever(a, c.lever, to);
    applied.push({ lever: c.lever, from, to, clamped: Math.abs(to - raw) > 1e-9 });
  }
  const before = unitSnapshot(unitFor(scenario));
  const after = unitSnapshot(computeUnit(SCENARIOS[scenario], { loan: NO_DEBT, assumptions: a }));
  return { scenario, applied, rejected, before, after };
}
