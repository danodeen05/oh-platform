/**
 * Geometry helpers for the in-house icon set (Task C2, Fix round 1).
 *
 * The house rule: no icon is a uniform-width `stroke` path with round caps
 * (that's the Lucide/Feather look the brief bans). Instead every icon is
 * built from FILLED outline paths:
 *
 * - `brushStroke`: an open line/curve centerline turned into a tapered
 *   "brush stroke" polygon -- thick at one end (optionally with a rounded,
 *   ink-pooled cap), thinning to a point at the other. Used for anything
 *   with a visible start and end (a chopstick, a checkmark, an arrow).
 * - `ring` / `ringRect`: a closed loop (a circle or rounded rect) has no
 *   start or end to taper, so it's rendered as a constant-width outline --
 *   an outer shape and an inner shape combined with `fill-rule="evenodd"`.
 * - `circlePath` / `roundedRectPath`: solid closed shapes, for silhouette
 *   icons (the pin) and as building blocks for the ring helpers above.
 *
 * Every one of these returns plain SVG path `d` string(s) with no `stroke`
 * or `stroke-width` involved anywhere -- Icon.tsx only ever sets `fill`.
 */

export interface Pt {
  x: number;
  y: number;
}

const KAPPA = 0.5522847498307936;

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
}

function pt(x: number, y: number): Pt {
  return { x, y };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return pt(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
}

function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return pt(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y);
}

export type Seg =
  | { kind: "line"; a: Pt; b: Pt }
  | { kind: "cubic"; p0: Pt; p1: Pt; p2: Pt; p3: Pt }
  /** Circular arc; `a0`/`a1` in degrees, standard math convention (0 = +x axis). */
  | { kind: "arc"; cx: number; cy: number; r: number; a0: number; a1: number };

function sampleSeg(seg: Seg, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (seg.kind === "line") out.push(lerpPt(seg.a, seg.b, t));
    else if (seg.kind === "cubic") out.push(cubicAt(seg.p0, seg.p1, seg.p2, seg.p3, t));
    else {
      const deg = lerp(seg.a0, seg.a1, t);
      const rad = (deg * Math.PI) / 180;
      out.push(pt(seg.cx + seg.r * Math.cos(rad), seg.cy + seg.r * Math.sin(rad)));
    }
  }
  return out;
}

function sampleChain(segs: Seg[], stepsPerSeg: number): Pt[] {
  const pts: Pt[] = [];
  segs.forEach((seg, i) => {
    const s = sampleSeg(seg, stepsPerSeg);
    pts.push(...(i === 0 ? s : s.slice(1)));
  });
  return pts;
}

// theta in [0, PI]: 0 -> +n (the "left" offset), PI -> -n (the "right"
// offset), PI/2 -> `bulge` direction. Used to build a rounded semicircular
// cap at either end of a brush stroke.
function capArcPoints(p0: Pt, n: Pt, bulge: Pt, r: number, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < steps; i++) {
    const theta = (Math.PI * i) / steps;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    out.push(pt(p0.x + r * (c * n.x + s * bulge.x), p0.y + r * (c * n.y + s * bulge.y)));
  }
  return out;
}

export interface TaperOpts {
  /** Rounded, ink-pooled cap at the start (thick end). Default: pointed/flat. */
  capStart?: boolean;
  /** Rounded cap at the end. Default: pointed/flat (the usual "flicked" taper). */
  capEnd?: boolean;
  stepsPerSeg?: number;
}

/**
 * Builds one filled, tapered brush-stroke path along a chain of
 * line/cubic/arc segments. `widthAt(t)` gives the stroke width at position
 * `t` (0 at the very start of the chain, 1 at the very end).
 */
export function brushStroke(segs: Seg[], widthAt: (t: number) => number, opts: TaperOpts = {}): string {
  const steps = opts.stepsPerSeg ?? 12;
  const points = sampleChain(segs, steps);
  const n = points.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const dirs: Pt[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    dirs.push(pt(dx, dy));
    const nx = -dy;
    const ny = dx;
    const w = widthAt(i / (n - 1)) / 2;
    left.push(pt(points[i].x + nx * w, points[i].y + ny * w));
    right.push(pt(points[i].x - nx * w, points[i].y - ny * w));
  }

  const segments: string[] = [`M ${fmt(left[0].x)} ${fmt(left[0].y)}`];
  for (let i = 1; i < n; i++) segments.push(`L ${fmt(left[i].x)} ${fmt(left[i].y)}`);

  if (opts.capEnd) {
    const dir = dirs[n - 1];
    const nEnd = pt(-dir.y, dir.x);
    const r = widthAt(1) / 2;
    const cap = capArcPoints(points[n - 1], nEnd, dir, r, 8);
    for (const p of cap) segments.push(`L ${fmt(p.x)} ${fmt(p.y)}`);
  }

  for (let i = n - 1; i >= 0; i--) segments.push(`L ${fmt(right[i].x)} ${fmt(right[i].y)}`);

  if (opts.capStart) {
    const dir = dirs[0];
    const n0 = pt(-dir.y, dir.x);
    const bulge = pt(-dir.x, -dir.y);
    const r = widthAt(0) / 2;
    const cap = capArcPoints(points[0], n0, bulge, r, 8).reverse();
    for (const p of cap) segments.push(`L ${fmt(p.x)} ${fmt(p.y)}`);
  }

  segments.push("Z");
  return segments.join(" ");
}

