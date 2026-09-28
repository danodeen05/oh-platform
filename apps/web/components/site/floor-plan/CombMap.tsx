"use client";

/**
 * CombMap: the bookable comb floor plan for City Creek (75 pods) and
 * University Place (70 pods, mirrored) (Task D4a, spec section 7).
 *
 * - Geometry comes only from `@oh/floor-plan` (`buildLayout` with
 *   `LOCATION_LAYOUTS[layoutKey]`), the same model the business plan draws.
 * - One SVG in feet, scaled with `viewBox`. No transform ever flips or
 *   rotates the drawing: the mirror is in the data (buildLayout), and the
 *   portrait turn is in the data too (`orientLayout` swaps x and y), so every
 *   label stays upright and reads left to right.
 * - Portrait (auto under 768px) turns the plan a quarter so the 70 ft side
 *   runs down the phone. The turn direction is chosen so the lobby and entry
 *   always land at the bottom, where a guest walks in. It is a rotation, not
 *   a reflection, so each location keeps its real handedness.
 * - Status is fill plus pattern (see PodCell), duos are outlined in gold
 *   and lit for a party of two, and the food hatch edge is marked.
 * - Zoom: tap a row (RowZoom), pinch, or the zoom buttons.
 * - Modes: `pick` (pods are buttons, available ones selectable), `live`
 *   (pods are buttons that zoom to their row), `journey` (a decorative
 *   animation of a visit: the guest dot and the bowl dot along the layout's
 *   paths at `journeyProgress`).
 *
 * Copy: pass `labels` (the `combMap` namespace). From a client component:
 * `const t = useTranslations(); <CombMap labels={t.raw("combMap")} ... />`;
 * from a server component, `(await getTranslations()).raw("combMap")`.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { buildLayout, LOCATION_LAYOUTS, POD, type Layout, type Pod, type Rect, type Door } from "@oh/floor-plan";
import { PodCell, StatusPatterns, TONES, type NavKey, type PodStatus, type PodView, type Point, type SeatStatus, type Tone } from "./PodCell";
import { Legend, type LegendLabels } from "./Legend";
import { minTargetPx, ZOOM_MIN_VIEW_FT, ZoomControls, boxString, rowAxis, rowPanBox, rowPanState, rowZoomBox, useRowZoom, type Box, type RowEnds, type ZoomControlLabels } from "./RowZoom";

export type CombLayoutKey = keyof typeof LOCATION_LAYOUTS;
export type CombMapMode = "live" | "pick" | "journey";
export type Orientation = "portrait" | "landscape";

export interface CombSeat {
  label: string;
  status: SeatStatus;
  podType: "SINGLE" | "DUAL";
  dualPartnerLabel?: string;
}

/** The `combMap` messages namespace. */
export interface CombMapLabels {
  title: string;
  summary: string;
  hintTapRow: string;
  hintTapPod: string;
  hintLive: string;
  podName: string;
  podNameDuo: string;
  journeySummary: string;
  status: { available: string; reserved: string; occupied: string; cleaning: string; unknown: string };
  legend: LegendLabels;
  zones: { kitchen: string; restrooms: string; store: string; lobby: string; entry: string; exit: string };
  zoom: ZoomControlLabels;
  /** Pan chevrons for a partial-row zoom: toward position 1 (the kitchen end) and away from it. */
  pan: { earlier: string; later: string };
  marker: { guest: string; bowl: string };
}

export interface CombMapProps {
  layoutKey: CombLayoutKey;
  mode: CombMapMode;
  labels: CombMapLabels;
  seats?: CombSeat[];
  /** Selected pod label: the pick in pick mode, "your pod" in live mode (Task D6). */
  selected?: string | null;
  /** Pick mode only. */
  onSelect?: (label: string) => void;
  /** 2 lights the duo pairs that are free as a pair, and dims singles. */
  partySize?: 1 | 2;
  /** 0..1 (journey mode). */
  journeyProgress?: number;
  /**
   * Journey mode: the progress from which the bowl marker shows (G2b, D2
   * review). Before it the guest hasn't ordered, so there is no bowl yet;
   * the experience page passes its "order" step's progress. Default 0.
   */
  bowlFrom?: number;
  /** auto: portrait under 768px wide. Server render assumes portrait (mobile first). */
  orientation?: "auto" | Orientation;
  tone?: Tone;
  /** Show the key under the map. Default true, except in journey mode. */
  legend?: boolean;
  className?: string;
}

