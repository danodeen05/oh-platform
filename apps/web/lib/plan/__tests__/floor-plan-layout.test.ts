import { describe, expect, it } from "vitest";
import { BASE_ASSUMPTIONS } from "@oh/plan-model";
import {
  ANIMATED_STEPS,
  AREAS,
  BOWL_PATH,
  BUILDING,
  CROSS_AISLE,
  DIRTY_PATH,
  DUO_PAIRS,
  GUEST_AISLES,
  GUEST_EXIT_PATH,
  GUEST_PATH,
  GUEST_RECTS,
  JOURNEY_REAL_SECONDS,
  JOURNEY_STEPS,
  JOURNEY_TARGET,
  OPENINGS,
  PODS,
  ROWS,
  STAFF_CORRIDORS,
  STAFF_RECTS,
  TOTAL_SQFT,
  WALLS,
  ZONES,
  generatePods,
  journeyClock,
  journeyMarkers,
  samplePath,
  territory,
  type Point,
  type Rect,
} from "@/components/plan/modules/floor-plan/layout";

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/** Proper segment intersection (touching at an endpoint counts). */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSeg = (a: Point, b: Point, c: Point) =>
    Math.min(a[0], b[0]) - 1e-9 <= c[0] && c[0] <= Math.max(a[0], b[0]) + 1e-9 && Math.min(a[1], b[1]) - 1e-9 <= c[1] && c[1] <= Math.max(a[1], b[1]) + 1e-9;
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && onSeg(p3, p4, p1)) return true;
  if (d2 === 0 && onSeg(p3, p4, p2)) return true;
  if (d3 === 0 && onSeg(p1, p2, p3)) return true;
  if (d4 === 0 && onSeg(p1, p2, p4)) return true;
  return false;
}
const segments = (path: readonly Point[]): [Point, Point][] => path.slice(1).map((p, i) => [path[i] as Point, p]);

