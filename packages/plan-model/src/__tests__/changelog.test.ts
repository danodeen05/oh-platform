import { describe, expect, it } from "vitest";
import {
  BASE,
  BASE_ASSUMPTIONS,
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  MODEL_CHANGELOG,
  MODEL_SNAPSHOTS,
  MODEL_VERSION,
  MODEL_VERSION_LABEL,
  NO_DEBT,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  REGISTRY_KEYS,
  computeCompany,
  computeLocation,
  computeOwnership,
  computeUnit,
  headlineDeltas,
  latestSnapshot,
} from "../index";

describe("MODEL_CHANGELOG", () => {
  it("is dated, sourced and keyed", () => {
    expect(MODEL_CHANGELOG.length).toBeGreaterThan(40);
    for (const c of MODEL_CHANGELOG) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.finding.length).toBeGreaterThan(0);
      expect(c.key.length).toBeGreaterThan(0);
      expect(c.reason.length).toBeGreaterThan(5);
      expect(c.ref.length).toBeGreaterThan(5);
      expect(["owner", "review", "engine"]).toContain(c.decidedBy);
    }
    const dates = MODEL_CHANGELOG.map((c) => c.date);
    expect([...dates].sort()).toEqual(dates);
  });
  it("records every re-based unit field with its live 'after' value", () => {
    const rebased = MODEL_CHANGELOG.filter((c) => c.date === "2026-09-26" && c.key.startsWith("unit.") && typeof c.after === "number");
    expect(rebased.length).toBeGreaterThan(25);
    for (const c of rebased) {
      const field = c.key.slice("unit.".length) as keyof typeof BASE_ASSUMPTIONS;
      expect(BASE_ASSUMPTIONS[field]).toBeCloseTo(c.after as number, 3);
    }
    for (const c of MODEL_CHANGELOG.filter((x) => x.key.startsWith("unit.") || x.key.startsWith("partnership."))) expect(REGISTRY_KEYS).toContain(c.key);
  });
});

describe("MODEL_SNAPSHOTS", () => {
  it("the latest snapshot is the current version and equals the live engine", () => {
    const s = latestSnapshot();
    expect(s.version).toBe(MODEL_VERSION);
    expect(MODEL_VERSION_LABEL.length).toBeGreaterThan(5);
    const m = computeLocation(BASE_ASSUMPTIONS);
    expect(Math.round(m.annualRevenue)).toBe(s.unitRevenue);
    expect(m.ebitdaMarginPct).toBeCloseTo(s.ebitdaMargin, 4);
    expect(computeUnit(BASE, { loan: NO_DEBT }).ramp.payback.fromOpening).toBeCloseTo(s.paybackFromOpening as number, 3);
    const o = computeOwnership({ scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });
    expect(o.partnerPct).toBe(s.partnerPct);
    expect(o.totalCapital).toBe(s.totalCapital);
    expect(Math.round(o.exitEbitda)).toBe(s.exitEbitda);
    expect(o.partnerMultipleAtHeadline).toBeCloseTo(s.partnerMultiple, 2);
    const c = computeCompany({ scenario: BASE, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });
    expect(c.years[4]?.franchiseLocations).toBe(s.franchiseUnitsY5);
    expect(Math.round(c.years[4]?.corporateOverhead ?? 0)).toBe(s.overheadY5);
  });
  it("versions are in order and the previous snapshot is the 2026-09-25 spec model", () => {
    expect(MODEL_SNAPSHOTS.map((s) => s.version)).toEqual(["2026.09.25", "2026.09.26", "2026.09.27"]);
    // The pledge moves margin by exactly one point of revenue and leaves revenue alone.
    const [, rebase, pledge] = MODEL_SNAPSHOTS as [typeof MODEL_SNAPSHOTS[0], typeof MODEL_SNAPSHOTS[0], typeof MODEL_SNAPSHOTS[0]];
    expect(pledge.unitRevenue).toBe(rebase.unitRevenue);
    expect(rebase.ebitdaMargin - pledge.ebitdaMargin).toBeCloseTo(0.01, 4);
    expect(MODEL_SNAPSHOTS[0]?.unitRevenue).toBe(4_201_425);
  });
  it("headline deltas subtract when both sides exist", () => {
    const [prev, curr] = MODEL_SNAPSHOTS as [typeof MODEL_SNAPSHOTS[0], typeof MODEL_SNAPSHOTS[0]];
    const d = headlineDeltas(prev, curr);
    expect(d.map((x) => x.key)).toEqual(["unitRevenue", "ebitdaMargin", "paybackFromOpening", "partnerPct", "totalCapital", "exitEbitda", "partnerMultiple", "franchiseUnitsY5", "overheadY5"]);
    expect(d.find((x) => x.key === "unitRevenue")?.delta).toBe(3_264_340 - 4_201_425);
    expect(d.find((x) => x.key === "totalCapital")?.delta).toBe(0);
    const nulls = headlineDeltas({ ...prev, paybackFromOpening: null }, curr);
    expect(nulls.find((x) => x.key === "paybackFromOpening")?.delta).toBeNull();
  });
});
