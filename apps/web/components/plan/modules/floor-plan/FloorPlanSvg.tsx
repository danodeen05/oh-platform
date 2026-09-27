import type { KeyboardEvent } from "react";
import {
  BUILDING,
  CROSS_AISLE,
  DIMS,
  DIRTY_PATH,
  DOORS,
  FINGERS,
  FT,
  GUEST_AISLES,
  GUEST_EXIT_PATH,
  GUEST_PATH,
  GUEST_RECTS,
  BOWL_PATH,
  KIOSKS,
  OPENINGS,
  PASS,
  PODS,
  ROWS,
  STAFF_CORRIDORS,
  STAFF_RECTS,
  WALLS,
  ZONES,
  type Door,
  type LayerKey,
  type Pod,
  type Point,
  type Rect,
  type ZoneKey,
} from "./layout";

export type LabelKey =
  | "title"
  | "kitchen"
  | "dish"
  | "boh"
  | "restroomHall"
  | "restroomMen"
  | "restroomWomen"
  | "store"
  | "lobby"
  | "kiosk"
  | "corridor"
  | "aisle"
  | "crossAisle"
  | "pass"
  | "entry"
  | "exit"
  | "staffDoor"
  | "receiving"
  | "ft";

export type HoverTarget = { kind: "corridor"; index: number } | { kind: "aisle"; index: number } | { kind: "zone"; key: ZoneKey };

interface Props {
  theme: "dark" | "light";
  mode?: "blueprint" | "territory";
  layers: Record<LayerKey, boolean>;
  labels: Record<LabelKey, string>;
  /** Highlighted pod (hover, pin, or the journey target). */
  activePod?: number | null;
  /** Pod carrying the roving tab stop; others get tabIndex -1. */
  tabPod?: number | null;
  /** Pod showing the keyboard focus ring. */
  focusPod?: number | null;
  hoverTarget?: HoverTarget | null;
  guest?: [number, number] | null;
  bowl?: [number, number] | null;
  showPaths?: boolean;
  onPodEnter?: (pod: Pod) => void;
  onPodLeave?: () => void;
  onPodActivate?: (pod: Pod) => void;
  onPodFocus?: (pod: Pod) => void;
  onPodBlur?: () => void;
  onPodKeyDown?: (event: KeyboardEvent<SVGGElement>, pod: Pod) => void;
  onTargetEnter?: (target: HoverTarget) => void;
  onTargetLeave?: () => void;
  podLabel?: (pod: Pod) => string;
  /** Unique prefix for pattern and marker ids when several drawings share a page. */
  idPrefix?: string;
  className?: string;
}

const PALETTE = {
  dark: {
    bg: "#1C1B19",
    zone: "#2A2724",
    wall: "#F2EDE4",
    wallSoft: "#9A9188",
    text: "#9A9188",
    textStrong: "#F2EDE4",
    pod: "#F2EDE4",
    podFill: "rgba(242,237,228,0.06)",
    duo: "#C9A227",
    hatch: "#C1502E",
    hatchLit: "#E07A5A",
    staffTint: "rgba(193,80,46,0.20)",
    guestTint: "rgba(201,162,39,0.11)",
    corridor: "rgba(193,80,46,0.22)",
    corridorLit: "rgba(193,80,46,0.38)",
    aisle: "rgba(242,237,228,0.045)",
    aisleLit: "rgba(201,162,39,0.20)",
    kitchen: "rgba(193,80,46,0.14)",
    restroom: "rgba(107,115,85,0.32)",
    store: "rgba(140,90,60,0.34)",
    lobby: "rgba(201,162,39,0.12)",
    active: "#C1502E",
    guestFlow: "#C9A227",
    staffFlow: "#E07A5A",
    focus: "#E07A5A",
  },
  light: {
    bg: "#FAF7F1",
    zone: "#F2EDE4",
    wall: "#1C1B19",
    wallSoft: "#8A8178",
    text: "#3A3632",
    textStrong: "#1C1B19",
    pod: "#1C1B19",
    podFill: "rgba(28,27,25,0.04)",
    duo: "#8C5A3C",
    hatch: "#C1502E",
    hatchLit: "#A94422",
    staffTint: "rgba(193,80,46,0.16)",
    guestTint: "rgba(201,162,39,0.18)",
    corridor: "rgba(193,80,46,0.18)",
    corridorLit: "rgba(193,80,46,0.32)",
    aisle: "rgba(28,27,25,0.03)",
    aisleLit: "rgba(201,162,39,0.24)",
    kitchen: "rgba(193,80,46,0.10)",
    restroom: "rgba(107,115,85,0.22)",
    store: "rgba(140,90,60,0.22)",
    lobby: "rgba(201,162,39,0.16)",
    active: "#C1502E",
    guestFlow: "#8C5A3C",
    staffFlow: "#C1502E",
    focus: "#C1502E",
  },
} as const;

