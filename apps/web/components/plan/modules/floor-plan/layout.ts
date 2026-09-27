/**
 * Flagship floor plan geometry (spec 6.2): the comb service layout.
 *
 * Feet, origin top-left, y down. The rear wall (kitchen) is y = 0 and the
 * street is y = BUILDING.h. Everything below derives from DIMS and from
 * BASE_ASSUMPTIONS, so the square-footage panel, the honesty note, the 2D
 * drawing, the print drawing and the 3D scene all read the same numbers.
 *
 * The idea in one sentence: the kitchen spans the rear wall, three staff-only
 * corridors run forward from it like the fingers of a comb, pods line both
 * sides of every corridor with their food hatch facing the corridor and their
 * seat facing a guest aisle, and guests only ever walk the aisles between the
 * fingers and the cross-aisle along the front. The two territories, guest and
 * staff, touch at the hatches and nowhere else.
 *
 * Capacity is 75 pods at 13/12 per finger side. `generatePods(count)` fills
 * rows in order so a lower pod count is a live input; a higher count throws,
 * because it would need longer fingers or a fourth finger.
 */
import { BASE_ASSUMPTIONS } from "@oh/plan-model";

export const FT = 12; // px per foot in the SVG
export const BUILDING = { w: 70, h: 50 } as const; // 3,500 sf

/** The handful of dimensions everything else is computed from. */
export const DIMS = {
  rear: 11, // kitchen strip depth
  kitchenW: 47,
  dishW: 9,
  fingerLen: 34,
  corridorW: 4,
  aisleW: 4,
  podDepth: 4.5,
  crossAisle: 5,
  columnW: 15, // right column: restrooms, store, lobby
  hallH: 5,
  restroomH: 8,
  storeH: 12,
} as const;

/** Heights in feet for the 3D view. */
export const HEIGHTS = {
  wall: 10,
  podPartition: 6.5,
  hatchSill: 2.75,
  hatchHead: 4.5,
  kiosk: 4,
  counter: 3,
  door: 7,
  floor: 0.15,
} as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Territory = "guest" | "staff";
export type Side = "west" | "east";
export type Point = readonly [number, number];

const FINGER_W = DIMS.podDepth * 2 + DIMS.corridorW; // 13
const COLUMN_X = BUILDING.w - DIMS.columnW; // 55
const FINGER_END_Y = DIMS.rear + DIMS.fingerLen; // 45
const LOBBY_H = BUILDING.h - DIMS.rear - DIMS.hallH - DIMS.restroomH - DIMS.storeH; // 14
const BOH_X = DIMS.kitchenW + DIMS.dishW; // 56

export type ZoneKey = "kitchen" | "dish" | "boh" | "restroomHall" | "restroomMen" | "restroomWomen" | "store" | "lobby";
export interface Zone extends Rect {
  key: ZoneKey;
  territory: Territory;
}

const RESTROOM_Y = DIMS.rear + DIMS.hallH; // 16
const STORE_Y = RESTROOM_Y + DIMS.restroomH; // 24
const LOBBY_Y = STORE_Y + DIMS.storeH; // 36

export const ZONES: readonly Zone[] = [
  { key: "kitchen", x: 0, y: 0, w: DIMS.kitchenW, h: DIMS.rear, territory: "staff" },
  { key: "dish", x: DIMS.kitchenW, y: 0, w: DIMS.dishW, h: DIMS.rear, territory: "staff" },
  { key: "boh", x: BOH_X, y: 0, w: BUILDING.w - BOH_X, h: DIMS.rear, territory: "staff" },
  { key: "restroomHall", x: COLUMN_X, y: DIMS.rear, w: DIMS.columnW, h: DIMS.hallH, territory: "guest" },
  { key: "restroomMen", x: COLUMN_X, y: RESTROOM_Y, w: DIMS.columnW / 2, h: DIMS.restroomH, territory: "guest" },
  { key: "restroomWomen", x: COLUMN_X + DIMS.columnW / 2, y: RESTROOM_Y, w: DIMS.columnW / 2, h: DIMS.restroomH, territory: "guest" },
  { key: "store", x: COLUMN_X, y: STORE_Y, w: DIMS.columnW, h: DIMS.storeH, territory: "guest" },
  { key: "lobby", x: COLUMN_X, y: LOBBY_Y, w: DIMS.columnW, h: LOBBY_H, territory: "guest" },
];
export function zone(key: ZoneKey): Zone {
  return ZONES.find((z) => z.key === key) as Zone;
}