/* ------------------------------------------------------------ geometry */

export interface OrientedLayout {
  orientation: Orientation;
  /** Full viewBox: the building plus a margin, in feet. */
  box: Box;
  building: Box;
  point: (p: Point) => Point;
  zones: { key: string; rect: Box; territory: "guest" | "staff" }[];
  restrooms: Box;
  corridors: Box[];
  kiosks: Box[];
  walls: [Point, Point][];
  doors: { key: "entry" | "exit"; a: Point; b: Point; normal: Point; mid: Point }[];
  rows: { key: number; finger: number; rect: Box }[];
  fingers: { index: number; letter: string; at: Point }[];
  pods: (PodView & { pod: Pod })[];
  duoPairs: { a: string; b: string; rect: Box }[];
  paths: { guest: Point[]; guestExit: Point[]; bowl: Point[] };
  journeyTarget: string;
  markers: (progress: number) => { guest: Point | null; bowl: Point | null };
}

const MARGIN = 1.5;
const LETTERS = ["A", "B", "C"] as const;

const normRect = (a: Point, b: Point): Box => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) });
const union = (rs: Box[]): Box => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

/**
 * Put a layout on screen. Landscape is the layout as-is (kitchen at the
 * top, street at the bottom). Portrait swaps the axes as a quarter turn:
 * clockwise when the lobby is on the east (City Creek), counter-clockwise
 * when it is on the west (University Place), so the lobby ends up at the
 * bottom either way.
 */
export function orientLayout(layout: Layout, orientation: Orientation): OrientedLayout {
  const W = layout.building.w;
  const H = layout.building.h;
  const lobby = layout.zones.find((z) => z.key === "lobby") as Rect;
  const lobbyEast = lobby.x + lobby.w / 2 > W / 2;
  const point = (p: Point): Point => {
    if (orientation === "landscape") return [p[0], p[1]];
    return lobbyEast ? [H - p[1], p[0]] : [p[1], W - p[0]];
  };
  const vec = (v: Point): Point => {
    if (orientation === "landscape") return v;
    return lobbyEast ? [-v[1], v[0]] : [v[1], -v[0]];
  };
  const rect = (r: Rect): Box => normRect(point([r.x, r.y]), point([r.x + r.w, r.y + r.h]));
  const bw = orientation === "landscape" ? W : H;
  const bh = orientation === "landscape" ? H : W;

  const byNumber = new Map(layout.pods.map((p) => [p.number, p]));
  const pods = layout.pods.map((pod) => {
    // Hit area in plan space: the full pitch along the row, and a step into the guest aisle on the seat side.
    const slack = (POD.pitch - POD.w) / 2;
    const reach = 1;
    const hitPlan: Rect = {
      x: pod.facing === "west" ? pod.x - reach : pod.x,
      y: pod.y - slack,
      w: pod.w + reach,
      h: pod.h + 2 * slack,
    };
    const hx = pod.hatch === "east" ? pod.x + pod.w : pod.x;
    const hatch: [Point, Point] = [point([hx, pod.y + 0.25]), point([hx, pod.y + pod.h - 0.25])];
    const r = rect(pod);
    return {
      pod,
      label: pod.label,
      row: pod.row,
      rect: r,
      hit: rect(hitPlan),
      hatch,
      center: [r.x + r.w / 2, r.y + r.h / 2] as Point,
      duo: pod.type === "duo",
    };
  });

  const duoPairs = layout.pods
    .filter((p) => p.type === "duo" && p.duoWith !== undefined && p.number < (p.duoWith as number))
    .map((p) => {
      const q = byNumber.get(p.duoWith as number) as Pod;
      const r = rect(union([p, q]));
      return { a: p.label, b: q.label, rect: { x: r.x - 0.25, y: r.y - 0.25, w: r.w + 0.5, h: r.h + 0.5 } };
    });

  const doorOf = (d: Door) => {
    const a: Point = [d.x, d.y];
    const b: Point = d.axis === "x" ? [d.x + d.len, d.y] : [d.x, d.y + d.len];
    const inward: Point = d.axis === "x" ? [0, d.y <= 0 ? 1 : -1] : [d.x <= 0 ? 1 : -1, 0];
    const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return { key: d.key as "entry" | "exit", a: point(a), b: point(b), normal: vec(inward), mid: point(mid) };
  };

  const crossAisleMid = layout.crossAisle.y + layout.crossAisle.h / 2;
  const target = layout.journeyTarget;

  return {
    orientation,
    box: { x: -MARGIN, y: -MARGIN, w: bw + 2 * MARGIN, h: bh + 2 * MARGIN },
    building: { x: 0, y: 0, w: bw, h: bh },
    point,
    zones: layout.zones.map((z) => ({ key: z.key, rect: rect(z), territory: z.territory })),
    restrooms: union(layout.zones.filter((z) => z.key.startsWith("restroom")).map(rect)),
    corridors: layout.staffCorridors.map(rect),
    kiosks: layout.kiosks.map(rect),
    walls: layout.walls.map(([a, b]) => [point(a), point(b)]),
    doors: layout.doors.filter((d) => d.key === "entry" || d.key === "exit").map(doorOf),
    rows: layout.rows.map((r) => ({ key: r.key, finger: r.finger, rect: rect(r) })),
    fingers: layout.fingers.map((f) => ({ index: f.index, letter: LETTERS[f.index - 1] as string, at: point([f.x + f.w / 2, crossAisleMid]) })),
    pods,
    duoPairs,
    paths: { guest: layout.guestPath.map(point), guestExit: layout.guestExitPath.map(point), bowl: layout.bowlPath.map(point) },
    journeyTarget: target.label,
    markers: (progress: number) => {
      const m = layout.journeyMarkers(progress);
      return { guest: m.guest ? point(m.guest) : null, bowl: m.bowl ? point(m.bowl) : null };
    },
  };
}

