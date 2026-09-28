"use client";

/**
 * Zoom and pan for the CombMap `viewBox` (Task D4a).
 *
 * The map is one SVG in feet. Zooming never scales or transforms the drawing:
 * it only moves the `viewBox`, so strokes, hit areas and text stay crisp and
 * upright. Three ways in:
 *
 * - Row zoom: tapping a row animates the viewBox to that row over 350 ms
 *   (instant with reduced motion), sized so a pod is at least 44px deep on a
 *   390px phone (`rowZoomBox`).
 * - Pinch: two pointers zoom about their midpoint (pointer events, so it
 *   works for touch and pen alike); one pointer pans once zoomed in.
 * - Ctrl/Cmd + wheel (and trackpad pinch, which browsers report the same
 *   way) zooms about the cursor on desktop; the plain wheel keeps scrolling
 *   the page.
 *
 * During a gesture or an animation the attribute is written straight to the
 * SVG element (no React render per frame); the final box is committed to
 * state once the gesture or animation ends.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { POD } from "@oh/floor-plan";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ZOOM_MS = 350;
/** Minimum on-screen size of a pod's depth (the long side of its hit target) after a row zoom. */
export const MIN_TOUCH_PX = 44;
/** How far in a pinch may go, in feet across. About two pods of a row fill the screen. */
const MIN_VIEW_FT = 8;
/** Movement under this many CSS px still counts as a tap, not a drag. */
const TAP_SLOP_PX = 8;

export function zoomDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : ZOOM_MS;
}

export const boxString = (b: Box): string => `${round(b.x)} ${round(b.y)} ${round(b.w)} ${round(b.h)}`;
const round = (n: number): number => Math.round(n * 1000) / 1000;

/** The smallest box of the given aspect (w / h) that contains `target`, centered on it. */
export function fitBox(target: Box, aspect: number): Box {
  let w = target.w;
  let h = target.h;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return { x: target.x + (target.w - w) / 2, y: target.y + (target.h - h) / 2, w, h };
}

/** Keep a zoomed box inside the full drawing (or centered on it when it is at least as large). */
export function clampBox(b: Box, full: Box): Box {
  const x = b.w >= full.w ? full.x + (full.w - b.w) / 2 : Math.min(Math.max(b.x, full.x), full.x + full.w - b.w);
  const y = b.h >= full.h ? full.y + (full.h - b.h) / 2 : Math.min(Math.max(b.y, full.y), full.y + full.h - b.h);
  return { x, y, w: b.w, h: b.h };
}

/** A pod's short side (its 2.35 ft seat width along the row). A pod meets the touch rule when THIS side is 44px or more. */
export const POD_MIN_FT = Math.min(POD.w, POD.d);
/** What a partial-row zoom aims for: a little over 44px so browser rounding never lands under it. About 7 pods on a 390px phone. */
export const TARGET_POD_PX = 48;

/**
 * The viewBox for a row zoom. The row plus the two guest aisles beside it,
 * fitted to the drawing's aspect (so the SVG never letterboxes). When the
 * whole row would leave a pod's SHORT side (its width along the row) under
 * 44px, as it does on a phone, the box tightens to a partial row sized for
 * 48px pods, centered on `focus` (the tapped pod); the rest of the row is a
 * swipe or a chevron away (`rowPanBox`).
 */
export function rowZoomBox(row: Box, full: Box, elementPx: number, focus?: readonly [number, number]): Box {
  const aspect = full.w / full.h;
  const alongY = row.h > row.w;
  const across = 2.5; // ft each side: most of the neighbouring aisle
  const along = 0.4;
  const padded: Box = alongY
    ? { x: row.x - across, y: row.y - along, w: row.w + 2 * across, h: row.h + 2 * along }
    : { x: row.x - along, y: row.y - across, w: row.w + 2 * along, h: row.h + 2 * across };
  let box = fitBox(padded, aspect);
  if (elementPx > 0) {
    const fits = (POD_MIN_FT * elementPx) / box.w >= MIN_TOUCH_PX;
    const maxW = (elementPx * POD_MIN_FT) / TARGET_POD_PX;
    if (!fits) {
      const w = maxW;
      const h = w / aspect;
      const [cx, cy] = focus ?? [box.x + box.w / 2, box.y + box.h / 2];
      box = { x: cx - w / 2, y: cy - h / 2, w, h };
    }
  }
  return clampBox(box, full);
}

