import { FRANCHISE_MARKETS, FRANCHISE_TERMS, FX_RATES, OPENING_SCHEDULE, PARTNERSHIP_TERMS, ROUND_ONE, ROUND_TWO, SCENARIOS, SCENARIO_KEYS } from "./assumptions/index";
import { computeCapex, computeCapitalStack } from "./capital";
import { computeCompany } from "./company";
import { computeLocation } from "./location";
import { LEVER_KEYS, isWithinBounds } from "./levers";
import { computeOwnership } from "./partnership";
import type { FranchiseMarket, FranchiseTerms, FxTable, LocationModel, OpeningPlan, PartnershipTerms, RoundAssumptions, Scenario, ScenarioKey } from "./types";

/**
 * Automated invariants (2026-09-26, Model integrity section). These are the
 * identities the engine must satisfy for any input, run live on the page
 * against the presets and in the test suite. A failing invariant is a bug
 * or a broken preset, never a business judgment.
 */
export interface InvariantContext {
  scenarios: Readonly<Record<ScenarioKey, Scenario>>;
  schedule: readonly OpeningPlan[];
  markets: readonly FranchiseMarket[];
  franchiseTerms: FranchiseTerms;
  terms: PartnershipTerms;
  rounds: readonly RoundAssumptions[];
  fx: FxTable;
}