/* ------------------------------------------------------------ behavior */

/**
 * A pod's on-screen size in CSS px at a zoom. Pods are 2.35 ft wide along the
 * row and 4.5 ft deep. Portrait rows run across the screen, so width is the
 * 2.35 ft side; landscape rows run down it, so height is.
 */
export function podScreenPx(pxPerFt: number, orientation: Orientation): { w: number; h: number } {
  return orientation === "portrait" ? { w: POD.w * pxPerFt, h: POD.d * pxPerFt } : { w: POD.d * pxPerFt, h: POD.w * pxPerFt };
}

/** What a tap or key press on a pod does. Pointer taps on pods too small to hit reliably zoom to the row first. */
export function podTapAction({
  mode,
  via,
  podPx,
  selectable,
  coarse = true,
}: {
  mode: CombMapMode;
  via: "pointer" | "keyboard";
  podPx: number;
  selectable: boolean;
  /** A coarse (touch) pointer needs 44px pods; a fine (mouse) pointer 24px. See minTargetPx. */
  coarse?: boolean;
}): "select" | "zoom" | "none" {
  if (mode === "journey") return "none";
  if (mode === "live") return "zoom";
  if (via === "pointer" && podPx > 0 && podPx < minTargetPx({ coarse })) return "zoom";
  return selectable ? "select" : "none";
}

/**
 * Coarse (touch-sized targets) or fine, decided per interaction from the
 * pointerdown that started it: touch and pen are coarse, a mouse is fine.
 * `(pointer: coarse)` is only the default before any pointer event, so a
 * touchscreen laptop switches back to mouse rules on the next click.
 */
export function coarseFor({ pointerType, mediaCoarse }: { pointerType: string | null; mediaCoarse: boolean }): boolean {
  if (pointerType === "touch" || pointerType === "pen") return true;
  if (pointerType === "mouse") return false;
  return mediaCoarse;
}

const DIRS: Record<Exclude<NavKey, "Home" | "End">, Point> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