/** The first (position 1, nearest the kitchen) and last pod of a row, in view coordinates. */
export interface RowEnds {
  first: Box;
  last: Box;
}

const EPS = 1e-6;
const contains = (vb: Box, r: Box): boolean => r.x >= vb.x - EPS && r.y >= vb.y - EPS && r.x + r.w <= vb.x + vb.w + EPS && r.y + r.h <= vb.y + vb.h + EPS;
const centerOf = (r: Box): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];

/** The row's axis on screen: whether it runs along x, and the unit direction from its first pod to its last. */
export function rowAxis(ends: RowEnds): { alongX: boolean; later: [number, number] } {
  const [fx, fy] = centerOf(ends.first);
  const [lx, ly] = centerOf(ends.last);
  const alongX = Math.abs(lx - fx) >= Math.abs(ly - fy);
  const s = (alongX ? lx - fx : ly - fy) >= 0 ? 1 : -1;
  return { alongX, later: alongX ? [s, 0] : [0, s] };
}

/** Whether the chevrons have anywhere to go: an end pod not fully in view. */
export function rowPanState(vb: Box, ends: RowEnds): { canEarlier: boolean; canLater: boolean } {
  return { canEarlier: !contains(vb, ends.first), canLater: !contains(vb, ends.last) };
}

/**
 * Pan a zoomed box along its row by three quarters of a screen, toward the
 * earlier (kitchen) or later end, stopping with the end pod just in view.
 * Never changes the zoom, so pods stay at their 44px-plus size.
 */
export function rowPanBox(vb: Box, ends: RowEnds, dir: "earlier" | "later", full: Box): Box {
  const { alongX, later } = rowAxis(ends);
  const sign = (alongX ? later[0] : later[1]) * (dir === "later" ? 1 : -1);
  const ext = alongX ? vb.w : vb.h;
  const pad = 0.4;
  const lo = Math.min(alongX ? ends.first.x : ends.first.y, alongX ? ends.last.x : ends.last.y) - pad;
  const hi = Math.max(alongX ? ends.first.x + ends.first.w : ends.first.y + ends.first.h, alongX ? ends.last.x + ends.last.w : ends.last.y + ends.last.h) + pad;
  const current = alongX ? vb.x : vb.y;
  const start = ext >= hi - lo ? (lo + hi) / 2 - ext / 2 : Math.min(Math.max(current + sign * ext * 0.75, lo), hi - ext);
  return clampBox(alongX ? { ...vb, x: start } : { ...vb, y: start }, full);
}