export interface InvariantResult {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

export function invariantContext(): InvariantContext {
  return { scenarios: SCENARIOS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS, terms: PARTNERSHIP_TERMS, rounds: [ROUND_ONE, ROUND_TWO], fx: FX_RATES };
}

const close = (a: number, b: number, tol = 1e-6): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const money = (n: number): string => Math.round(n).toLocaleString("en-US");

export function runInvariants(ctx: InvariantContext = invariantContext()): readonly InvariantResult[] {
  const out: InvariantResult[] = [];
  const add = (key: string, label: string, pass: boolean, detail: string): void => {
    out.push({ key, label, pass, detail });
  };
  const keys = SCENARIO_KEYS.filter((k) => k in ctx.scenarios);

  // Cost lines sum to the totals and EBITDA is the identity, in every scenario.
  {
    let pass = true;
    const details: string[] = [];
    for (const k of keys) {
      const m = computeLocation(ctx.scenarios[k].assumptions);
      const cogs = m.lines.filter((l) => l.group === "cogs").reduce((s, l) => s + l.amount, 0);
      const opex = m.lines.filter((l) => l.group === "opex").reduce((s, l) => s + l.amount, 0);
      const ok = close(cogs, m.annualRevenue - m.grossProfit) && close(opex, m.totalOpex) && close(m.annualRevenue - cogs - opex, m.ebitda);
      pass = pass && ok;
      details.push(`${k}: ${m.lines.length} lines, EBITDA ${money(m.ebitda)}`);
    }
    add("cost-lines-sum", "Cost lines sum to COGS and opex; revenue − lines = EBITDA", pass, details.join("; "));
  }

  // Capex sums and the learning curve.
  {
    const base = ctx.scenarios.base;
    const flag = computeCapex(base.assumptions);
    const later = computeCapex(base.assumptions, base.subsequentUnitOverrides);
    const sum = flag.lines.reduce((s, l) => s + l.amount, 0);
    add("capex-sums", "Capex total equals the sum of its lines and later units cost less than the flagship", close(sum, flag.total) && later.total < flag.total, `flagship ${money(flag.total)}, later units ${money(later.total)}`);
  }

  // Ownership sums to one and respects the cap, common and preferred.
  {
    const o = computeOwnership({ scenario: ctx.scenarios.base, terms: ctx.terms, schedule: ctx.schedule, markets: ctx.markets, franchiseTerms: ctx.franchiseTerms });
    const total = o.owners.reduce((s, x) => s + x.pct, 0);
    const pass = close(total, 1) && o.partnerPct <= ctx.terms.partnerPctCap + 1e-9 && o.preferred.partnerCommonPct <= ctx.terms.partnerPctCap + 1e-9;
    add("owners-sum-and-cap", "Owners sum to 100% and the partner never exceeds the cap", pass, `partner ${(o.partnerPct * 100).toFixed(0)}% (cap ${(ctx.terms.partnerPctCap * 100).toFixed(0)}%), capped: ${o.cappedByOwner}`);
  }

  // Scenarios are ordered.
  {
    const rev = keys.map((k) => computeLocation(ctx.scenarios[k].assumptions));
    let pass = true;
    for (let i = 1; i < rev.length; i++) {
      const a = rev[i - 1] as LocationModel;
      const b = rev[i] as LocationModel;
      if (!(a.annualRevenue < b.annualRevenue && a.ebitda < b.ebitda)) pass = false;
    }
    add("scenarios-ordered", "Conservative < base < aggressive on revenue and EBITDA", pass, rev.map((m, i) => `${keys[i] as string}: ${money(m.annualRevenue)}`).join("; "));
  }

  // Break-even sits below the base case.
  {
    const m = computeLocation(ctx.scenarios.base.assumptions);
    add("break-even-below-base", "Base revenue clears break-even", m.breakEvenRevenue < m.annualRevenue, `break-even ${money(m.breakEvenRevenue)} vs revenue ${money(m.annualRevenue)}`);
  }

  // Rounds balance and the partner's capital matches the rounds.
  {
    const stacks = ctx.rounds.map((r) => computeCapitalStack(r));
    const balanced = stacks.every((s) => s.unallocated === 0);
    const partner = ctx.rounds.flatMap((r) => r.sources).filter((s) => s.key === "partnerEquity").reduce((s, x) => s + x.amount, 0);
    const scheduled = (ctx.terms.partnerCapitalSchedule ?? [{ year: 1, amount: ctx.terms.partnerCapital }]).reduce((s, t) => s + t.amount, 0);
    add("rounds-balance", "Every round balances and partner capital equals the rounds' partner equity", balanced && close(partner, ctx.terms.partnerCapital) && close(scheduled, ctx.terms.partnerCapital), `rounds ${stacks.map((s) => money(s.totalSources)).join(" + ")}; partner ${money(partner)}`);
  }

  // Ramp shape.
  {
    const a = ctx.scenarios.base.assumptions;
    const curve = a.rampCurve;
    const trough = Math.min(...curve.slice(3, 6));
    const finite = curve.every((x) => x > 0 && x <= 1.5);
    const last = curve.length > 0 ? (curve[curve.length - 1] as number) : Number.NaN;
    const pass = finite && curve.length >= 12 && trough < (curve[1] as number) && close(last, a.rampPlateau);
    add("ramp-shape", "Ramp curve is positive, keeps the month 4 to 6 trough and ends at the plateau", pass, `${curve.length} months, trough ${trough}, plateau ${a.rampPlateau}`);
  }

  // Opening schedule.
  {
    const offsets = ctx.schedule.map((o) => o.openMonth);
    const sorted = offsets.every((o, i) => i === 0 || o >= (offsets[i - 1] as number));
    const flagships = ctx.schedule.filter((o) => o.flagship);
    add("schedule-sorted", "Opening schedule is in date order with one flagship at T0", sorted && flagships.length === 1 && flagships.every((f) => f.openMonth === 0), `offsets ${offsets.join(", ")}`);
  }

  // Levers in bounds.
  {
    const bad: string[] = [];
    for (const k of keys) for (const lever of LEVER_KEYS) if (!isWithinBounds(lever, ctx.scenarios[k].assumptions[lever])) bad.push(`${k}.${lever}`);
    add("levers-in-bounds", "Every preset value sits inside its slider bounds", bad.length === 0, bad.length === 0 ? `${LEVER_KEYS.length} levers × ${keys.length} scenarios` : bad.join(", "));
  }

  // Territory fees in band.
  {
    const bad = ctx.markets.filter((m) => {
      if (m.structure === "sub-franchise") return m.territoryFee !== 0;
      if (m.structure === "franchise") return m.territoryFee !== 100_000;
      return m.territoryFee < 250_000 || m.territoryFee > 750_000;
    });
    add("territory-fees-in-band", "Territory fees: $0 sub-franchise, $100K US development, $250K to $750K master", bad.length === 0, bad.length === 0 ? `${ctx.markets.length} markets` : bad.map((m) => m.key).join(", "));
  }

  // FX.
  add("fx-usd-one", "USD is 1.0 in the FX table", ctx.fx.rates.USD === 1, `as of ${ctx.fx.ratesAsOf}`);

  // Cash never goes negative in the base case.
  {
    const c = computeCompany({ scenario: ctx.scenarios.base, schedule: ctx.schedule, markets: ctx.markets, franchiseTerms: ctx.franchiseTerms });
    add("base-cash-positive", "Base-case cumulative cash stays above zero through year 5", c.minimumCash > 0, `minimum ${money(c.minimumCash)}`);
  }

  return out;
}

/** True when every invariant passes. */
export function invariantsPass(results: readonly InvariantResult[] = runInvariants()): boolean {
  return results.every((r) => r.pass);
}