const px = (ft: number): number => ft * FT;
const poly = (path: readonly Point[]): string => path.map(([x, y]) => `${px(x)},${px(y)}`).join(" ");
const rectAttrs = (r: Rect) => ({ x: px(r.x), y: px(r.y), width: px(r.w), height: px(r.h) });

const MARGIN = 3; // ft of margin around the building for dimension lines
const SWING: Record<Door["swing"], [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0], none: [0, 0] };

function doorPath(d: Door): { leaf: string; arc: string | null; threshold: string } {
  const hx = px(d.x);
  const hy = px(d.y);
  const wx = d.axis === "x" ? px(d.x + d.len) : hx;
  const wy = d.axis === "y" ? px(d.y + d.len) : hy;
  const threshold = `M${hx},${hy} L${wx},${wy}`;
  if (d.swing === "none") return { leaf: "", arc: null, threshold };
  const [sx, sy] = SWING[d.swing];
  const lx = hx + sx * px(d.len);
  const ly = hy + sy * px(d.len);
  const cross = (wx - hx) * (ly - hy) - (wy - hy) * (lx - hx);
  const sweep = cross > 0 ? 1 : 0;
  return {
    leaf: `M${hx},${hy} L${lx},${ly}`,
    arc: `M${wx},${wy} A${px(d.len)},${px(d.len)} 0 0 ${sweep} ${lx},${ly}`,
    threshold,
  };
}

/**
 * The comb floor plan as a single SVG. Hook-free so it renders on the server
 * for the print route and inside the client module alike. All copy arrives
 * through `labels`; all geometry through layout.ts.
 */