const easeInOut =(t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerpBox = (a: Box, b: Box, t: number): Box => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

interface Gesture {
  kind: "idle" | "pending" | "pan" | "pinch";
  startBox: Box;
  startX: number;
  startY: number;
  startDist: number;
  moved: boolean;
}

export interface RowZoomApi {
  /** The committed viewBox (updated when a gesture or animation ends). */
  viewBox: Box;
  isZoomed: boolean;
  /** Rendered width of the SVG in CSS px, 0 until measured. */
  elementPx: number;
  /** CSS px per foot at the committed viewBox, 0 until measured. */
  pxPerFt: number;
  zoomTo(target: Box): void;
  zoomBy(factor: number): void;
  /** The box on screen right now (mid-animation or mid-gesture included). */
  current(): Box;
  reset(): void;
  /** True once if the pointer sequence that just ended was a drag or pinch (so the click it produces is ignored). */
  consumeGesture(): boolean;
  handlers: {
    onPointerDown(e: ReactPointerEvent<SVGSVGElement>): void;
    onPointerMove(e: ReactPointerEvent<SVGSVGElement>): void;
    onPointerUp(e: ReactPointerEvent<SVGSVGElement>): void;
    onPointerCancel(e: ReactPointerEvent<SVGSVGElement>): void;
  };
}

export function useRowZoom({ full, svgRef, reducedMotion }: { full: Box; svgRef: RefObject<SVGSVGElement | null>; reducedMotion: boolean }): RowZoomApi {
  const fullKey = boxString(full);
  const [viewBox, setViewBox] = useState<Box>(full);
  const [elementPx, setElementPx] = useState(0);
  const live = useRef<Box>(full);
  const raf = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ kind: "idle", startBox: full, startX: 0, startY: 0, startDist: 0, moved: false });
  const suppressClick = useRef(false);
  const aspect = full.w / full.h;
  // Reduced motion is read at call time so a mid-session OS change applies to the next zoom.
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const apply = useCallback(
    (b: Box) => {
      live.current = b;
      svgRef.current?.setAttribute("viewBox", boxString(b));
    },
    [svgRef],
  );
  const stopAnim = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  // A new drawing (orientation or layout change) starts from the whole floor.
  useEffect(() => {
    stopAnim();
    live.current = full;
    setViewBox(full);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  // Measure the rendered width for the 44px rule and the pod-label threshold.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setElementPx(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [svgRef]);

  useEffect(() => () => stopAnim(), []);

  const zoomTo = useCallback(
    (target: Box) => {
      stopAnim();
      const to = clampBox(fitBox(target, aspect), full);
      const from = live.current;
      const ms = zoomDuration(reducedRef.current);
      if (ms === 0 || typeof requestAnimationFrame === "undefined") {
        apply(to);
        setViewBox(to);
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        apply(lerpBox(from, to, easeInOut(t)));
        if (t < 1) raf.current = requestAnimationFrame(step);
        else {
          raf.current = null;
          setViewBox(to);
        }
      };
      raf.current = requestAnimationFrame(step);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apply, aspect, fullKey],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const b = live.current;
      const w = Math.min(full.w, Math.max(MIN_VIEW_FT, b.w * factor));
      const h = w / aspect;
      zoomTo({ x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomTo, aspect, fullKey],
  );

  const reset = useCallback(() => zoomTo(full), [zoomTo, full]);

  // Ctrl/Cmd + wheel (and trackpad pinch) zooms about the cursor. Needs a non-passive listener to preventDefault.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      stopAnim();
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;
      const b = live.current;
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const w = Math.min(full.w, Math.max(MIN_VIEW_FT, b.w * Math.exp(e.deltaY * 0.01)));
      const h = w / aspect;
      const next = clampBox({ x: b.x + fx * b.w - fx * w, y: b.y + fy * b.h - fy * h, w, h }, full);
      apply(next);
      setViewBox(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRef, apply, aspect, fullKey]);

  const startSingle = (x: number, y: number) => {
    gesture.current = { kind: "pending", startBox: live.current, startX: x, startY: y, startDist: 0, moved: gesture.current.moved };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pointers.current.size === 0) {
      suppressClick.current = false;
      gesture.current.moved = false;
    }
    stopAnim();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) startSingle(e.clientX, e.clientY);
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = { kind: "pinch", startBox: live.current, startX: (a.x + b.x) / 2, startY: (a.y + b.y) / 2, startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, moved: true };
      const el = svgRef.current;
      for (const id of pointers.current.keys()) {
        try {
          el?.setPointerCapture(id);
        } catch {
          /* pointer already gone */
        }
      }
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const g = gesture.current;

    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const w = Math.min(full.w, Math.max(MIN_VIEW_FT, g.startBox.w * (g.startDist / dist)));
      const h = w / aspect;
      // The point in feet under the starting midpoint stays under the current midpoint.
      const ax = g.startBox.x + ((g.startX - rect.left) / rect.width) * g.startBox.w;
      const ay = g.startBox.y + ((g.startY - rect.top) / rect.height) * g.startBox.h;
      const next = clampBox({ x: ax - ((midX - rect.left) / rect.width) * w, y: ay - ((midY - rect.top) / rect.height) * h, w, h }, full);
      apply(next);
      return;
    }

    if ((g.kind === "pending" || g.kind === "pan") && pointers.current.size === 1) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (g.kind === "pending") {
        if (Math.hypot(dx, dy) < TAP_SLOP_PX) return;
        g.moved = true;
        // Not zoomed in: leave the drag to the page (touch-action lets it scroll).
        if (g.startBox.w >= full.w - 1e-6) {
          g.kind = "idle";
          return;
        }
        g.kind = "pan";
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      const next = clampBox({ x: g.startBox.x - (dx / rect.width) * g.startBox.w, y: g.startBox.y - (dy / rect.height) * g.startBox.h, w: g.startBox.w, h: g.startBox.h }, full);
      apply(next);
    }
  };

  const end = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (g.moved) suppressClick.current = true;
    if (pointers.current.size === 1 && g.kind === "pinch") {
      // One finger lifted mid-pinch: carry on as a pan from here.
      const [p] = [...pointers.current.values()] as [{ x: number; y: number }];
      startSingle(p.x, p.y);
      gesture.current.kind = "pan";
    } else if (pointers.current.size === 0) {
      gesture.current = { ...g, kind: "idle" };
    }
    if (g.moved) setViewBox(live.current);
  };

  const consumeGesture = useCallback(() => {
    const v = suppressClick.current;
    suppressClick.current = false;
    return v;
  }, []);

  const isZoomed = viewBox.w < full.w - 1e-6;
  const pxPerFt = elementPx > 0 ? elementPx / viewBox.w : 0;

  return {
    viewBox,
    isZoomed,
    elementPx,
    pxPerFt,
    zoomTo,
    zoomBy,
    reset,
    consumeGesture,
    current: () => live.current,
    // Plain functions over refs: fresh each render, no stale closures.
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
  };
}

