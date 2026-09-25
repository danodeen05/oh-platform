import { computeLocation } from "./location";
import type { LeverKey, LocationAssumptions, LocationModel } from "./types";

export type Metric = "ebitda" | "annualRevenue" | "ebitdaMarginPct" | "revenuePerSqFt";

export interface LeverRange {
  key: LeverKey;
  low: number;
  high: number;
}

export interface TornadoBar {
  key: LeverKey;
  low: number;
  high: number;
  atLow: number;
  atHigh: number;
  /** |atHigh - atLow|, the bar length. */
  swing: number;
}

export interface TornadoModel {
  metric: Metric;
  base: number;
  bars: readonly TornadoBar[];
}

export function withLever(a: LocationAssumptions, key: LeverKey, value: number): LocationAssumptions {
  return { ...a, [key]: value };
}

function metricOf(m: LocationModel, metric: Metric): number {
  return m[metric];
}

/** One-at-a-time sensitivity, sorted by swing, largest first. */
export function tornado(a: LocationAssumptions, ranges: readonly LeverRange[], metric: Metric = "ebitda"): TornadoModel {
  const base = metricOf(computeLocation(a), metric);
  const bars = ranges
    .map((r): TornadoBar => {
      const atLow = metricOf(computeLocation(withLever(a, r.key, r.low)), metric);
      const atHigh = metricOf(computeLocation(withLever(a, r.key, r.high)), metric);
      return { key: r.key, low: r.low, high: r.high, atLow, atHigh, swing: Math.abs(atHigh - atLow) };
    })
    .sort((x, y) => y.swing - x.swing);
  return { metric, base, bars };
}

export interface GridAxis {
  key: LeverKey;
  values: readonly number[];
}

export interface HeatGridModel {
  metric: Metric;
  x: GridAxis;
  y: GridAxis;
  /** cells[yIndex][xIndex] */
  cells: readonly (readonly number[])[];
  min: number;
  max: number;
}

/** Two-variable grid, e.g. utilization × average check. */
export function heatGrid(a: LocationAssumptions, x: GridAxis, y: GridAxis, metric: Metric = "ebitda"): HeatGridModel {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const cells = y.values.map((yv) =>
    x.values.map((xv) => {
      const v = metricOf(computeLocation(withLever(withLever(a, y.key, yv), x.key, xv)), metric);
      if (v < min) min = v;
      if (v > max) max = v;
      return v;
    }),
  );
  return { metric, x, y, cells, min, max };
}

/** Deterministic PRNG so a Monte Carlo run is reproducible in tests and share links. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TriangularDist {
  key: LeverKey;
  min: number;
  mode: number;
  max: number;
}

/** Inverse-CDF sample of a triangular distribution. */
export function sampleTriangular(d: TriangularDist, u: number): number {
  const { min, mode, max } = d;
  if (max <= min) return min;
  const fc = (mode - min) / (max - min);
  if (u < fc) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export interface MonteCarloModel {
  metric: Metric;
  runs: number;
  seed: number;
  /** Sorted ascending; the histogram source. */
  samples: readonly number[];
  mean: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  /** Share of runs where the metric is at or below `threshold`. */
  probabilityBelow: number;
  threshold: number;
}

export interface MonteCarloOptions {
  runs?: number;
  seed?: number;
  metric?: Metric;
  /** Downside threshold for `probabilityBelow`. Default 0 (a loss). */
  threshold?: number;
}

/** Linear-interpolated percentile on a sorted array. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}

/**
 * Monte Carlo over triangular lever distributions. Pure and seeded; the UI
 * runs it in a Web Worker (spec 7.3) but the function itself has no
 * environment dependencies.
 */
export function monteCarlo(a: LocationAssumptions, dists: readonly TriangularDist[], options: MonteCarloOptions = {}): MonteCarloModel {
  const runs = options.runs ?? 2000;
  const seed = options.seed ?? 20260101;
  const metric = options.metric ?? "ebitda";
  const threshold = options.threshold ?? 0;
  if (runs < 1) throw new RangeError("runs must be at least 1");
  const rand = mulberry32(seed);
  const samples: number[] = new Array<number>(runs);
  let sum = 0;
  let below = 0;
  for (let i = 0; i < runs; i++) {
    let trial = a;
    for (const d of dists) trial = withLever(trial, d.key, sampleTriangular(d, rand()));
    const v = metricOf(computeLocation(trial), metric);
    samples[i] = v;
    sum += v;
    if (v <= threshold) below++;
  }
  samples.sort((x, y) => x - y);
  return {
    metric,
    runs,
    seed,
    samples,
    mean: sum / runs,
    p5: percentile(samples, 0.05),
    p10: percentile(samples, 0.1),
    p25: percentile(samples, 0.25),
    p50: percentile(samples, 0.5),
    p75: percentile(samples, 0.75),
    p90: percentile(samples, 0.9),
    p95: percentile(samples, 0.95),
    probabilityBelow: below / runs,
    threshold,
  };
}
