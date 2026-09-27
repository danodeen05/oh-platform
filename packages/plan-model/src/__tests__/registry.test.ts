import { describe, expect, it } from "vitest";
import {
  ASSUMPTION_REGISTRY,
  BASE_ASSUMPTIONS,
  CORPORATE_OVERHEAD,
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  FX_RATES,
  LEVER_KEYS,
  MENU_BASE,
  MENU_CURRENT_PRICES,
  MODEL_CHANGELOG,
  NO_DEBT,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  REGISTRY_KEYS,
  ROUND_ONE,
  ROUND_TWO,
  STRUCTURE_ECONOMICS,
  SUBSEQUENT_UNIT_OVERRIDES,
  dynamicRegistryEntries,
  registryAnchor,
  registryContext,
  registryRows,
  type PartnershipTerms,
} from "../index";

describe("assumptions register", () => {
  it("covers every key of every assumption interface (forward completeness)", () => {
    const expectKeys = (prefix: string, obj: object): void => {
      for (const k of Object.keys(obj)) expect(REGISTRY_KEYS).toContain(`${prefix}.${k}`);
    };
    expectKeys("unit", BASE_ASSUMPTIONS);
    expectKeys("menu", MENU_BASE);
    expectKeys("capexSubsequent", SUBSEQUENT_UNIT_OVERRIDES);
    expectKeys("franchise", FRANCHISE_TERMS);
    expectKeys("partnership", PARTNERSHIP_TERMS);
    expectKeys("loan", NO_DEBT);
    expectKeys("fx", FX_RATES.rates);
    expect(REGISTRY_KEYS.length).toBeGreaterThan(110);
  });
  it("marks exactly the levers as levers", () => {
    const levers = REGISTRY_KEYS.filter((k) => ASSUMPTION_REGISTRY[k].lever).map((k) => k.replace(/^unit\./, ""));
    expect(levers.sort()).toEqual([...LEVER_KEYS].sort());
  });
  it("every entry has a source with a date and reads a live value", () => {
    const ctx = registryContext();
    for (const key of REGISTRY_KEYS) {
      const entry = ASSUMPTION_REGISTRY[key];
      expect(entry.source.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.source.detail.length).toBeGreaterThan(3);
      expect(entry.label.length).toBeGreaterThan(0);
      const v = entry.read(ctx);
      expect(["number", "string", "boolean"]).toContain(typeof v);
      if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    }
    expect(ASSUMPTION_REGISTRY["unit.pods"].read(ctx)).toBe(75);
    expect(ASSUMPTION_REGISTRY["unit.rampCurve"].read(ctx)).toBe(BASE_ASSUMPTIONS.rampCurve.join(", "));
    expect(ASSUMPTION_REGISTRY["capexSubsequent.tenantImprovementAllowancePerSqFt"].read(ctx)).toBe(55);
    expect(ASSUMPTION_REGISTRY["capexSubsequent.podUnitCost"].read(ctx)).toBe(2720);
    expect(ASSUMPTION_REGISTRY["partnership.sweatEquityBenchmark"].read(ctx)).toBe("0.25 to 0.4");
    expect(ASSUMPTION_REGISTRY["partnership.partnerCapitalSchedule"].read(ctx)).toBe("Y1: 3000000; Y2: 7500000");
    expect(ASSUMPTION_REGISTRY["partnership.recurringOnlyExit"].read(ctx)).toBe(true);
  });
  it("falls back to the defaults for terms without the optional fields", () => {
    const { taxDistributionRate: _t, recurringOnlyExit: _r, preferredReturnPct: _p, liquidationPreference: _l, partnerCapitalSchedule: _s, ...bare } = PARTNERSHIP_TERMS;
    void [_t, _r, _p, _l, _s];
    const ctx = { ...registryContext(), partnership: bare as PartnershipTerms };
    expect(ASSUMPTION_REGISTRY["partnership.taxDistributionRate"].read(ctx)).toBe(0.37);
    expect(ASSUMPTION_REGISTRY["partnership.recurringOnlyExit"].read(ctx)).toBe(true);
    expect(ASSUMPTION_REGISTRY["partnership.preferredReturnPct"].read(ctx)).toBe(0.08);
    expect(ASSUMPTION_REGISTRY["partnership.liquidationPreference"].read(ctx)).toBe(1);
    expect(ASSUMPTION_REGISTRY["partnership.partnerCapitalSchedule"].read(ctx)).toBe("");
  });
  it("builds a context per scenario with the matching menu", () => {
    expect(registryContext().menu).toBe(MENU_BASE);
    expect(registryContext("conservative").menu).toBe(MENU_CURRENT_PRICES);
    expect(registryContext("aggressive").assumptions.utilizationRate).toBe(0.4);
    const ctx = registryContext();
    expect(ctx.schedule).toBe(OPENING_SCHEDULE);
    expect(ctx.markets).toBe(FRANCHISE_MARKETS);
    expect(ctx.structures).toBe(STRUCTURE_ECONOMICS);
    expect(ctx.overhead).toBe(CORPORATE_OVERHEAD);
    expect(ctx.rounds).toEqual([ROUND_ONE, ROUND_TWO]);
  });
  it("completes the dynamic groups at runtime", () => {
    const ctx = registryContext();
    const dyn = dynamicRegistryEntries(ctx);
    const keys = dyn.map((d) => d.key);
    for (const p of OPENING_SCHEDULE) expect(keys).toContain(`schedule.${p.key}.openMonth`);
    for (const m of FRANCHISE_MARKETS) for (const f of ["structure", "territoryFee", "territoryYear", "unitsByYear", "auvIndex"]) expect(keys).toContain(`market.${m.key}.${f}`);
    for (const s of Object.keys(STRUCTURE_ECONOMICS)) for (const f of Object.keys(STRUCTURE_ECONOMICS.franchise)) expect(keys).toContain(`structure.${s}.${f}`);
    for (const r of CORPORATE_OVERHEAD.roles) expect(keys).toContain(`overhead.full.${r.key}`);
    for (const r of [ROUND_ONE, ROUND_TWO]) {
      for (const s of r.sources) expect(keys).toContain(`rounds.${r.key}.sources.${s.key}`);
      for (const u of r.uses) expect(keys).toContain(`rounds.${r.key}.uses.${u.key}`);
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect(dyn.find((d) => d.key === "market.tokyo.unitsByYear")?.read(ctx)).toBe("Y7: 1");
    expect(dyn.find((d) => d.key === "market.shanghai.territoryYear")?.source.detail).toMatch(/Wave two/);
    expect(dyn.find((d) => d.key === "market.seattle.territoryYear")?.source.detail).toMatch(/Phased/);
    expect(dyn.find((d) => d.key === "overhead.full.founder")?.source.kind).toBe("owner-decision");
    expect(dyn.find((d) => d.key === "overhead.full.legal")?.source.kind).toBe("engine-assumption");
    expect(dyn.find((d) => d.key === "structure.master-franchise.royaltyShare")?.read(ctx)).toBe(0.5);
    expect(dyn.find((d) => d.key === "rounds.round1.uses.flagshipCapex")?.read(ctx)).toBe(1_710_000);
  });
  it("produces rows with values, anchors and change-log dates", () => {
    const rows = registryRows();
    expect(rows.length).toBeGreaterThan(REGISTRY_KEYS.length);
    for (const r of rows) expect(r.anchor).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(new Set(rows.map((r) => r.anchor)).size).toBe(rows.length);
    const days = rows.find((r) => r.key === "unit.operatingDaysPerYear");
    expect(days?.value).toBe(313);
    expect(days?.changedIn).toEqual(["2026-09-26"]);
    expect(rows.find((r) => r.key === "unit.pods")?.changedIn).toEqual([]);
    const changedKeys = new Set(MODEL_CHANGELOG.map((c) => c.key));
    expect(rows.filter((r) => changedKeys.has(r.key)).length).toBeGreaterThan(30);
  });
  it("kebab-cases anchors", () => {
    expect(registryAnchor("unit.avgBowlPrice")).toBe("a-unit-avg-bowl-price");
    expect(registryAnchor("structure.master-franchise.fxHaircutPct")).toBe("a-structure-master-franchise-fx-haircut-pct");
    expect(registryAnchor("fx.USD")).toBe("a-fx-usd");
    expect(registryAnchor("..weird..")).toBe("a-weird");
  });
});