/* ------------------------------------------------------------- controls */

export interface ZoomControlLabels {
  zoomIn: string;
  zoomOut: string;
  wholeFloor: string;
}

function Glyph({ plus }: { plus: boolean }) {
  // Filled shapes, no strokes, in line with the in-house icon set.
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
      <rect x={4} y={10.8} width={16} height={2.4} rx={1.2} fill="currentColor" />
      {plus ? <rect x={10.8} y={4} width={2.4} height={16} rx={1.2} fill="currentColor" /> : null}
    </svg>
  );
}

const CONTROL_BASE =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-35";
const CONTROL_TONE = {
  night: "border-oh-cream/25 bg-oh-ink text-oh-cream hover:bg-oh-stone focus-visible:outline-oh-gold",
  linen: "border-oh-charcoal/25 bg-oh-paper text-oh-charcoal hover:bg-oh-cream focus-visible:outline-oh-ember-deep",
} as const;

/**
 * Zoom buttons under the map (never over it, so they can't cover a pod):
 * the keyboard and one-handed alternative to pinching. 44px targets.
 */
export interface RowPanControl {
  labels: { earlier: string; later: string };
  /** Screen direction from the row's first pod toward its last (a unit vector along x or y). */
  later: readonly [number, number];
  canEarlier: boolean;
  canLater: boolean;
  onPan(dir: "earlier" | "later"): void;
}

/** A filled arrowhead pointing along `dir` (no strokes and no rotate transform, in line with the in-house icons). */
function Chevron({ dir }: { dir: readonly [number, number] }) {
  const [ux, uy] = dir;
  const [px, py] = [-uy, ux];
  const pt = (a: number, b: number) => `${12 + ux * a + px * b},${12 + uy * a + py * b}`;
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
      <polygon points={`${pt(5, 0)} ${pt(-4, 6)} ${pt(-1.5, 0)} ${pt(-4, -6)}`} fill="currentColor" />
    </svg>
  );
}

export function ZoomControls({ api, labels, maxedIn, tone = "night", pan }: { api: RowZoomApi; labels: ZoomControlLabels; maxedIn: boolean; tone?: "night" | "linen"; pan?: RowPanControl | null }) {
  const cls = `${CONTROL_BASE} ${CONTROL_TONE[tone]}`;
  const earlierDir: [number, number] = pan ? [-pan.later[0], -pan.later[1]] : [0, 0];
  // Keep the two chevrons in screen order (the earlier one first when it points left or up).
  const earlierFirst = earlierDir[0] < 0 || earlierDir[1] < 0;
  const panButtons = pan
    ? [
        <button key="earlier" type="button" aria-label={pan.labels.earlier} onClick={() => pan.onPan("earlier")} disabled={!pan.canEarlier} className={cls}>
          <Chevron dir={earlierDir} />
        </button>,
        <button key="later" type="button" aria-label={pan.labels.later} onClick={() => pan.onPan("later")} disabled={!pan.canLater} className={cls}>
          <Chevron dir={pan.later} />
        </button>,
      ]
    : [];
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {pan ? <div className="flex gap-2">{earlierFirst ? panButtons : [...panButtons].reverse()}</div> : null}
      {api.isZoomed ? (
        <button type="button" onClick={api.reset} className={`${cls} px-4 text-base`}>
          {labels.wholeFloor}
        </button>
      ) : null}
      <button type="button" aria-label={labels.zoomOut} onClick={() => api.zoomBy(1 / 0.6)} disabled={!api.isZoomed} className={cls}>
        <Glyph plus={false} />
      </button>
      <button type="button" aria-label={labels.zoomIn} onClick={() => api.zoomBy(0.6)} disabled={maxedIn} className={cls}>
        <Glyph plus />
      </button>
    </div>
  );
}

export const ZOOM_MIN_VIEW_FT = MIN_VIEW_FT;