/** Convenience: a single tapered straight stroke from `a` to `b`. */
export function taperLine(a: Pt, b: Pt, w0: number, w1: number, opts?: TaperOpts): string {
  return brushStroke([{ kind: "line", a, b }], (t) => lerp(w0, w1, t), opts);
}

/** Convenience: a single tapered cubic-bezier stroke. */
export function taperCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, w0: number, w1: number, opts?: TaperOpts): string {
  return brushStroke([{ kind: "cubic", p0, p1, p2, p3 }], (t) => lerp(w0, w1, t), opts);
}

/** Convenience: a single tapered circular-arc stroke (degrees). */
export function taperArc(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  w0: number,
  w1: number,
  opts?: TaperOpts,
): string {
  return brushStroke([{ kind: "arc", cx, cy, r, a0, a1 }], (t) => lerp(w0, w1, t), opts);
}

/** A chain of connected segments with linear taper end-to-end. */
export function taperChain(segs: Seg[], w0: number, w1: number, opts?: TaperOpts): string {
  return brushStroke(segs, (t) => lerp(w0, w1, t), opts);
}

/**
 * A chain (or single segment via a 1-item array) that's thin at both ends
 * and thickest at the middle -- a natural, pressure-varying brush sweep,
 * e.g. the bowl's body curve.
 */
export function midPeakChain(segs: Seg[], wMid: number, wEnds = 0.3, opts?: TaperOpts): string {
  return brushStroke(segs, (t) => lerp(wEnds, wMid, Math.sin(Math.PI * t)), opts);
}

/** A full circle, centerline radius `r` (for solid fills or as a ring's outer/inner edge). */
export function circlePath(cx: number, cy: number, r: number): string {
  const k = r * KAPPA;
  return [
    `M ${fmt(cx + r)} ${fmt(cy)}`,
    `C ${fmt(cx + r)} ${fmt(cy + k)} ${fmt(cx + k)} ${fmt(cy + r)} ${fmt(cx)} ${fmt(cy + r)}`,
    `C ${fmt(cx - k)} ${fmt(cy + r)} ${fmt(cx - r)} ${fmt(cy + k)} ${fmt(cx - r)} ${fmt(cy)}`,
    `C ${fmt(cx - r)} ${fmt(cy - k)} ${fmt(cx - k)} ${fmt(cy - r)} ${fmt(cx)} ${fmt(cy - r)}`,
    `C ${fmt(cx + k)} ${fmt(cy - r)} ${fmt(cx + r)} ${fmt(cy - k)} ${fmt(cx + r)} ${fmt(cy)}`,
    "Z",
  ].join(" ");
}

/** A closed circular outline of constant `width`, centerline radius `r`. No terminals to taper. */
export function ring(cx: number, cy: number, r: number, width: number): string {
  return `${circlePath(cx, cy, r + width / 2)} ${circlePath(cx, cy, Math.max(0.35, r - width / 2))}`;
}

/** A solid rounded rectangle, centerline box (x,y,w,h), corner radius `r`. */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const k = rr * KAPPA;
  const x2 = x + w;
  const y2 = y + h;
  return [
    `M ${fmt(x + rr)} ${fmt(y)}`,
    `L ${fmt(x2 - rr)} ${fmt(y)}`,
    `C ${fmt(x2 - rr + k)} ${fmt(y)} ${fmt(x2)} ${fmt(y + rr - k)} ${fmt(x2)} ${fmt(y + rr)}`,
    `L ${fmt(x2)} ${fmt(y2 - rr)}`,
    `C ${fmt(x2)} ${fmt(y2 - rr + k)} ${fmt(x2 - rr + k)} ${fmt(y2)} ${fmt(x2 - rr)} ${fmt(y2)}`,
    `L ${fmt(x + rr)} ${fmt(y2)}`,
    `C ${fmt(x + rr - k)} ${fmt(y2)} ${fmt(x)} ${fmt(y2 - rr + k)} ${fmt(x)} ${fmt(y2 - rr)}`,
    `L ${fmt(x)} ${fmt(y + rr)}`,
    `C ${fmt(x)} ${fmt(y + rr - k)} ${fmt(x + rr - k)} ${fmt(y)} ${fmt(x + rr)} ${fmt(y)}`,
    "Z",
  ].join(" ");
}

/** A closed rounded-rect outline of constant `width`, centerline box (x,y,w,h). No terminals to taper. */
export function ringRect(x: number, y: number, w: number, h: number, r: number, width: number): string {
  const inset = width / 2;
  return `${roundedRectPath(x - inset, y - inset, w + 2 * inset, h + 2 * inset, r + inset)} ${roundedRectPath(
    x + inset,
    y + inset,
    Math.max(0.1, w - 2 * inset),
    Math.max(0.1, h - 2 * inset),
    Math.max(0, r - inset),
  )}`;
}

export { pt, lerp };