export type FingerIndex = 1 | 2 | 3;
export interface Finger extends Rect {
  index: FingerIndex;
}
export const FINGERS: readonly Finger[] = ([1, 2, 3] as const).map((index) => ({
  index,
  x: DIMS.aisleW + (index - 1) * (FINGER_W + DIMS.aisleW),
  y: DIMS.rear,
  w: FINGER_W,
  h: DIMS.fingerLen,
}));

export interface StaffCorridor extends Rect {
  key: `corridor-${FingerIndex}`;
  finger: FingerIndex;
}
export const STAFF_CORRIDORS: readonly StaffCorridor[] = FINGERS.map((f) => ({
  key: `corridor-${f.index}`,
  finger: f.index,
  x: f.x + DIMS.podDepth,
  y: f.y,
  w: DIMS.corridorW,
  h: f.h,
}));

export type AisleIndex = 1 | 2 | 3 | 4;
export interface GuestAisle extends Rect {
  key: `aisle-${AisleIndex}`;
  index: AisleIndex;
}
export const GUEST_AISLES: readonly GuestAisle[] = ([1, 2, 3, 4] as const).map((index) => ({
  key: `aisle-${index}`,
  index,
  x: (index - 1) * (FINGER_W + DIMS.aisleW),
  y: DIMS.rear,
  w: DIMS.aisleW,
  h: DIMS.fingerLen,
}));
export const CROSS_AISLE: Rect = { x: 0, y: FINGER_END_Y, w: COLUMN_X, h: DIMS.crossAisle };
/** Hand-off band inside the kitchen's front edge, feeding the corridor mouths. */
export const PASS: Rect = { x: 0, y: DIMS.rear - 1, w: DIMS.kitchenW, h: 1 };
export const KIOSKS: readonly Rect[] = [1.5, 5.5, 9.5].map((dx) => ({ x: COLUMN_X + dx, y: LOBBY_Y + 0.5, w: 3, h: 1.5 }));

/** Wall segments: [[x1, y1], [x2, y2]]. Walls are strokes on zone edges. */
export type Wall = readonly [Point, Point];
export const WALLS: readonly Wall[] = [
  // perimeter
  [[0, 0], [BUILDING.w, 0]],
  [[BUILDING.w, 0], [BUILDING.w, BUILDING.h]],
  [[BUILDING.w, BUILDING.h], [0, BUILDING.h]],
  [[0, BUILDING.h], [0, 0]],
  // kitchen front wall, broken only at the three corridor mouths
  [[0, DIMS.rear], [STAFF_CORRIDORS[0]!.x, DIMS.rear]],
  [[STAFF_CORRIDORS[0]!.x + DIMS.corridorW, DIMS.rear], [STAFF_CORRIDORS[1]!.x, DIMS.rear]],
  [[STAFF_CORRIDORS[1]!.x + DIMS.corridorW, DIMS.rear], [STAFF_CORRIDORS[2]!.x, DIMS.rear]],
  [[STAFF_CORRIDORS[2]!.x + DIMS.corridorW, DIMS.rear], [BUILDING.w, DIMS.rear]],
  // kitchen / dish (opening y 6..10), dish / boh (door y 4..7)
  [[DIMS.kitchenW, 0], [DIMS.kitchenW, 6]],
  [[DIMS.kitchenW, 10], [DIMS.kitchenW, DIMS.rear]],
  [[BOH_X, 0], [BOH_X, 4]],
  [[BOH_X, 7], [BOH_X, DIMS.rear]],
  // corridor closures at the front of every finger (the whole finger width)
  ...FINGERS.map((f): Wall => [[f.x, FINGER_END_Y], [f.x + f.w, FINGER_END_Y]]),
  // right column west wall, broken at the hall, the store and the lobby openings
  [[COLUMN_X, RESTROOM_Y], [COLUMN_X, STORE_Y + 4]],
  [[COLUMN_X, STORE_Y + 8], [COLUMN_X, FINGER_END_Y]],
  // hall / restrooms (doors at x 57..60 and 64.5..67.5)
  [[COLUMN_X, RESTROOM_Y], [COLUMN_X + 2, RESTROOM_Y]],
  [[COLUMN_X + 5, RESTROOM_Y], [COLUMN_X + 9.5, RESTROOM_Y]],
  [[COLUMN_X + 12.5, RESTROOM_Y], [BUILDING.w, RESTROOM_Y]],
  [[COLUMN_X + DIMS.columnW / 2, RESTROOM_Y], [COLUMN_X + DIMS.columnW / 2, STORE_Y]],
  [[COLUMN_X, STORE_Y], [BUILDING.w, STORE_Y]],
  [[COLUMN_X, LOBBY_Y], [BUILDING.w, LOBBY_Y]],
];

