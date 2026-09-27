import { describe, expect, it } from "vitest";
import { buildLayout, LOCATION_LAYOUTS, podLabel, parsePodLabel, entryWalkDistance, rankPodsByEntry } from "../src";

const overlaps = (a: {x:number;y:number;w:number;h:number}, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("buildLayout", () => {
  it("default equals the plan layout byte for byte", () => {
    expect(JSON.stringify(buildLayout())).toMatchSnapshot();
  });
  it("City Creek: 75 pods, unmirrored, rows 13/12 per finger", () => {
    const l = buildLayout(LOCATION_LAYOUTS["comb-75"]);
    expect(l.pods).toHaveLength(75);
    expect(l.rows.map((r) => r.capacity)).toEqual([13, 12, 13, 12, 13, 12]);
    expect(l.duoPairs).toHaveLength(5);
  });
  it("University Place: 70 pods, front pod trimmed from 5 of 6 rows, 5 duos kept", () => {
    const l = buildLayout(LOCATION_LAYOUTS["comb-70-mirrored"]);
    expect(l.pods).toHaveLength(70);
    const perRow = l.rows.map((r) => l.pods.filter((p) => p.row === r.key).length);
    expect(perRow).toEqual([12, 11, 12, 11, 12, 12]);
    expect(l.duoPairs).toHaveLength(5);
  });
  it("mirror reflects every rect across x = 35 and swaps sides", () => {
    const a = buildLayout({ pods: 75, mirror: false });
    const b = buildLayout({ pods: 75, mirror: true });
    a.pods.forEach((p, i) => {
      const q = b.pods[i]!;
      expect(q.x).toBeCloseTo(70 - p.x - p.w, 9);
      expect(q.y).toBeCloseTo(p.y, 9);
      expect(q.side).toBe(p.side === "west" ? "east" : "west");
    });
    const store = (l: typeof a) => l.zones.find((z) => z.key === "store")!;
    expect(store(b).x).toBeCloseTo(70 - store(a).x - store(a).w, 9);
  });
  it.each([["comb-75"], ["comb-70-mirrored"]] as const)("%s: no pod overlaps, areas sum to 3,500, paths stay in their territory", (key) => {
    const l = buildLayout(LOCATION_LAYOUTS[key]);
    for (let i = 0; i < l.pods.length; i++) for (let j = i + 1; j < l.pods.length; j++) expect(overlaps(l.pods[i]!, l.pods[j]!)).toBe(false);
    expect(l.totalSqft).toBeCloseTo(3500, 6);
    for (const p of l.guestPath) expect(l.territory(p)).not.toBe("staff");
    for (const p of l.bowlPath) expect(l.territory(p)).not.toBe("guest");
  });
  it("plan journey still targets pod 32 (plan status demo copy depends on it)", () => {
    expect(buildLayout().journeyTarget.number).toBe(32);
  });
  it("labels are finger letter + 2-digit position and round-trip", () => {
    const l = buildLayout(LOCATION_LAYOUTS["comb-75"]);
    const labels = l.pods.map(podLabel);
    expect(new Set(labels).size).toBe(75);
    expect(labels[0]).toMatch(/^A-0[1-9]$/);
    for (const p of l.pods) expect(parsePodLabel(podLabel(p))).toEqual({ finger: p.finger, position: p.position });
    expect(parsePodLabel("Z-99")).toBeNull();
  });
});

describe("rankPodsByEntry (Task A8: best pod = nearest free pod to the entry)", () => {
  it.each([["comb-75"], ["comb-70-mirrored"]] as const)("%s: rank 1 is nearer the entry than the last-ranked pod", (key) => {
    const l = buildLayout(LOCATION_LAYOUTS[key]);
    const ranks = rankPodsByEntry(l);
    expect(ranks.size).toBe(l.pods.length);
    const byRank = [...l.pods].sort((a, b) => (ranks.get(a.number) as number) - (ranks.get(b.number) as number));
    const nearest = byRank[0]!;
    const farthest = byRank[byRank.length - 1]!;
    expect(ranks.get(nearest.number)).toBe(1);
    expect(ranks.get(farthest.number)).toBe(l.pods.length);
    expect(entryWalkDistance(l, nearest)).toBeLessThan(entryWalkDistance(l, farthest));
  });

  it("ranks are exactly 1..N with no gaps or repeats", () => {
    const l = buildLayout(LOCATION_LAYOUTS["comb-75"]);
    const ranks = rankPodsByEntry(l);
    const values = [...ranks.values()].sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 75 }, (_, i) => i + 1));
  });

  it("the mirrored layout's rank-1 pod is on the opposite side from the unmirrored one", () => {
    const unmirrored = buildLayout({ pods: 70, mirror: false });
    const mirrored = buildLayout({ pods: 70, mirror: true });
    const rank1 = (l: typeof unmirrored) => {
      const ranks = rankPodsByEntry(l);
      return l.pods.find((p) => ranks.get(p.number) === 1)!;
    };
    const a = rank1(unmirrored);
    const b = rank1(mirrored);
    expect(a.side).not.toBe(b.side);
  });
});
