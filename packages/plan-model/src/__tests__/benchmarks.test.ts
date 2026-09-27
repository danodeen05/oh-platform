import { describe, expect, it } from "vitest";
import { BENCHMARKS, FRANCHISE_OVERHEAD_KEYS, computeCompany, computeScorecard, scoreBenchmark, scorecardContext, type Benchmark, type ScorecardContext } from "../index";

describe("scoreBenchmark", () => {
  const b: Benchmark = { key: "x", label: "x", unit: "pct", pass: { min: 0.1, max: 0.2 }, watchLow: { min: 0.05, max: 0.1 }, watchHigh: { min: 0.2, max: 0.3 }, source: "", read: () => 0 };
  it("classifies pass, watch on both sides, fail and pending", () => {
    expect(scoreBenchmark(b, 0.15)).toBe("pass");
    expect(scoreBenchmark(b, 0.1)).toBe("pass");
    expect(scoreBenchmark(b, 0.07)).toBe("watch");
    expect(scoreBenchmark(b, 0.25)).toBe("watch");
    expect(scoreBenchmark(b, 0.01)).toBe("fail");
    expect(scoreBenchmark(b, 0.5)).toBe("fail");
    expect(scoreBenchmark(b, null)).toBe("pending");
    expect(scoreBenchmark(b, Number.NaN)).toBe("pending");
    const { watchLow: _l, watchHigh: _h, ...strict } = b;
    void [_l, _h];
    expect(scoreBenchmark(strict, 0.07)).toBe("fail");
    expect(scoreBenchmark(strict, 0.25)).toBe("fail");
  });
});

describe("computeScorecard on the base case", () => {
  const sc = computeScorecard();
  const status = Object.fromEntries(sc.rows.map((r) => [r.key, r.status]));
  it("passes the unit economics rows and flags the honest watch and fail rows", () => {
    expect(status).toEqual({
      foodCostPct: "pass",
      laborPct: "pass",
      primeCost: "pass",
      occupancyPct: "pass",
      otherOpexPct: "watch",
      ebitdaMarginPct: "pass",
      revenuePerSqFt: "pass",
      salesPerPod: "pass",
      capexPerUnit: "pass",
      capexPerPod: "pass",
      paybackYears: "watch",
      breakEvenShare: "watch",
      overheadShare: "watch",
      royaltyPct: "pass",
      unitFee: "watch",
      franchiseMargin: "pass",
      partnerMultiple: "fail",
      exitMultiple: "pass",
    });
    expect(sc.pass + sc.watch + sc.fail + sc.pending).toBe(BENCHMARKS.length);
    expect(sc.fail).toBe(1);
    expect(sc.watch).toBe(5);
    expect(sc.pending).toBe(0);
  });
  it("reads the values it scores", () => {
    const value = Object.fromEntries(sc.rows.map((r) => [r.key, r.value]));
    expect(value.foodCostPct).toBeCloseTo(0.3271, 4);
    expect(value.primeCost).toBeCloseTo(0.3271 + 0.025 + 0.2385, 3);
    expect(value.otherOpexPct).toBeCloseTo(1 - 0.3271 - 0.2385 - 0.0461 - 0.1349, 3);
    expect(value.salesPerPod).toBeCloseTo(3_264_340 / 75, 0);
    expect(value.capexPerPod).toBeCloseTo(1_710_000 / 75, 6);
    expect(value.paybackYears).toBeCloseTo(3.8831, 3);
    expect(value.breakEvenShare).toBeCloseTo(313.1 / 450, 3);
    expect(value.overheadShare).toBeCloseTo(2_876_200 / 35_651_108, 4);
    expect(value.partnerMultiple).toBeCloseTo(0.1331, 3);
    expect(value.exitMultiple).toBe(5);
    expect(value.franchiseMargin).toBeCloseTo((797_760 - 485_000) / 879_760, 3);
  });
  it("accepts a scenario and other inputs", () => {
    const agg = computeScorecard(scorecardContext({ scenarioKey: "aggressive" }));
    expect(agg.rows.find((r) => r.key === "ebitdaMarginPct")?.value).toBeCloseTo(0.1924, 4);
    expect(agg.rows.find((r) => r.key === "revenuePerSqFt")?.status).toBe("watch");
  });
  it("reports pending when a row cannot be computed", () => {
    const ctx = scorecardContext();
    const short: ScorecardContext = { ...ctx, company: computeCompany({ scenario: ctx.scenario, schedule: [], markets: [], franchiseTerms: ctx.franchiseTerms }, { years: 1 }) };
    const rows = computeScorecard(short).rows;
    expect(rows.find((r) => r.key === "overheadShare")?.status).toBe("pending");
    expect(rows.find((r) => r.key === "franchiseMargin")?.status).toBe("pending");
    const empty: ScorecardContext = { ...ctx, company: computeCompany({ scenario: ctx.scenario, schedule: [], markets: [], franchiseTerms: ctx.franchiseTerms }) };
    expect(computeScorecard(empty).rows.find((r) => r.key === "overheadShare")?.value).toBeNull();
    expect(computeScorecard(empty).rows.find((r) => r.key === "franchiseMargin")?.value).toBeNull();
    const broken: ScorecardContext = { ...ctx, flagship: { ...ctx.flagship, location: { ...ctx.flagship.location, lines: [] } } };
    expect(() => computeScorecard(broken)).toThrow(RangeError);
  });
  it("names the franchise HQ lines it nets out", () => {
    expect(FRANCHISE_OVERHEAD_KEYS).toContain("franchiseDev");
    expect(FRANCHISE_OVERHEAD_KEYS).toContain("fdd");
  });
});