export type DoorKey = "entry" | "exit" | "staff" | "receiving" | "restroomMen" | "restroomWomen" | "kitchenDish" | "dishBoh";
export interface Door {
  key: DoorKey;
  /** Start of the leaf along its wall. */
  x: number;
  y: number;
  len: number;
  /** "x": the door sits in a horizontal wall; "y": in a vertical wall. */
  axis: "x" | "y";
  /** Which way the leaf swings, as the direction of the swing in plan. */
  swing: "north" | "south" | "east" | "west" | "none";
  territory: Territory;
}
export const DOORS: readonly Door[] = [
  { key: "entry", x: COLUMN_X + 5, y: BUILDING.h, len: 3, axis: "x", swing: "north", territory: "guest" },
  { key: "exit", x: BUILDING.w, y: STORE_Y + 4, len: 3, axis: "y", swing: "east", territory: "guest" },
  { key: "staff", x: 3, y: 0, len: 3, axis: "x", swing: "south", territory: "staff" },
  { key: "receiving", x: COLUMN_X + 5, y: 0, len: 3, axis: "x", swing: "south", territory: "staff" },
  { key: "restroomMen", x: COLUMN_X + 2, y: RESTROOM_Y, len: 3, axis: "x", swing: "south", territory: "guest" },
  { key: "restroomWomen", x: COLUMN_X + 9.5, y: RESTROOM_Y, len: 3, axis: "x", swing: "south", territory: "guest" },
  { key: "kitchenDish", x: DIMS.kitchenW, y: 6, len: 4, axis: "y", swing: "none", territory: "staff" },
  { key: "dishBoh", x: BOH_X, y: 4, len: 3, axis: "y", swing: "east", territory: "staff" },
];
export function door(key: DoorKey): Door {
  return DOORS.find((d) => d.key === key) as Door;
}

export type OpeningKey = "mouth-1" | "mouth-2" | "mouth-3" | "hall" | "store" | "lobby";
export interface Opening {
  key: OpeningKey;
  x: number;
  y: number;
  len: number;
  axis: "x" | "y";
  territory: Territory;
}
export const OPENINGS: readonly Opening[] = [
  ...STAFF_CORRIDORS.map((c): Opening => ({ key: `mouth-${c.finger}`, x: c.x, y: DIMS.rear, len: c.w, axis: "x", territory: "staff" })),
  { key: "hall", x: COLUMN_X, y: DIMS.rear, len: DIMS.hallH, axis: "y", territory: "guest" },
  { key: "store", x: COLUMN_X, y: STORE_Y + 4, len: 4, axis: "y", territory: "guest" },
  { key: "lobby", x: COLUMN_X, y: FINGER_END_Y, len: DIMS.crossAisle, axis: "y", territory: "guest" },
];