/** The nearest pod in a screen direction: distance along the direction plus twice the sideways offset. */
export function nextPodInDirection(pods: readonly { label: string; center: Point }[], from: string, key: NavKey): string | null {
  const origin = pods.find((p) => p.label === from);
  if (!origin) return null;
  if (key === "Home" || key === "End") {
    // First or last pod along the same row, in reading order.
    const row = (origin as { row?: number }).row;
    const same = pods.filter((p) => (p as { row?: number }).row === row).sort((a, b) => a.center[1] - b.center[1] || a.center[0] - b.center[0]);
    const pick = key === "Home" ? same[0] : same[same.length - 1];
    return pick ? pick.label : null;
  }
  const [dx, dy] = DIRS[key];
  let best: string | null = null;
  let bestScore = Infinity;
  for (const p of pods) {
    if (p.label === from) continue;
    const vx = p.center[0] - origin.center[0];
    const vy = p.center[1] - origin.center[1];
    const along = vx * dx + vy * dy;
    if (along <= 0.01) continue;
    const side = Math.abs(vx * dy - vy * dx);
    const score = along + 2 * side;
    if (score < bestScore) {
      bestScore = score;
      best = p.label;
    }
  }
  return best;
}

const fill = (template: string, vars: Record<string, string>): string => template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

const STATUS_KEY: Record<PodStatus, keyof CombMapLabels["status"]> = {
  AVAILABLE: "available",
  RESERVED: "reserved",
  OCCUPIED: "occupied",
  CLEANING: "cleaning",
  NONE: "unknown",
  UNKNOWN: "unknown",
};

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}
const NARROW = "(max-width: 767px)";
const REDUCED = "(prefers-reduced-motion: reduce)";
const COARSE = "(pointer: coarse)";
const subCoarse = subscribeMedia(COARSE);
const subNarrow = subscribeMedia(NARROW);
const subReduced = subscribeMedia(REDUCED);
const readMedia = (q: string) => () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q).matches : false);
const readNarrow = readMedia(NARROW);
const readReduced = readMedia(REDUCED);
const readCoarse = readMedia(COARSE);

/* ------------------------------------------------------------ component */

