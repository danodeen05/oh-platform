/**
 * Flagship floor plan geometry (spec 6.2). Feet, origin top-left, y down.
 * Everything here is derived from a few dimensions so the square-footage
 * panel and the honesty note read from the same numbers the drawing uses.
 */
import { BASE_ASSUMPTIONS } from "@oh/plan-model";

export const FT = 12; // px per foot in the SVG
export const BUILDING = { w: 70, h: 50 } as const; // 3,500 sf

export type ZoneKey = "entry" | "dining" | "kitchen" | "boh" | "restrooms";
export type LayerKey = "pods" | "kitchen" | "corridors" | "boh" | "restrooms" | "entry";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Zone extends Rect {
  key: ZoneKey;
}

export const ZONES: readonly Zone[] = [
  { key: "entry", x: 0, y: 0, w: 70, h: 2.5 },
  { key: "dining", x: 0, y: 2.5, w: 70, h: 22.5 },
  { key: "kitchen", x: 0, y: 25, w: 44, h: 25 },
  { key: "boh", x: 44, y: 25, w: 19, h: 25 },
  { key: "restrooms", x: 63, y: 25, w: 7, h: 25 },
];

export const KIOSKS: readonly Rect[] = [2, 6, 10].map((x) => ({ x, y: 0.5, w: 3, h: 1.5 }));

/** Sliding-panel delivery corridors run behind the pod rows. */
export const CORRIDORS: readonly (Rect & { key: string })[] = [
  { key: "corridor-north", x: 2.5, y: 7, w: 65, h: 2.5 },
  { key: "corridor-south", x: 2.5, y: 22, w: 65, h: 3 },
];
export const AISLES: readonly (Rect & { key: string })[] = [
  { key: "aisle-central", x: 2.5, y: 14, w: 65, h: 3.5 },
  { key: "aisle-west", x: 0, y: 2.5, w: 2.5, h: 22.5 },
  { key: "aisle-east", x: 67.5, y: 2.5, w: 2.5, h: 22.5 },
];

export const POD = { w: 2.35, d: 4.5, pitch: 2.6, perRow: 25 } as const;
export const ROWS: readonly { y: number; facing: "north" | "south"; panel: "north" | "south" }[] = [
  { y: 2.5, facing: "north", panel: "south" }, // row 1 faces the entry aisle, panel on the north corridor
  { y: 9.5, facing: "south", panel: "north" }, // row 2 faces the central aisle
  { y: 17.5, facing: "north", panel: "south" }, // row 3 faces the central aisle, panel on the south corridor
];
const ROW_X0 = 2.5;
/** Row 3 pairs with a removable partition (convertible duos). */
const DUO_PAIRS = new Set([51, 52, 55, 56, 59, 60, 63, 64, 67, 68]);

export interface Pod extends Rect {
  number: number;
  row: number;
  position: number;
  type: "single" | "duo";
  panel: "north" | "south";
  facing: "north" | "south";
}

export function generatePods(count: number = BASE_ASSUMPTIONS.pods): Pod[] {
  const pods: Pod[] = [];
  let n = 1;
  for (let r = 0; r < ROWS.length && n <= count; r += 1) {
    const row = ROWS[r] as (typeof ROWS)[number];
    for (let i = 0; i < POD.perRow && n <= count; i += 1) {
      pods.push({
        number: n,
        row: r + 1,
        position: i + 1,
        type: DUO_PAIRS.has(n) ? "duo" : "single",
        panel: row.panel,
        facing: row.facing,
        x: ROW_X0 + i * POD.pitch + (POD.pitch - POD.w) / 2,
        y: row.y,
        w: POD.w,
        h: POD.d,
      });
      n += 1;
    }
  }
  return pods;
}

export const PODS: readonly Pod[] = generatePods();

export interface AreaLine {
  key: "dining" | "kitchen" | "boh" | "circulation";
  sqft: number;
}
/** Spec 6.2 breakdown, read from the zone geometry. Restrooms and the entry strip are circulation. */
export const AREAS: readonly AreaLine[] = [
  { key: "dining", sqft: 70 * 22.5 },
  { key: "kitchen", sqft: 44 * 25 },
  { key: "boh", sqft: 19 * 25 },
  { key: "circulation", sqft: 7 * 25 + 70 * 2.5 },
];
export const TOTAL_SQFT = AREAS.reduce((s, a) => s + a.sqft, 0);
export const DINING_SQFT_PER_POD = (AREAS[0] as AreaLine).sqft / PODS.length;

export interface JourneyStep {
  key: "order" | "assigned" | "seated" | "fired" | "assembled" | "corridor" | "delivered";
  /** Real elapsed seconds. */
  realSeconds: number;
  /** Progress 0..1 through the 45-second animation. */
  at: number;
}
export const JOURNEY_SECONDS = 45;
export const JOURNEY_REAL_SECONDS = 430;
export const JOURNEY_STEPS: readonly JourneyStep[] = [
  { key: "order", realSeconds: 0, at: 0 },
  { key: "assigned", realSeconds: 20, at: 0.05 },
  { key: "seated", realSeconds: 60, at: 0.2 },
  { key: "fired", realSeconds: 75, at: 0.25 },
  { key: "assembled", realSeconds: 390, at: 0.72 },
  { key: "corridor", realSeconds: 405, at: 0.8 },
  { key: "delivered", realSeconds: 430, at: 1 },
];
export const JOURNEY_POD = 38;
const target = PODS.find((p) => p.number === JOURNEY_POD) as Pod;
export const JOURNEY_TARGET = target;
/** Guest walk: kiosk, east along the entry aisle, down the east aisle, west along the central aisle to the pod front. */
export const GUEST_PATH: readonly [number, number][] = [
  [8, 1.25],
  [68.75, 1.25],
  [68.75, 15.75],
  [target.x + target.w / 2, 15.75],
  [target.x + target.w / 2, target.y + target.h - 0.4],
];
/** Bowl: kitchen pass, west aisle, north corridor east to the pod's panel. */
export const BOWL_PATH: readonly [number, number][] = [
  [22, 26],
  [1.25, 26],
  [1.25, 8.25],
  [target.x + target.w / 2, 8.25],
  [target.x + target.w / 2, target.y + 0.4],
];

/** Point along a polyline at fraction t (0..1) of its length. */
export function pointAt(path: readonly [number, number][], t: number): [number, number] {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const [ax, ay] = path[i - 1] as [number, number];
    const [bx, by] = path[i] as [number, number];
    const len = Math.hypot(bx - ax, by - ay);
    segs.push(len);
    total += len;
  }
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < path.length; i += 1) {
    const len = segs[i - 1] as number;
    const [ax, ay] = path[i - 1] as [number, number];
    const [bx, by] = path[i] as [number, number];
    if (remaining <= len || i === path.length - 1) {
      const f = len === 0 ? 0 : Math.min(1, remaining / len);
      return [ax + (bx - ax) * f, ay + (by - ay) * f];
    }
    remaining -= len;
  }
  return path[path.length - 1] as [number, number];
}