/** w = seat width along the row (y), d = depth toward the corridor (x). */
export const POD = { w: 2.35, d: 4.5, pitch: 2.6 } as const;
const ROW_INSET = 0.1;
export const ROW_CAPACITY = Math.floor((DIMS.fingerLen - 2 * ROW_INSET) / POD.pitch + 1e-9); // 13 (epsilon: 33.8 / 2.6 is 12.999… in floating point)

export type RowKey = `f${FingerIndex}${"w" | "e"}`;
export interface Row extends Rect {
  key: RowKey;
  finger: FingerIndex;
  side: Side;
  capacity: number;
  /** Which way the seat faces (toward the guest aisle). */
  facing: Side;
  /** Which edge carries the hatch (toward the staff corridor). */
  hatch: Side;
  /** The guest aisle the seat opens onto. */
  aisle: AisleIndex;
}
export const ROWS: readonly Row[] = FINGERS.flatMap((f): Row[] => [
  { key: `f${f.index}w`, finger: f.index, side: "west", x: f.x, y: f.y, w: DIMS.podDepth, h: f.h, capacity: ROW_CAPACITY, facing: "west", hatch: "east", aisle: f.index },
  { key: `f${f.index}e`, finger: f.index, side: "east", x: f.x + DIMS.podDepth + DIMS.corridorW, y: f.y, w: DIMS.podDepth, h: f.h, capacity: ROW_CAPACITY - 1, facing: "east", hatch: "west", aisle: (f.index + 1) as AisleIndex },
]);
export const POD_CAPACITY = ROWS.reduce((s, r) => s + r.capacity, 0); // 75

export interface Pod extends Rect {
  number: number;
  finger: FingerIndex;
  side: Side;
  /** Row 1..6 in drawing order. */
  row: number;
  /** Position along the row, 1 = nearest the kitchen. */
  position: number;
  type: "single" | "duo";
  duoWith?: number;
  facing: Side;
  hatch: Side;
  aisle: AisleIndex;
  corridor: FingerIndex;
}

/** Convertible duos (removable partition between neighbours), outer rows only. */
const DUO_PAIR_SLOTS: readonly { row: RowKey; positions: readonly [number, number] }[] = [
  { row: "f1w", positions: [2, 3] },
  { row: "f1w", positions: [6, 7] },
  { row: "f1w", positions: [10, 11] },
  { row: "f3e", positions: [3, 4] },
  { row: "f3e", positions: [8, 9] },
];

export function generatePods(count: number = BASE_ASSUMPTIONS.pods): Pod[] {
  if (count > POD_CAPACITY) {
    throw new Error(`The comb layout holds ${POD_CAPACITY} pods; ${count} would need longer fingers or a fourth finger.`);
  }
  const pods: Pod[] = [];
  let n = 1;
  ROWS.forEach((row, r) => {
    for (let i = 0; i < row.capacity && n <= count; i += 1) {
      pods.push({
        number: n,
        finger: row.finger,
        side: row.side,
        row: r + 1,
        position: i + 1,
        type: "single",
        facing: row.facing,
        hatch: row.hatch,
        aisle: row.aisle,
        corridor: row.finger,
        x: row.x,
        y: row.y + ROW_INSET + i * POD.pitch + (POD.pitch - POD.w) / 2,
        w: POD.d,
        h: POD.w,
      });
      n += 1;
    }
  });
  for (const slot of DUO_PAIR_SLOTS) {
    const row = ROWS.find((r) => r.key === slot.row) as Row;
    const a = pods.find((p) => p.finger === row.finger && p.side === row.side && p.position === slot.positions[0]);
    const b = pods.find((p) => p.finger === row.finger && p.side === row.side && p.position === slot.positions[1]);
    if (a && b) {
      a.type = "duo";
      b.type = "duo";
      a.duoWith = b.number;
      b.duoWith = a.number;
    }
  }
  return pods;
}