export function CombMap({
  layoutKey,
  mode,
  labels,
  seats,
  selected = null,
  onSelect,
  partySize = 1,
  journeyProgress = 0,
  bowlFrom = 0,
  orientation = "auto",
  tone = "night",
  legend,
  className,
}: CombMapProps) {
  const narrow = useSyncExternalStore(subNarrow, readNarrow, () => true);
  const reducedMotion = useSyncExternalStore(subReduced, readReduced, () => false);
  // Touch-target rules follow the pointer: a coarse primary pointer, or any touch event on the map, means 44px; a mouse means 24px.
  const coarseMedia = useSyncExternalStore(subCoarse, readCoarse, () => true);
  // The last pointerdown's type (null before any). A ref for the click that same press produces, state for the hint.
  const lastPointer = useRef<string | null>(null);
  const [lastPointerType, setLastPointerType] = useState<string | null>(null);
  const coarse = coarseFor({ pointerType: lastPointerType, mediaCoarse: coarseMedia });
  const resolved: Orientation = orientation === "auto" ? (narrow ? "portrait" : "landscape") : orientation;

  const layout = useMemo(() => buildLayout(LOCATION_LAYOUTS[layoutKey]), [layoutKey]);
  const o = useMemo(() => orientLayout(layout, resolved), [layout, resolved]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoom = useRowZoom({ full: o.box, svgRef, reducedMotion });

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const patternIds = useMemo(() => ({ reserved: `cm-${uid}-reserved`, cleaning: `cm-${uid}-cleaning` }), [uid]);
  const hintId = `cm-${uid}-hint`;
  const t = TONES[tone];
  const interactive = mode !== "journey";

  const seatByLabel = useMemo(() => new Map((seats ?? []).map((s) => [s.label, s])), [seats]);
  const statusOf = useCallback(
    (label: string): PodStatus => {
      if (!seats) return "NONE";
      return seatByLabel.get(label)?.status ?? "UNKNOWN";
    },
    [seats, seatByLabel],
  );
  const partnerOf = useCallback(
    (label: string): string | undefined => {
      const fromSeat = seatByLabel.get(label)?.dualPartnerLabel;
      if (fromSeat) return fromSeat;
      const pv = o.pods.find((p) => p.label === label);
      if (!pv?.duo) return undefined;
      return o.pods.find((q) => q.pod.number === pv.pod.duoWith)?.label;
    },
    [seatByLabel, o.pods],
  );

  // Duo pairs free as a pair: both halves available.
  const freeDuos = useMemo(() => {
    const set = new Set<string>();
    for (const pair of o.duoPairs) {
      if (statusOf(pair.a) === "AVAILABLE" && statusOf(pair.b) === "AVAILABLE") {
        set.add(pair.a);
        set.add(pair.b);
      }
    }
    return set;
  }, [o.duoPairs, statusOf]);

  const selectedSet = useMemo(() => {
    const s = new Set<string>();
    // Pick: the pod being chosen. Live (Task D6): "your pod" on the pod page. Journey draws its own target.
    if (mode === "journey" || !selected) return s;
    s.add(selected);
    const partner = partySize === 2 ? partnerOf(selected) : undefined;
    if (partner) s.add(partner);
    return s;
  }, [mode, selected, partySize, partnerOf]);

  const podLabels = useMemo(() => o.pods.map((p) => p.label), [o.pods]);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);
  const tabLabel = focusLabel && podLabels.includes(focusLabel) ? focusLabel : selected && podLabels.includes(selected) ? selected : podLabels[0];

  // Axis-correct: the smaller of the pod's on-screen width and height (its 2.35 ft seat width, whichever way the row runs).
  const podSize = podScreenPx(zoom.pxPerFt, resolved);
  const podPx = Math.min(podSize.w, podSize.h);
  const showText = zoom.pxPerFt >= 8.5;
  // The row a row zoom went to: a ref for the callbacks, state for the pan chevrons.
  const zoomedRow = useRef<number | null>(null);
  const [panRow, setPanRow] = useState<number | null>(null);
  const setZoomedRow = (key: number | null) => {
    zoomedRow.current = key;
    setPanRow(key);
  };
  // Zooming all the way out (button, pinch or wheel) forgets the row, so stale chevrons never come back on a later pinch.
  useEffect(() => {
    if (!zoom.isZoomed) {
      zoomedRow.current = null;
      setPanRow(null);
    }
  }, [zoom.isZoomed]);
  const rowEnds = useMemo(() => {
    const m = new Map<number, RowEnds>();
    for (const r of o.rows) {
      const pods = o.pods.filter((p) => p.row === r.key).sort((a, b) => a.pod.position - b.pod.position);
      if (pods.length) m.set(r.key, { first: (pods[0] as (typeof pods)[number]).rect, last: (pods[pods.length - 1] as (typeof pods)[number]).rect });
    }
    return m;
  }, [o]);
  const podByLabel = useMemo(() => new Map(o.pods.map((p) => [p.label, p])), [o.pods]);
  const rowByKey = useMemo(() => new Map(o.rows.map((r) => [r.key, r])), [o.rows]);

  // Pod callbacks read the latest render through a ref, so they keep one identity and the memoized PodCells skip re-rendering.
  const latest = useRef({ zoom, o, podByLabel, rowByKey, statusOf, mode, podPx, onSelect, coarseMedia });
  latest.current = { zoom, o, podByLabel, rowByKey, statusOf, mode, podPx, onSelect, coarseMedia };

  const zoomToPod = useCallback((label: string) => {
    const { zoom: z, o: view, podByLabel: pods, rowByKey: rows } = latest.current;
    const pv = pods.get(label);
    const row = pv ? rows.get(pv.row) : undefined;
    if (!pv || !row) return;
    setZoomedRow(row.key);
    z.zoomTo(rowZoomBox(row.rect, view.box, z.elementPx, pv.center, { coarse: coarseFor({ pointerType: lastPointer.current, mediaCoarse: latest.current.coarseMedia }) }));
  }, []);

  const onActivate = useCallback(
    (label: string, via: "pointer" | "keyboard") => {
      const { zoom: z, podByLabel: pods, statusOf: status, mode: m, podPx: px, onSelect: select } = latest.current;
      if (via === "pointer" && z.consumeGesture()) return;
      setFocusLabel(label);
      const coarseNow = coarseFor({ pointerType: lastPointer.current, mediaCoarse: latest.current.coarseMedia });
      const action = podTapAction({ mode: m, via, podPx: px, selectable: m === "pick" && status(label) === "AVAILABLE", coarse: coarseNow });
      if (action === "zoom") {
        const pv = pods.get(label);
        if (m === "live" && z.isZoomed && pv && zoomedRow.current === pv.row) {
          setZoomedRow(null);
          z.reset();
        } else zoomToPod(label);
      } else if (action === "select") select?.(label);
    },
    [zoomToPod],
  );

  const onNav = useCallback((label: string, key: NavKey) => {
    const next = nextPodInDirection(latest.current.o.pods, label, key);
    if (!next) return;
    setFocusLabel(next);
    svgRef.current?.querySelector<SVGGElement>(`[data-label="${next}"]`)?.focus();
  }, []);

  const onEscape = useCallback(() => {
    setZoomedRow(null);
    latest.current.zoom.reset();
  }, []);

  // Keyboard focus that lands off-screen while zoomed brings its row into view.
  const onFocusPod = useCallback(
    (label: string) => {
      setFocusLabel(label);
      const { zoom: z, podByLabel: pods } = latest.current;
      if (!z.isZoomed) return;
      const pv = pods.get(label);
      if (!pv) return;
      const vb = z.viewBox;
      const inside = pv.rect.x >= vb.x && pv.rect.y >= vb.y && pv.rect.x + pv.rect.w <= vb.x + vb.w && pv.rect.y + pv.rect.h <= vb.y + vb.h;
      if (!inside) zoomToPod(label);
    },
    [zoomToPod],
  );

  const aria = (label: string, status: PodStatus): string => {
    const statusText = labels.status[STATUS_KEY[status]];
    const partner = podByLabel.get(label)?.duo ? partnerOf(label) : undefined;
    return partner ? fill(labels.podNameDuo, { label, partner, status: statusText }) : fill(labels.podName, { label, status: statusText });
  };

  // Pan chevrons, shown while a row zoom leaves part of the row off screen.
  const ends = zoom.isZoomed && panRow !== null ? rowEnds.get(panRow) : undefined;
  const panState = ends ? rowPanState(zoom.viewBox, ends) : null;
  const pan =
    ends && panState && (panState.canEarlier || panState.canLater)
      ? {
          labels: labels.pan,
          later: rowAxis(ends).later,
          canEarlier: panState.canEarlier,
          canLater: panState.canLater,
          onPan: (dir: "earlier" | "later") => zoom.zoomTo(rowPanBox(zoom.current(), ends, dir, o.box)),
        }
      : null;

  const progress = Math.min(1, Math.max(0, journeyProgress));
  const raw = mode === "journey" ? o.markers(progress) : null;
  const markers = raw && progress < bowlFrom ? { ...raw, bowl: null } : raw;
  const guestLeaving = mode === "journey" && progress >= 0.84;

  const hint = mode === "pick" ? (zoom.isZoomed || (podPx >= minTargetPx({ coarse }) && zoom.pxPerFt > 0) ? labels.hintTapPod : labels.hintTapRow) : mode === "live" ? labels.hintLive : null;
  const showLegend = legend ?? mode !== "journey";
  const legendItems = mode === "pick" || (mode === "live" && selected) ? (["available", "reserved", "occupied", "cleaning", "duo", "selected", "hatch"] as const) : (["available", "reserved", "occupied", "cleaning", "duo", "hatch"] as const);
  const aspect = resolved === "portrait" ? "aspect-[53/73]" : "aspect-[73/53]";
  // Zone and door labels. `paint-order: stroke` draws a halo in the floor color first, so a wall line or a zone edge never cuts through the letters.
  const label = (x: number, y: number, text: string, opts: { size?: number; strong?: boolean } = {}) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={opts.size ?? 1.35}
      className={`${opts.strong ? t.textStrong : t.zoneText} ${t.halo} font-body`}
      fontWeight={600}
      letterSpacing={0.04}
      strokeWidth={0.45}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {text}
    </text>
  );
  const zoneRect = (key: string) => o.zones.find((z) => z.key === key)?.rect as Box;
  const centerOf = (r: Box): Point => [r.x + r.w / 2, r.y + r.h / 2];
  const kitchen = zoneRect("kitchen");
  const store = zoneRect("store");
  const lobbyRect = zoneRect("lobby");
  // The lobby label moves into the lobby and along the wall, away from the entry door, so long
  // translations of "Entry" and "Lobby" never collide.
  const entry = o.doors.find((d) => d.key === "entry");
  const lobbyLabelAt: Point = (() => {
    const [cx, cy] = centerOf(lobbyRect);
    if (!entry) return [cx, cy];
    const [nx, ny] = entry.normal;
    const [ax, ay] = [-ny, nx];
    const side = Math.sign((cx - entry.mid[0]) * ax + (cy - entry.mid[1]) * ay) || 1;
    return [cx + nx * 1.5 + ax * side * 2.5, cy + ny * 1.5 + ay * side * 2.5];
  })();
  const zoneFill: Record<string, string> = { kitchen: t.staff, dish: t.staff, boh: t.staff, restroomHall: t.restroom, restroomMen: t.restroom, restroomWomen: t.restroom, store: t.store, lobby: t.lobby };

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <div className={`relative overflow-hidden rounded-2xl ${t.bg}`}>
        <svg
          ref={svgRef}
          viewBox={boxString(zoom.viewBox)}
          preserveAspectRatio="xMidYMid meet"
          className={`block h-auto w-full select-none ${aspect} ${zoom.isZoomed ? "touch-none" : "touch-pan-y"}`}
          role={interactive ? "group" : "img"}
          aria-label={interactive ? labels.title : fill(labels.journeySummary, { label: o.journeyTarget })}
          aria-describedby={interactive && hint ? hintId : undefined}
          data-layout={layoutKey}
          data-orientation={resolved}
          data-journey-target={mode === "journey" ? o.journeyTarget : undefined}
          {...zoom.handlers}
          onPointerDown={(e) => {
            // Recorded before the click this press produces, so that click uses this pointer's rule.
            lastPointer.current = e.pointerType || null;
            if (lastPointerType !== lastPointer.current) setLastPointerType(lastPointer.current);
            zoom.handlers.onPointerDown(e);
          }}
        >
          <StatusPatterns ids={patternIds} tone={tone} />

          <g aria-hidden="true">
            <rect x={0} y={0} width={o.building.w} height={o.building.h} className={t.floor} />
            {o.zones.map((z) => (
              <rect key={z.key} data-zone={z.key} x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h} className={zoneFill[z.key]} />
            ))}
            {o.corridors.map((c, i) => (
              <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} className={t.corridor} />
            ))}
            {o.kiosks.map((k, i) => (
              <rect key={i} x={k.x} y={k.y} width={k.w} height={k.h} rx={0.3} className={t.kiosk} />
            ))}
            {o.walls.map(([a, b], i) => (
              <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={t.wall} strokeWidth={0.3} strokeLinecap="round" />
            ))}
            {o.doors.map((d) => {
              // Threshold in gold over the wall gap, and a chevron pointing in (entry) or out (exit).
              const dir = d.key === "entry" ? 1 : -1;
              const [nx, ny] = d.normal;
              const tip: Point = [d.mid[0] + nx * (0.9 + 0.8 * dir), d.mid[1] + ny * (0.9 + 0.8 * dir)];
              const base: Point = [d.mid[0] + nx * (0.9 - 0.8 * dir), d.mid[1] + ny * (0.9 - 0.8 * dir)];
              const px = -ny * 0.8;
              const py = nx * 0.8;
              const textAt: Point = [d.mid[0] + nx * 3.4, d.mid[1] + ny * 3.4];
              return (
                <g key={d.key} data-door={d.key}>
                  <line x1={d.a[0]} y1={d.a[1]} x2={d.b[0]} y2={d.b[1]} className={t.door} strokeWidth={0.55} strokeLinecap="round" />
                  <path d={`M${tip[0]},${tip[1]} L${base[0] + px},${base[1] + py} L${base[0] - px},${base[1] - py} Z`} className={t.doorArrow} />
                  {label(textAt[0], textAt[1], labels.zones[d.key], { size: 1.2, strong: true })}
                </g>
              );
            })}
            {label(...centerOf(kitchen), labels.zones.kitchen, { size: 1.5 })}
            {label(...centerOf(o.restrooms), labels.zones.restrooms)}
            {label(centerOf(store)[0], store.y + Math.min(3, store.h / 3), labels.zones.store)}
            {/* Nudged away from the entry door so its label and the lobby label never collide. */}
            {label(lobbyLabelAt[0], lobbyLabelAt[1], labels.zones.lobby)}
            {o.fingers.map((f) => (
              <g key={f.index}>
                <circle cx={f.at[0]} cy={f.at[1]} r={1.5} className={t.finger} strokeWidth={0.2} />
                <text x={f.at[0]} y={f.at[1]} textAnchor="middle" dominantBaseline="central" fontSize={1.7} className={`${t.fingerText} font-display`}>
                  {f.letter}
                </text>
              </g>
            ))}
          </g>

          {mode === "journey" ? (
            <g aria-hidden="true" fill="none" strokeWidth={0.22} strokeDasharray="0.5 0.6" strokeLinecap="round">
              <polyline points={(guestLeaving ? o.paths.guestExit : o.paths.guest).map((p) => p.join(",")).join(" ")} className={t.guestPath} />
              <polyline points={o.paths.bowl.map((p) => p.join(",")).join(" ")} className={t.bowlPath} />
            </g>
          ) : null}

          <g aria-hidden="true">
            {o.duoPairs.map((pair) => {
              const lit = partySize === 2 && freeDuos.has(pair.a);
              return (
                <rect
                  key={pair.a}
                  data-duo-pair={`${pair.a}+${pair.b}`}
                  x={pair.rect.x}
                  y={pair.rect.y}
                  width={pair.rect.w}
                  height={pair.rect.h}
                  rx={0.5}
                  fill="none"
                  className={lit ? t.duoLit : t.duo}
                  strokeWidth={lit ? 0.3 : 0.15}
                  strokeDasharray={lit ? undefined : "0.4 0.35"}
                />
              );
            })}
          </g>

          <g>
            {o.pods.map((pv) => {
              const status = statusOf(pv.label);
              return (
                <PodCell
                  key={pv.label}
                  view={pv}
                  status={status}
                  tone={tone}
                  patternIds={patternIds}
                  interactive={interactive}
                  selectable={mode === "pick" && status === "AVAILABLE"}
                  pickMode={mode === "pick"}
                  selected={selectedSet.has(pv.label)}
                  journeyTarget={mode === "journey" && pv.label === o.journeyTarget && progress >= 0.2 && !guestLeaving}
                  dimmed={partySize === 2 && mode === "pick" && !pv.duo}
                  duoHighlight={partySize === 2 && freeDuos.has(pv.label)}
                  tabStop={interactive && pv.label === tabLabel}
                  ariaLabel={interactive ? aria(pv.label, status) : ""}
                  layout={resolved}
                  showText={showText}
                  onActivate={onActivate}
                  onNav={onNav}
                  onEscape={onEscape}
                  onFocusPod={onFocusPod}
                />
              );
            })}
          </g>

          {markers ? (
            <g aria-hidden="true">
              {markers.bowl ? <circle data-marker="bowl" cx={markers.bowl[0]} cy={markers.bowl[1]} r={0.75} className={t.bowl} strokeWidth={0.2} /> : null}
              {markers.guest ? <circle data-marker="guest" cx={markers.guest[0]} cy={markers.guest[1]} r={0.95} className={t.guest} strokeWidth={0.22} /> : null}
            </g>
          ) : null}
        </svg>
      </div>

      {interactive ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p id={hintId} className={`m-0 min-w-0 flex-1 basis-48 text-base ${tone === "night" ? "text-oh-mute" : "text-oh-stone"}`} aria-live="polite">
            {hint}
          </p>
          <ZoomControls api={zoom} labels={labels.zoom} maxedIn={zoom.viewBox.w <= ZOOM_MIN_VIEW_FT + 0.01} tone={tone} pan={pan} />
        </div>
      ) : null}
      {showLegend ? <Legend labels={labels.legend} tone={tone} items={legendItems} duoLit={partySize === 2} className="relative mt-5" /> : null}
    </div>
  );
}
