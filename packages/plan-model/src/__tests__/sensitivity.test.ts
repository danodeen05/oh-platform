import { describe, expect, it } from "vitest";
import {
  BASE_ASSUMPTIONS,
  computeLocation,
  heatGrid,
  monteCarlo,
  mulberry32,
  percentile,
  sampleTriangular,
  tornado,
  withLever,
} from "../index";

describe("withLever", () => {
  it("returns a new object with one lever changed", () => {
    const a = withLever(BASE_ASSUMPTIONS, "pods", 80);
    expect(a.pods).toBe(80);
    expect(a).not.toBe(BASE_ASSUMPTIONS);
    expect(BASE_ASSUMPTIONS.pods).toBe(75);
  });
});

describe("tornado", () => {
  it("sorts bars by swing, largest first", () => {
    const t = tornado(BASE_ASSUMPTIONS, [
      { key: "foodCostPct", low: 0.28, high: 0.32 },
      { key: "utilizationRate", low: 0.22, high: 0.4 },
    ]);
    expect(t.metric).toBe("ebitda");
    expect(t.base).toBeCloseTo(computeLocation(BASE_ASSUMPTIONS).ebitda, 6);
    expect(t.bars.map((b) => b.key)).toEqual(["utilizationRate", "foodCostPct"]);
    const u = t.bars[0];
    expect(u?.atLow).toBeLessThan(t.base);
    expect(u?.atHigh).toBeGreaterThan(t.base);
    expect(u?.swing).toBeCloseTo((u?.atHigh ?? 0) - (u?.atLow ?? 0), 9);
  });
  it("supports other metrics", () => {
    const t = tornado(BASE_ASSUMPTIONS, [{ key: "avgBowlPrice", low: 18, high: 21 }], "annualRevenue");
    expect(t.base).toBeCloseTo(4_201_425, 6);
    expect(t.bars[0]?.atHigh).toBeCloseTo(450 * 27.8 * 355, 6);
  });
});

describe("heatGrid", () => {
  it("fills cells[y][x] and tracks the range", () => {
    const g = heatGrid(
      BASE_ASSUMPTIONS,
      { key: "utilizationRate", values: [0.22, 0.3, 0.4] },
      { key: "avgBowlPrice", values: [18.5, 19.5] },
      "annualRevenue",
    );
    expect(g.cells).toHaveLength(2);
    expect(g.cells[0]).toHaveLength(3);
    expect(g.cells[1]?.[1]).toBeCloseTo(4_201_425, 6);
    expect(g.min).toBe(g.cells[0]?.[0]);
    expect(g.max).toBe(g.cells[1]?.[2]);
    expect(g.metric).toBe("annualRevenue");
  });
  it("defaults to EBITDA", () => {
    const g = heatGrid(BASE_ASSUMPTIONS, { key: "pods", values: [75] }, { key: "pods", values: [75] });
    expect(g.cells[0]?.[0]).toBeCloseTo(1_294_124.275, 3);
  });
});

describe("mulberry32", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("sampleTriangular", () => {
  const d = { key: "utilizationRate" as const, min: 0.2, mode: 0.3, max: 0.5 };
  it("hits the endpoints and the mode", () => {
    expect(sampleTriangular(d, 0)).toBeCloseTo(0.2, 12);
    expect(sampleTriangular(d, 1)).toBeCloseTo(0.5, 12);
    expect(sampleTriangular(d, (0.3 - 0.2) / (0.5 - 0.2))).toBeCloseTo(0.3, 12);
  });
  it("is monotonic in u", () => {
    expect(sampleTriangular(d, 0.2)).toBeLessThan(sampleTriangular(d, 0.8));
  });
  it("collapses a degenerate range", () => {
    expect(sampleTriangular({ ...d, max: 0.2 }, 0.7)).toBe(0.2);
  });
});

describe("percentile", () => {
  it("interpolates on a sorted array", () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40], 1)).toBe(40);
    expect(percentile([7], 0.9)).toBe(7);
  });
  it("is NaN for an empty array", () => {
    expect(percentile([], 0.5)).toBeNaN();
  });
});

describe("monteCarlo", () => {
  const dists = [
    { key: "utilizationRate" as const, min: 0.18, mode: 0.3, max: 0.42 },
    { key: "foodCostPct" as const, min: 0.27, mode: 0.3, max: 0.35 },
  ];
  it("is reproducible for a seed and sorted", () => {
    const a = monteCarlo(BASE_ASSUMPTIONS, dists, { runs: 300, seed: 7 });
    const b = monteCarlo(BASE_ASSUMPTIONS, dists, { runs: 300, seed: 7 });
    expect(a.samples).toEqual(b.samples);
    expect(a.runs).toBe(300);
    expect(a.seed).toBe(7);
    for (let i = 1; i < a.samples.length; i++) expect(a.samples[i]).toBeGreaterThanOrEqual(a.samples[i - 1] ?? 0);
    expect(a.p5).toBeLessThanOrEqual(a.p50);
    expect(a.p50).toBeLessThanOrEqual(a.p95);
    expect(a.p10).toBeLessThanOrEqual(a.p25);
    expect(a.p75).toBeLessThanOrEqual(a.p90);
    expect(a.mean).toBeCloseTo(a.samples.reduce((s, x) => s + x, 0) / 300, 6);
    expect(a.metric).toBe("ebitda");
    expect(a.threshold).toBe(0);
    expect(a.probabilityBelow).toBe(0);
  });
  it("uses defaults and honors the threshold", () => {
    const m = monteCarlo(BASE_ASSUMPTIONS, dists);
    expect(m.runs).toBe(2000);
    const all = monteCarlo(BASE_ASSUMPTIONS, dists, { runs: 50, threshold: 1e12, metric: "annualRevenue" });
    expect(all.probabilityBelow).toBe(1);
    expect(all.metric).toBe("annualRevenue");
  });
  it("rejects zero runs", () => {
    expect(() => monteCarlo(BASE_ASSUMPTIONS, dists, { runs: 0 })).toThrow(RangeError);
  });
});