export const PODS: readonly Pod[] = generatePods();
export const DUO_PAIRS: readonly [number, number][] = PODS.filter((p) => p.type === "duo" && p.duoWith !== undefined && p.number < (p.duoWith as number)).map((p) => [
  p.number,
  p.duoWith as number,
]);
export function pod(number: number): Pod | undefined {
  return PODS.find((p) => p.number === number);
}

/* ---------------------------------------------------------------- areas */

export const area = (r: Rect): number => r.w * r.h;
const sum = (rects: readonly Rect[]): number => rects.reduce((s, r) => s + area(r), 0);

export type AreaKey = "pods" | "staffCorridors" | "guestAisles" | "lobby" | "store" | "restrooms" | "kitchen" | "dish" | "boh";
export interface AreaLine {
  key: AreaKey;
  sqft: number;
  territory: Territory;
}
/** Every line is a sum of rectangle areas; nothing here is typed in by hand. */
export const AREAS: readonly AreaLine[] = [
  { key: "pods", sqft: sum(ROWS), territory: "guest" },
  { key: "staffCorridors", sqft: sum(STAFF_CORRIDORS), territory: "staff" },
  { key: "guestAisles", sqft: sum(GUEST_AISLES) + area(CROSS_AISLE), territory: "guest" },
  { key: "lobby", sqft: area(zone("lobby")), territory: "guest" },
  { key: "store", sqft: area(zone("store")), territory: "guest" },
  { key: "restrooms", sqft: area(zone("restroomHall")) + area(zone("restroomMen")) + area(zone("restroomWomen")), territory: "guest" },
  { key: "kitchen", sqft: area(zone("kitchen")), territory: "staff" },
  { key: "dish", sqft: area(zone("dish")), territory: "staff" },
  { key: "boh", sqft: area(zone("boh")), territory: "staff" },
];
export const TOTAL_SQFT = AREAS.reduce((s, a) => s + a.sqft, 0);
export const TERRITORY_TOTALS: Record<Territory, number> = {
  guest: AREAS.filter((a) => a.territory === "guest").reduce((s, a) => s + a.sqft, 0),
  staff: AREAS.filter((a) => a.territory === "staff").reduce((s, a) => s + a.sqft, 0),
};
const areaOf = (key: AreaKey): number => (AREAS.find((a) => a.key === key) as AreaLine).sqft;
/** Pods plus the corridor behind them plus the aisles in front, per pod. */
export const DINING_SQFT_PER_POD = (areaOf("pods") + areaOf("staffCorridors") + areaOf("guestAisles")) / PODS.length;

/** Facts a landlord or broker asks first. All read from the geometry. */
export const SHELL_FACTS = {
  w: BUILDING.w,
  d: BUILDING.h,
  sqft: TOTAL_SQFT,
  frontFt: BUILDING.w,
  doors: DOORS.filter((d) => d.key === "entry" || d.key === "exit" || d.key === "staff" || d.key === "receiving").length,
  kitchenDepth: DIMS.rear,
  corridorW: DIMS.corridorW,
  aisleW: DIMS.aisleW,
  crossAisle: DIMS.crossAisle,
  pods: PODS.length,
  kiosks: KIOSKS.length,
  restrooms: 2,
  hatches: PODS.length,
} as const;

/* ------------------------------------------------------------ territory */

/** Guest territory: aisles, cross-aisle, the right column, and the pod rows (the guest sits in them). */
export const GUEST_RECTS: readonly Rect[] = [...GUEST_AISLES, CROSS_AISLE, ...ZONES.filter((z) => z.territory === "guest"), ...ROWS];
/** Staff territory: kitchen strip and the corridors. */
export const STAFF_RECTS: readonly Rect[] = [...ZONES.filter((z) => z.territory === "staff"), ...STAFF_CORRIDORS];

/** Half-open containment so a point on a shared edge resolves to exactly one rect. */
export const inRect = ([x, y]: Point, r: Rect): boolean => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