export function FloorPlanSvg({
  theme,
  mode = "blueprint",
  layers,
  labels,
  activePod = null,
  tabPod = null,
  focusPod = null,
  hoverTarget = null,
  guest = null,
  bowl = null,
  showPaths = false,
  onPodEnter,
  onPodLeave,
  onPodActivate,
  onPodFocus,
  onPodBlur,
  onPodKeyDown,
  onTargetEnter,
  onTargetLeave,
  podLabel,
  idPrefix = "fp",
  className,
}: Props) {
  const c = PALETTE[theme];
  const territory = mode === "territory";
  const interactive = Boolean(onPodActivate);
  const active = activePod !== null ? PODS.find((p) => p.number === activePod) ?? null : null;
  const litCorridor = hoverTarget?.kind === "corridor" ? hoverTarget.index : active ? active.corridor : null;
  const litAisle = hoverTarget?.kind === "aisle" ? hoverTarget.index : active ? active.aisle : null;
  const hatchId = `${idPrefix}-staff-hatch`;
  const guestMarker = `${idPrefix}-arrow-guest`;
  const staffMarker = `${idPrefix}-arrow-staff`;

  const label = (x: number, y: number, text: string, size = 11, opts: { rotate?: number; strong?: boolean; anchor?: "start" | "middle" | "end" } = {}) => (
    <text
      x={px(x)}
      y={px(y)}
      fill={opts.strong ? c.textStrong : c.text}
      fontSize={size}
      textAnchor={opts.anchor ?? "middle"}
      dominantBaseline="middle"
      letterSpacing="0.12em"
      style={{ textTransform: "uppercase", fontFamily: "var(--font-primary), sans-serif" }}
      transform={opts.rotate ? `rotate(${opts.rotate} ${px(x)} ${px(y)})` : undefined}
    >
      {text}
    </text>
  );

  const zone = (key: ZoneKey) => ZONES.find((z) => z.key === key) as Rect;
  const targetProps = (t: HoverTarget) =>
    onTargetEnter
      ? { onMouseEnter: () => onTargetEnter(t), onMouseLeave: () => onTargetLeave?.(), style: { cursor: "help" as const } }
      : {};

  return (
    <svg
      viewBox={`${-px(MARGIN)} ${-px(MARGIN)} ${px(BUILDING.w + 2 * MARGIN)} ${px(BUILDING.h + 2 * MARGIN)}`}
      role="group"
      aria-label={labels.title}
      className={className}
    >
      <defs>
        <pattern id={hatchId} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={c.textStrong} strokeOpacity={theme === "dark" ? 0.09 : 0.14} strokeWidth="1" />
        </pattern>
        <marker id={guestMarker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill={c.guestFlow} />
        </marker>
        <marker id={staffMarker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill={c.staffFlow} />
        </marker>
      </defs>

      {/* shell */}
      <rect x={0} y={0} width={px(BUILDING.w)} height={px(BUILDING.h)} fill={c.bg} />

      {/* territory wash: faint in blueprint mode, full in territory mode */}
      <g data-layer="territory" opacity={territory ? 1 : 0.45}>
        {STAFF_RECTS.map((r, i) => (
          <rect key={`s${i}`} {...rectAttrs(r)} fill={c.staffTint} />
        ))}
        {territory
          ? STAFF_RECTS.map((r, i) => <rect key={`sh${i}`} {...rectAttrs(r)} fill={`url(#${hatchId})`} />)
          : null}
        {GUEST_RECTS.map((r, i) => (
          <rect key={`g${i}`} {...rectAttrs(r)} fill={c.guestTint} />
        ))}
      </g>

      {/* zones */}
      {layers.kitchen ? (
        <g data-layer="kitchen" {...targetProps({ kind: "zone", key: "kitchen" })}>
          <rect {...rectAttrs(zone("kitchen"))} fill={territory ? "transparent" : c.kitchen} />
          <rect {...rectAttrs(PASS)} fill={c.hatch} fillOpacity={0.35} />
          {label(zone("kitchen").w / 2, 4.6, labels.kitchen, 13, { strong: true })}
          {label(zone("kitchen").w / 2, 7.6, labels.pass, 8)}
        </g>
      ) : null}
      {layers.boh ? (
        <g data-layer="boh">
          <g {...targetProps({ kind: "zone", key: "dish" })}>
            <rect {...rectAttrs(zone("dish"))} fill={territory ? "transparent" : c.zone} />
            {label(zone("dish").x + zone("dish").w / 2, 5.5, labels.dish, 8, { rotate: -90 })}
          </g>
          <g {...targetProps({ kind: "zone", key: "boh" })}>
            <rect {...rectAttrs(zone("boh"))} fill={territory ? "transparent" : c.zone} />
            {label(zone("boh").x + zone("boh").w / 2, 5.5, labels.boh, 8)}
          </g>
        </g>
      ) : null}
      {layers.restrooms ? (
        <g data-layer="restrooms">
          <g {...targetProps({ kind: "zone", key: "restroomHall" })}>
            <rect {...rectAttrs(zone("restroomHall"))} fill={territory ? "transparent" : c.restroom} fillOpacity={0.5} />
            {label(zone("restroomHall").x + zone("restroomHall").w / 2, zone("restroomHall").y + 2.5, labels.restroomHall, 8)}
          </g>
          <g {...targetProps({ kind: "zone", key: "restroomMen" })}>
            <rect {...rectAttrs(zone("restroomMen"))} fill={territory ? "transparent" : c.restroom} />
            {label(zone("restroomMen").x + zone("restroomMen").w / 2, zone("restroomMen").y + 5.5, labels.restroomMen, 8)}
          </g>
          <g {...targetProps({ kind: "zone", key: "restroomWomen" })}>
            <rect {...rectAttrs(zone("restroomWomen"))} fill={territory ? "transparent" : c.restroom} />
            {label(zone("restroomWomen").x + zone("restroomWomen").w / 2, zone("restroomWomen").y + 5.5, labels.restroomWomen, 8)}
          </g>
        </g>
      ) : null}
      {layers.store ? (
        <g data-layer="store" {...targetProps({ kind: "zone", key: "store" })}>
          <rect {...rectAttrs(zone("store"))} fill={territory ? "transparent" : c.store} />
          {label(zone("store").x + zone("store").w / 2, zone("store").y + zone("store").h / 2, labels.store, 9, { strong: true })}
        </g>
      ) : null}
      {layers.entry ? (
        <g data-layer="entry" {...targetProps({ kind: "zone", key: "lobby" })}>
          <rect {...rectAttrs(zone("lobby"))} fill={territory ? "transparent" : c.lobby} />
          {KIOSKS.map((k, i) => (
            <rect key={i} {...rectAttrs(k)} fill={c.duo} fillOpacity={0.85} rx={1.5} />
          ))}
          {label(zone("lobby").x + zone("lobby").w / 2, zone("lobby").y + 3.6, labels.kiosk, 7)}
          {label(zone("lobby").x + zone("lobby").w / 2, zone("lobby").y + zone("lobby").h / 2 + 1.5, labels.lobby, 9, { strong: true })}
        </g>
      ) : null}

      {/* guest aisles */}
      {layers.aisles ? (
        <g data-layer="aisles">
          {GUEST_AISLES.map((a) => (
            <g key={a.key} {...targetProps({ kind: "aisle", index: a.index })}>
              <rect {...rectAttrs(a)} fill={litAisle === a.index ? c.aisleLit : territory ? "transparent" : c.aisle} />
              {label(a.x + a.w / 2, a.y + a.h / 2, `${labels.aisle} ${a.index}`, 8, { rotate: -90 })}
            </g>
          ))}
          <g {...targetProps({ kind: "aisle", index: 0 })}>
            <rect {...rectAttrs(CROSS_AISLE)} fill={territory ? "transparent" : c.aisle} />
            {label(CROSS_AISLE.w / 2, CROSS_AISLE.y + CROSS_AISLE.h / 2, labels.crossAisle, 8)}
          </g>
        </g>
      ) : null}

      {/* staff corridors, closed at the front */}
      {layers.corridors ? (
        <g data-layer="corridors">
          {STAFF_CORRIDORS.map((k) => (
            <g key={k.key} {...targetProps({ kind: "corridor", index: k.finger })}>
              <rect {...rectAttrs(k)} fill={litCorridor === k.finger ? c.corridorLit : territory ? "transparent" : c.corridor} />
              {label(k.x + k.w / 2, k.y + k.h / 2, `${labels.corridor} ${k.finger}`, 8, { rotate: -90, strong: true })}
            </g>
          ))}
        </g>
      ) : null}

      {/* territory mode: the wall between the two territories, hatches are the gaps */}
      {territory
        ? ROWS.map((r) => {
            // The hatch sits on the corridor-facing edge, opposite the seat: east on a west row, west on an east row.
            const x = r.side === "west" ? r.x + r.w : r.x;
            return <line key={r.key} x1={px(x)} y1={px(r.y)} x2={px(x)} y2={px(r.y + r.h)} stroke={c.textStrong} strokeWidth={2} />;
          })
        : null}

      {/* walls */}
      <g data-layer="walls">
        {WALLS.map(([a, b], i) => (
          <line key={i} x1={px(a[0])} y1={px(a[1])} x2={px(b[0])} y2={px(b[1])} stroke={c.wall} strokeWidth={i < 4 ? 2.5 : 1.3} strokeLinecap="square" />
        ))}
        {OPENINGS.map((o) => (
          <line
            key={o.key}
            x1={px(o.x)}
            y1={px(o.y)}
            x2={px(o.axis === "x" ? o.x + o.len : o.x)}
            y2={px(o.axis === "y" ? o.y + o.len : o.y)}
            stroke={c.wallSoft}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}
        {DOORS.map((d) => {
          const p = doorPath(d);
          return (
            <g key={d.key}>
              <path d={p.threshold} stroke={c.bg} strokeWidth={3} />
              {p.arc ? <path d={p.arc} fill="none" stroke={c.wallSoft} strokeWidth={0.8} strokeDasharray="2 2" /> : null}
              {p.leaf ? <path d={p.leaf} stroke={c.wall} strokeWidth={1.6} strokeLinecap="round" /> : <path d={p.threshold} stroke={c.wallSoft} strokeWidth={1} strokeDasharray="3 3" />}
            </g>
          );
        })}
        {label(DOORS.find((d) => d.key === "entry")!.x + 1.5, BUILDING.h + 1.4, labels.entry, 8, { strong: true })}
        {(() => {
          // The exit sits on whichever exterior wall it's mirrored onto (x = 0 or x = BUILDING.w), never assumed to be the east/right wall.
          const exit = DOORS.find((d) => d.key === "exit")!;
          const exitLabelX = exit.x === 0 ? exit.x - 1.6 : exit.x + 1.6;
          return label(exitLabelX, exit.y + 1.5, labels.exit, 8, { rotate: 90, strong: true });
        })()}
        {label(DOORS.find((d) => d.key === "staff")!.x + 1.5, -1.3, labels.staffDoor, 7)}
        {label(DOORS.find((d) => d.key === "receiving")!.x + 1.5, -1.3, labels.receiving, 7)}
      </g>

      {/* pods */}
      {layers.pods ? (
        <g data-layer="pods">
          {PODS.map((p) => {
            const isActive = p.number === activePod;
            const isFocus = p.number === focusPod;
            const hatchX = p.side === "west" ? p.x + p.w : p.x;
            const seatX = p.side === "west" ? p.x : p.x + p.w;
            const hatchLit = isActive || litCorridor === p.corridor;
            const duoBelow = p.type === "duo" && p.duoWith !== undefined && p.duoWith > p.number;
            const handlers = interactive
              ? {
                  role: "button" as const,
                  tabIndex: tabPod === null ? 0 : p.number === tabPod ? 0 : -1,
                  "aria-label": podLabel ? podLabel(p) : `Pod ${p.number}`,
                  "aria-pressed": isActive,
                  "data-pod": p.number,
                  onMouseEnter: () => onPodEnter?.(p),
                  onMouseLeave: () => onPodLeave?.(),
                  onFocus: () => onPodFocus?.(p),
                  onBlur: () => onPodBlur?.(),
                  onClick: () => onPodActivate?.(p),
                  onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPodActivate?.(p);
                      return;
                    }
                    onPodKeyDown?.(e, p);
                  },
                  style: { cursor: "pointer", outline: "none" as const },
                }
              : {};
            return (
              <g key={p.number} {...handlers}>
                {isFocus ? <rect x={px(p.x) - 3} y={px(p.y) - 3} width={px(p.w) + 6} height={px(p.h) + 6} fill="none" stroke={c.focus} strokeWidth={2} rx={3} /> : null}
                <rect
                  {...rectAttrs(p)}
                  fill={isActive ? c.active : c.podFill}
                  stroke={p.type === "duo" ? c.duo : c.pod}
                  strokeWidth={isActive ? 1.6 : 0.8}
                  rx={1.5}
                  opacity={isActive ? 1 : 0.92}
                />
                <line x1={px(hatchX)} y1={px(p.y + 0.3)} x2={px(hatchX)} y2={px(p.y + p.h - 0.3)} stroke={hatchLit ? c.hatchLit : c.hatch} strokeWidth={hatchLit ? 3 : 2} />
                <line x1={px(seatX)} y1={px(p.y + 0.7)} x2={px(seatX)} y2={px(p.y + p.h - 0.7)} stroke={c.pod} strokeWidth={0.8} strokeOpacity={0.6} />
                {duoBelow ? (
                  <line x1={px(p.x + 0.4)} y1={px(p.y + p.h + 0.125)} x2={px(p.x + p.w - 0.4)} y2={px(p.y + p.h + 0.125)} stroke={c.duo} strokeWidth={1} strokeDasharray="2 2" />
                ) : null}
                <text
                  x={px(p.x + p.w / 2)}
                  y={px(p.y + p.h / 2)}
                  fill={isActive ? c.textStrong : c.text}
                  fontSize={7}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-primary), sans-serif" }}
                >
                  {p.number}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}

      {/* static flow arrows */}
      {layers.flow && !showPaths ? (
        <g data-layer="flow" opacity={0.85}>
          <polyline points={poly(GUEST_PATH)} fill="none" stroke={c.guestFlow} strokeWidth={1.6} markerEnd={`url(#${guestMarker})`} />
          <polyline points={poly(GUEST_EXIT_PATH)} fill="none" stroke={c.guestFlow} strokeWidth={1.6} strokeDasharray="5 3" markerEnd={`url(#${guestMarker})`} />
          <polyline points={poly(BOWL_PATH)} fill="none" stroke={c.staffFlow} strokeWidth={1.6} markerEnd={`url(#${staffMarker})`} />
          <polyline points={poly(DIRTY_PATH)} fill="none" stroke={c.staffFlow} strokeWidth={1.6} strokeDasharray="5 3" markerEnd={`url(#${staffMarker})`} />
        </g>
      ) : null}

      {/* dimensions */}
      {layers.dimensions ? (
        <g data-layer="dimensions" stroke={c.wallSoft} strokeWidth={0.8}>
          <line x1={0} y1={-px(1.6)} x2={px(BUILDING.w)} y2={-px(1.6)} />
          <line x1={0} y1={-px(2.1)} x2={0} y2={-px(1.1)} />
          <line x1={px(BUILDING.w)} y1={-px(2.1)} x2={px(BUILDING.w)} y2={-px(1.1)} />
          <line x1={-px(1.6)} y1={0} x2={-px(1.6)} y2={px(BUILDING.h)} />
          <line x1={-px(2.1)} y1={0} x2={-px(1.1)} y2={0} />
          <line x1={-px(2.1)} y1={px(BUILDING.h)} x2={-px(1.1)} y2={px(BUILDING.h)} />
          <g stroke="none">
            {label(BUILDING.w / 2, -2.3, `${BUILDING.w} ${labels.ft}`, 9)}
            {label(-2.3, BUILDING.h / 2, `${BUILDING.h} ${labels.ft}`, 9, { rotate: -90 })}
            {label(FINGERS[0]!.x + FINGERS[0]!.w / 2, DIMS.rear + DIMS.fingerLen + 1.2, `${DIMS.podDepth} + ${DIMS.corridorW} + ${DIMS.podDepth} ${labels.ft}`, 7)}
            {label(GUEST_AISLES[0]!.x + GUEST_AISLES[0]!.w / 2, DIMS.rear - 0.9, `${DIMS.aisleW} ${labels.ft}`, 7)}
            {label(BUILDING.w + 1.5, DIMS.rear / 2, `${DIMS.rear} ${labels.ft}`, 7, { rotate: 90 })}
          </g>
        </g>
      ) : null}

      {/* journey overlays */}
      {showPaths ? (
        <g data-layer="journey">
          <polyline points={poly(GUEST_PATH)} fill="none" stroke={c.guestFlow} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.7} />
          <polyline points={poly(GUEST_EXIT_PATH)} fill="none" stroke={c.guestFlow} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.45} />
          <polyline points={poly(BOWL_PATH)} fill="none" stroke={c.staffFlow} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.7} />
          <polyline points={poly(DIRTY_PATH)} fill="none" stroke={c.staffFlow} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.45} />
        </g>
      ) : null}
      {guest ? <circle cx={px(guest[0])} cy={px(guest[1])} r={5.5} fill={c.guestFlow} stroke={c.bg} strokeWidth={2} /> : null}
      {bowl ? <circle cx={px(bowl[0])} cy={px(bowl[1])} r={5.5} fill={c.staffFlow} stroke={c.bg} strokeWidth={2} /> : null}
    </svg>
  );
}
