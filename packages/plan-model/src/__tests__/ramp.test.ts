import { describe, expect, it } from "vitest";
import { BASE_ASSUMPTIONS, computeRamp, rampIndex } from "../index";

describe("rampIndex", () => {
  it("reads the curve then holds the plateau", () => {
    expect(rampIndex(BASE_ASSUMPTIONS, 1)).toBe(1.18);
    expect(rampIndex(BASE_ASSUMPTIONS, 18)).toBe(1.06);
    expect(rampIndex(BASE_ASSUMPTIONS, 19)).toBe(1.06);
    expect(rampIndex({ ...BASE_ASSUMPTIONS, rampPlateau: 1 }, 40)).toBe(1);
  });
});

describe("computeRamp", () => {
  it("defaults to a ten-year horizon with yearly sums", () => {
    const r = computeRamp(BASE_ASSUMPTIONS);
    expect(r.months).toHaveLength(120);
    expect(r.years).toHaveLength(10);
    expect(r.years[0]?.revenue).toBeCloseTo(r.months.slice(0, 12).reduce((s, m) => s + m.revenue, 0), 6);
    expect(r.months[0]?.revenue).toBeCloseTo((4_201_425 / 12) * 1.18, 6);
    expect(r.months[0]?.month).toBe(1);
  });
  it("drops partial years", () => {
    expect(computeRamp(BASE_ASSUMPTIONS, { months: 30 }).years).toHaveLength(2);
  });
  it("flat costs make the trough visible in EBITDA", () => {
    const r = computeRamp(BASE_ASSUMPTIONS);
    const month5 = r.months[4];
    const month2 = r.months[1];
    expect(month5?.ebitda).toBeLessThan(month2?.ebitda ?? 0);
    expect(month5?.ebitda).toBeCloseTo((4_201_425 / 12) * 0.8 * 0.483 - 735_164 / 12, 6);
  });
  it("without capex or debt, payback is undefined and cash flow is unlevered", () => {
    const r = computeRamp(BASE_ASSUMPTIONS, { months: 12 });
    expect(r.payback).toEqual({ fromStabilization: null, fromOpening: null });
    expect(r.months[0]?.debtService).toBe(0);
    expect(r.months[0]?.leveredCashFlow).toBe(r.months[0]?.ebitda);
  });
  it("computes both payback definitions", () => {
    const r = computeRamp(BASE_ASSUMPTIONS, { capex: 1_710_000, annualDebtService: 199_836.9035 });
    expect(r.payback.fromStabilization).toBeCloseTo(1_710_000 / (1_294_124.275 - 199_836.9035), 6);
    const fo = r.payback.fromOpening ?? 0;
    expect(fo).toBeGreaterThan(1.5);
    expect(fo).toBeLessThan(1.7);
    // Cumulative levered cash equals capex exactly at the interpolated point.
    const idx = Math.floor(fo * 12);
    const before = r.months[idx - 1]?.cumulativeLeveredCashFlow ?? 0;
    const flow = r.months[idx]?.leveredCashFlow ?? 0;
    expect(before + flow * (fo * 12 - idx)).toBeCloseTo(1_710_000, 3);
  });
  it("reports null payback when debt exceeds steady EBITDA or the horizon is too short", () => {
    const r = computeRamp(BASE_ASSUMPTIONS, { capex: 1_710_000, annualDebtService: 2_000_000, months: 24 });
    expect(r.payback.fromStabilization).toBeNull();
    expect(r.payback.fromOpening).toBeNull();
    const short = computeRamp(BASE_ASSUMPTIONS, { capex: 1_710_000, annualDebtService: 199_837, months: 6 });
    expect(short.payback.fromOpening).toBeNull();
    expect(short.payback.fromStabilization).not.toBeNull();
  });
});