export function territory(p: Point): Territory | null {
  if (STAFF_RECTS.some((r) => inRect(p, r))) return "staff";
  if (GUEST_RECTS.some((r) => inRect(p, r))) return "guest";
  return null;
}

/* -------------------------------------------------------------- journey */

export type Actor = "guest" | "kitchen" | "both";
export interface JourneyStep {
  key:
    | "paid" | "texted" | "ticket" | "assigned" | "broth" | "walk" | "seated" | "checkin" | "feed" | "noodles" | "fortune"
    | "plating" | "corridor" | "hatch" | "delivered" | "addon" | "finish" | "done" | "cleared" | "exit" | "reset";
  actor: Actor;
  /** Real elapsed seconds from payment. */
  realSeconds: number;
  /** Progress 0..1 through the animation, or null for steps listed but not animated. */
  at: number | null;
  /** A moment on the guest's live order status page (their phone). */
  phone?: true;
}
export const JOURNEY_SECONDS = 45;
const DWELL = BASE_ASSUMPTIONS.avgDwellMinutes * 60;
const TURNOVER = BASE_ASSUMPTIONS.turnoverMinutes * 60;
const SEATED_AT = 60;
export const JOURNEY_STEPS: readonly JourneyStep[] = [
  { key: "paid", actor: "guest", realSeconds: 0, at: 0 },
  { key: "texted", actor: "guest", realSeconds: 0, at: 0, phone: true },
  { key: "ticket", actor: "kitchen", realSeconds: 0, at: 0 },
  { key: "assigned", actor: "guest", realSeconds: 5, at: 0.04 },
  { key: "broth", actor: "kitchen", realSeconds: 10, at: 0.06 },
  { key: "walk", actor: "guest", realSeconds: 10, at: 0.08 },
  { key: "seated", actor: "guest", realSeconds: SEATED_AT, at: 0.2 },
  { key: "checkin", actor: "guest", realSeconds: SEATED_AT, at: 0.2, phone: true },
  { key: "feed", actor: "guest", realSeconds: 150, at: 0.32, phone: true },
  { key: "noodles", actor: "kitchen", realSeconds: 210, at: 0.42 },
  { key: "fortune", actor: "guest", realSeconds: 240, at: 0.47, phone: true },
  { key: "plating", actor: "kitchen", realSeconds: 330, at: 0.56 },
  { key: "corridor", actor: "kitchen", realSeconds: 375, at: 0.64 },
  { key: "hatch", actor: "kitchen", realSeconds: 410, at: 0.72 },
  { key: "delivered", actor: "both", realSeconds: 420, at: 0.76 },
  { key: "addon", actor: "both", realSeconds: 780, at: 0.8, phone: true },
  { key: "finish", actor: "guest", realSeconds: SEATED_AT + DWELL, at: 0.84 },
  { key: "done", actor: "guest", realSeconds: SEATED_AT + DWELL, at: 0.84, phone: true },
  { key: "cleared", actor: "kitchen", realSeconds: SEATED_AT + DWELL, at: 0.84 },
  { key: "exit", actor: "guest", realSeconds: SEATED_AT + DWELL + 60, at: 1 },
  { key: "reset", actor: "kitchen", realSeconds: SEATED_AT + DWELL + TURNOVER, at: null },
];

/** Order status page stages, as the guest's phone shows them during the journey. */
export const PHONE_STAGES = ["PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"] as const;
export type PhoneStage = (typeof PHONE_STAGES)[number];
/** The stage on the guest's phone at a journey progress: checked in when seated, ready while the runner carries it, done when they tap "I'm done eating". */
export function statusStageAt(progress: number): PhoneStage {
  if (progress < 0.2) return "PAID";
  if (progress < 0.24) return "QUEUED";
  if (progress < 0.64) return "PREPPING";
  if (progress < 0.76) return "READY";
  if (progress < 0.84) return "SERVING";
  return "COMPLETED";
}
export const ANIMATED_STEPS: readonly JourneyStep[] = JOURNEY_STEPS.filter((s) => s.at !== null);
export const JOURNEY_REAL_SECONDS = (ANIMATED_STEPS[ANIMATED_STEPS.length - 1] as JourneyStep).realSeconds;

