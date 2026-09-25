/// <reference lib="webworker" />
import { monteCarlo, type LocationAssumptions, type TriangularDist } from "@oh/plan-model";

export interface McRequest {
  assumptions: LocationAssumptions;
  dists: readonly TriangularDist[];
  runs: number;
  seed: number;
}
export interface McResponse {
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  mean: number;
  probabilityBelow: number;
  threshold: number;
  /** Histogram bins for the chart: [from, count]. */
  bins: [number, number][];
  runs: number;
}

/** Monte Carlo off the main thread (spec 7.3). Pure engine call plus binning. */
self.onmessage = (e: MessageEvent<McRequest & { threshold: number }>) => {
  const { assumptions, dists, runs, seed, threshold } = e.data;
  const r = monteCarlo(assumptions, dists, { runs, seed, threshold });
  const lo = r.samples[0] ?? 0;
  const hi = r.samples[r.samples.length - 1] ?? 0;
  const n = 40;
  const width = (hi - lo) / n || 1;
  const counts = new Array<number>(n).fill(0);
  for (const s of r.samples) {
    const i = Math.min(n - 1, Math.floor((s - lo) / width));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  const bins = counts.map((c, i): [number, number] => [lo + i * width, c]);
  const out: McResponse = { p5: r.p5, p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90, p95: r.p95, mean: r.mean, probabilityBelow: r.probabilityBelow, threshold: r.threshold, bins, runs: r.runs };
  self.postMessage(out);
};