describe("comb floor plan geometry", () => {
  it("holds exactly the base pod count and fills rows in order", () => {
    expect(PODS.length).toBe(BASE_ASSUMPTIONS.pods);
    const sixty = generatePods(60);
    expect(sixty.length).toBe(60);
    expect(sixty.filter((p) => p.row === 1).length).toBe(13);
    expect(sixty.filter((p) => p.row === 5).length).toBe(10);
    expect(sixty.filter((p) => p.row === 6).length).toBe(0);
    expect(() => generatePods(76)).toThrow();
  });

  it("has no overlapping pods and every pod inside its row and the building", () => {
    for (let i = 0; i < PODS.length; i += 1) {
      const a = PODS[i]!;
      const row = ROWS[a.row - 1]!;
      expect(a.x >= row.x && a.x + a.w <= row.x + row.w + 1e-9).toBe(true);
      expect(a.y >= row.y && a.y + a.h <= row.y + row.h + 1e-9).toBe(true);
      expect(a.x >= 0 && a.y >= 0 && a.x + a.w <= BUILDING.w && a.y + a.h <= BUILDING.h).toBe(true);
      for (let j = i + 1; j < PODS.length; j += 1) expect(overlaps(a, PODS[j]!)).toBe(false);
    }
  });

  it("puts every hatch on a staff corridor and every seat on a guest aisle", () => {
    for (const p of PODS) {
      const corridor = STAFF_CORRIDORS[p.corridor - 1]!;
      const hatchX = p.hatch === "east" ? p.x + p.w : p.x;
      expect(near(hatchX, p.hatch === "east" ? corridor.x : corridor.x + corridor.w)).toBe(true);
      expect(p.y >= corridor.y && p.y + p.h <= corridor.y + corridor.h).toBe(true);
      const aisle = GUEST_AISLES[p.aisle - 1]!;
      const seatX = p.facing === "west" ? p.x : p.x + p.w;
      expect(near(seatX, p.facing === "west" ? aisle.x + aisle.w : aisle.x)).toBe(true);
    }
  });

  it("keeps guest paths in guest territory and staff paths in staff territory", () => {
    for (const path of [GUEST_PATH, GUEST_EXIT_PATH]) for (const pt of samplePath(path)) expect(territory(pt)).toBe("guest");
    for (const path of [BOWL_PATH, DIRTY_PATH]) for (const pt of samplePath(path)) expect(territory(pt)).toBe("staff");
  });

  it("never lets a guest segment touch a staff segment", () => {
    const guest = [...segments(GUEST_PATH), ...segments(GUEST_EXIT_PATH)];
    const staff = [...segments(BOWL_PATH), ...segments(DIRTY_PATH)];
    for (const [g1, g2] of guest) for (const [s1, s2] of staff) expect(segmentsIntersect(g1, g2, s1, s2)).toBe(false);
  });

  it("derives areas that sum to the building and keeps the territories disjoint", () => {
    expect(TOTAL_SQFT).toBe(BASE_ASSUMPTIONS.squareFeet);
    expect(BUILDING.w * BUILDING.h).toBe(BASE_ASSUMPTIONS.squareFeet);
    const everything: Rect[] = [...ZONES, ...STAFF_CORRIDORS, ...GUEST_AISLES, CROSS_AISLE, ...ROWS];
    expect(everything.reduce((s, r) => s + r.w * r.h, 0)).toBe(TOTAL_SQFT);
    for (const g of GUEST_RECTS) for (const s of STAFF_RECTS) expect(overlaps(g, s)).toBe(false);
    expect(AREAS.every((a) => a.sqft > 0)).toBe(true);
  });

  it("closes every staff corridor at the front", () => {
    for (const c of STAFF_CORRIDORS) {
      const endY = c.y + c.h;
      const closed = WALLS.some(([a, b]) => near(a[1], endY) && near(b[1], endY) && Math.min(a[0], b[0]) <= c.x + 1e-9 && Math.max(a[0], b[0]) >= c.x + c.w - 1e-9);
      expect(closed).toBe(true);
      expect(OPENINGS.some((o) => o.axis === "x" && near(o.y, endY) && o.x < c.x + c.w && o.x + o.len > c.x)).toBe(false);
    }
  });

  it("pairs duos as adjacent pods on the outer rows", () => {
    expect(DUO_PAIRS.length).toBe(5);
    for (const [a, b] of DUO_PAIRS) {
      const pa = PODS.find((p) => p.number === a)!;
      const pb = PODS.find((p) => p.number === b)!;
      expect(pa.row).toBe(pb.row);
      expect(pb.position - pa.position).toBe(1);
      expect(pa.row === 1 || pa.row === 6).toBe(true);
    }
  });

  it("keeps the journey monotonic and the markers in their territories", () => {
    for (let i = 1; i < ANIMATED_STEPS.length; i += 1) {
      expect((ANIMATED_STEPS[i]!.at as number) >= (ANIMATED_STEPS[i - 1]!.at as number)).toBe(true);
      expect(ANIMATED_STEPS[i]!.realSeconds >= ANIMATED_STEPS[i - 1]!.realSeconds).toBe(true);
    }
    expect(ANIMATED_STEPS[ANIMATED_STEPS.length - 1]!.at).toBe(1);
    expect(JOURNEY_STEPS.find((s) => s.key === "delivered")!.realSeconds).toBe(420);
    expect(journeyClock(1)).toBe(JOURNEY_REAL_SECONDS);
    expect(journeyClock(0)).toBe(0);
    expect(JOURNEY_TARGET.finger).toBe(2);
    for (let p = 0; p <= 1; p += 0.01) {
      const m = journeyMarkers(p);
      expect(territory(m.guest as Point)).toBe("guest");
      if (m.bowl) expect(territory(m.bowl as Point)).toBe("staff");
    }
    const end = journeyMarkers(1);
    expect(end.bowl).toBeNull();
  });
});