const at = (key: JourneyStep["key"]): number => (JOURNEY_STEPS.find((s) => s.key === key) as JourneyStep).at as number;
export const PHASES = {
  guestIn: [at("walk"), at("seated")] as const,
  bowl: [at("corridor"), at("delivered")] as const,
  guestOut: [at("finish"), at("exit")] as const,
  dirty: [at("cleared"), at("cleared") + 0.1] as const,
};

/** Real elapsed seconds at a given animation progress, piecewise linear between step anchors. */
export function journeyClock(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  const anchors = ANIMATED_STEPS.map((s) => [s.at as number, s.realSeconds] as const);
  for (let i = 1; i < anchors.length; i += 1) {
    const [a0, r0] = anchors[i - 1] as readonly [number, number];
    const [a1, r1] = anchors[i] as readonly [number, number];
    if (t <= a1) {
      if (a1 === a0) return r1;
      return r0 + ((t - a0) / (a1 - a0)) * (r1 - r0);
    }
  }
  return JOURNEY_REAL_SECONDS;
}

/** Finger 2, west row, position 7: mid-plan, so both paths have some length. */
export const JOURNEY_POD = (ROWS[0] as Row).capacity + (ROWS[1] as Row).capacity + 7;
export const JOURNEY_TARGET: Pod = pod(JOURNEY_POD) as Pod;

const center = (r: Rect): Point => [r.x + r.w / 2, r.y + r.h / 2];
const aisleCx = (index: AisleIndex): number => (GUEST_AISLES[index - 1] as GuestAisle).x + DIMS.aisleW / 2;
const corridorCx = (index: FingerIndex): number => (STAFF_CORRIDORS[index - 1] as StaffCorridor).x + DIMS.corridorW / 2;
const targetCy = JOURNEY_TARGET.y + JOURNEY_TARGET.h / 2;
const seatPoint: Point = [JOURNEY_TARGET.facing === "west" ? JOURNEY_TARGET.x - 0.4 : JOURNEY_TARGET.x + JOURNEY_TARGET.w + 0.4, targetCy];
const hatchPoint: Point = [JOURNEY_TARGET.hatch === "east" ? JOURNEY_TARGET.x + JOURNEY_TARGET.w + 0.4 : JOURNEY_TARGET.x - 0.4, targetCy];
const crossCy = CROSS_AISLE.y + CROSS_AISLE.h / 2;
const entry = door("entry");
const exit = door("exit");
const kitchenDish = door("kitchenDish");
const storeOpening = OPENINGS.find((o) => o.key === "store") as Opening;
const kiosk2 = KIOSKS[1] as Rect;

/** Guest in: entry door, kiosk, lobby opening, cross-aisle, up the aisle, to the seat. */
export const GUEST_PATH: readonly Point[] = [
  [entry.x + entry.len / 2, BUILDING.h - 0.5],
  [kiosk2.x + kiosk2.w / 2, kiosk2.y + kiosk2.h + 1],
  [COLUMN_X + 3, crossCy],
  [aisleCx(JOURNEY_TARGET.aisle), crossCy],
  [aisleCx(JOURNEY_TARGET.aisle), targetCy],
  seatPoint,
];
/** Guest out: back down the aisle, along the cross-aisle, up the last aisle, through the store, out the exit. */
export const GUEST_EXIT_PATH: readonly Point[] = [
  seatPoint,
  [aisleCx(JOURNEY_TARGET.aisle), targetCy],
  [aisleCx(JOURNEY_TARGET.aisle), crossCy],
  [aisleCx(4), crossCy],
  [aisleCx(4), storeOpening.y + storeOpening.len / 2],
  [COLUMN_X + 1, storeOpening.y + storeOpening.len / 2],
  [BUILDING.w - 4, storeOpening.y + storeOpening.len / 2],
  [BUILDING.w - 0.5, exit.y + exit.len / 2],
];
/** Bowl: plating in the kitchen, the corridor mouth, down the corridor, to the hatch. */
export const BOWL_PATH: readonly Point[] = [
  [corridorCx(JOURNEY_TARGET.corridor), DIMS.rear - 3],
  [corridorCx(JOURNEY_TARGET.corridor), DIMS.rear],
  [corridorCx(JOURNEY_TARGET.corridor), targetCy],
  hatchPoint,
];
/** Dirty return: hatch, back up the corridor, along the kitchen back line, into the dish return. */
export const DIRTY_PATH: readonly Point[] = [
  hatchPoint,
  [corridorCx(JOURNEY_TARGET.corridor), targetCy],
  [corridorCx(JOURNEY_TARGET.corridor), kitchenDish.y + kitchenDish.len / 2 + 1],
  [center(zone("dish"))[0], kitchenDish.y + kitchenDish.len / 2 + 1],
  [center(zone("dish"))[0], 5],
];

/** Point along a polyline at fraction t (0..1) of its length. */
export function pointAt(path: readonly Point[], t: number): [number, number] {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const [ax, ay] = path[i - 1] as Point;
    const [bx, by] = path[i] as Point;
    const len = Math.hypot(bx - ax, by - ay);
    segs.push(len);
    total += len;
  }
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < path.length; i += 1) {
    const len = segs[i - 1] as number;
    const [ax, ay] = path[i - 1] as Point;
    const [bx, by] = path[i] as Point;
    if (remaining <= len || i === path.length - 1) {
      const f = len === 0 ? 0 : Math.min(1, remaining / len);
      return [ax + (bx - ax) * f, ay + (by - ay) * f];
    }
    remaining -= len;
  }
  const last = path[path.length - 1] as Point;
  return [last[0], last[1]];
}

/** Evenly spaced samples along a polyline, for tests and flow rendering. */
export function samplePath(path: readonly Point[], step = 0.005): [number, number][] {
  const out: [number, number][] = [];
  for (let t = 0; t <= 1 + 1e-9; t += step) out.push(pointAt(path, Math.min(1, t)));
  return out;
}

const phase = (p: number, [a, b]: readonly [number, number]): number | null => (p < a ? null : p >= b ? 1 : (p - a) / (b - a));

export interface JourneyMarkers {
  guest: [number, number] | null;
  bowl: [number, number] | null;
}
/** Where the guest and the bowl are at a given progress. Both views read this, so they cannot drift apart. */
export function journeyMarkers(progress: number): JourneyMarkers {
  const p = Math.min(1, Math.max(0, progress));
  const g0 = GUEST_PATH[0] as Point;
  let guest: [number, number] = [g0[0], g0[1]];
  const inF = phase(p, PHASES.guestIn);
  const outF = phase(p, PHASES.guestOut);
  if (outF !== null) guest = pointAt(GUEST_EXIT_PATH, outF);
  else if (inF !== null) guest = pointAt(GUEST_PATH, inF);

  const b0 = BOWL_PATH[0] as Point;
  let bowl: [number, number] | null = [b0[0], b0[1]];
  const bowlF = phase(p, PHASES.bowl);
  const dirtyF = phase(p, PHASES.dirty);
  if (dirtyF !== null) bowl = dirtyF >= 1 ? null : pointAt(DIRTY_PATH, dirtyF);
  else if (bowlF !== null) bowl = pointAt(BOWL_PATH, bowlF);
  return { guest, bowl };
}

export type LayerKey = "pods" | "corridors" | "aisles" | "kitchen" | "boh" | "restrooms" | "entry" | "store" | "flow" | "dimensions";
export const LAYER_KEYS: readonly LayerKey[] = ["pods", "corridors", "aisles", "kitchen", "boh", "restrooms", "entry", "store", "flow", "dimensions"];
