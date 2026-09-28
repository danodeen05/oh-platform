"use client";

/**
 * One pod on the CombMap, plus the shared status patterns (Task D4a).
 *
 * Status is never color alone: available is a light solid, occupied a dark
 * solid, reserved adds a diagonal hatch and cleaning adds dots. The food
 * hatch edge (the side facing the staff corridor) is drawn as a thin ember
 * line, which is also how a guest can tell the two rows of a finger apart.
 *
 * Everything is in feet (the SVG's user units). Colors come from the
 * `--color-oh-*` tokens through Tailwind `fill-*`/`stroke-*` classes; the
 * linen tone uses `#EDE6DA` directly until Lane 2's token lands.
 */
import { memo, type KeyboardEvent } from "react";
import type { Box } from "./RowZoom";

export type SeatStatus = "AVAILABLE" | "RESERVED" | "OCCUPIED" | "CLEANING";
/** NONE: no seat data (journey and loading); UNKNOWN: seat data given, but none for this pod. */
export type PodStatus = SeatStatus | "NONE" | "UNKNOWN";
export type Tone = "night" | "linen";
export type NavKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";
export type Point = readonly [number, number];

export interface PatternIds {
  reserved: string;
  cleaning: string;
}

/** Tailwind class sets per tone. Full class strings (never built by concatenation) so Tailwind's scanner sees them. */
export const TONES = {
  night: {
    bg: "bg-oh-charcoal",
    floor: "fill-oh-ink",
    wall: "stroke-oh-cream",
    text: "fill-oh-mute",
    textStrong: "fill-oh-cream",
    zoneText: "fill-oh-cream/80",
    halo: "stroke-oh-ink",
    staff: "fill-oh-ember/15",
    corridor: "fill-oh-ember/25",
    lobby: "fill-oh-gold/10",
    store: "fill-oh-clay/30",
    restroom: "fill-oh-olive/30",
    kiosk: "fill-oh-stone",
    finger: "stroke-oh-gold fill-oh-charcoal",
    fingerText: "fill-oh-gold",
    door: "stroke-oh-gold",
    doorArrow: "fill-oh-gold",
    hatchPattern: "stroke-oh-cream/60",
    dotPattern: "fill-oh-gold/80",
    pod: {
      AVAILABLE: { body: "fill-oh-cream", num: "fill-oh-charcoal" },
      RESERVED: { body: "fill-oh-stone", num: "fill-oh-cream" },
      OCCUPIED: { body: "fill-oh-charcoal stroke-oh-mute/40", num: "fill-oh-mute" },
      CLEANING: { body: "fill-oh-stone", num: "fill-oh-cream" },
      NONE: { body: "fill-oh-stone stroke-oh-cream/25", num: "fill-oh-mute" },
      UNKNOWN: { body: "fill-transparent stroke-oh-mute/60", num: "fill-oh-mute" },
    },
    selected: { body: "fill-oh-ember-deep", num: "fill-oh-cream" },
    target: { body: "fill-oh-ember-deep", num: "fill-oh-cream" },
    hatchEdge: "stroke-oh-ember",
    numHalo: "stroke-oh-stone",
    duo: "stroke-oh-gold/45",
    duoLit: "stroke-oh-gold",
    ring: "stroke-oh-gold",
    focus: "stroke-oh-gold",
    guestPath: "stroke-oh-gold/50",
    bowlPath: "stroke-oh-ember-light/60",
    guest: "fill-oh-gold stroke-oh-charcoal",
    bowl: "fill-oh-ember-light stroke-oh-charcoal",
  },
  linen: {
    // TODO(tokens): swap bg-[#EDE6DA]/fill-[#EDE6DA] for the oh-linen token once Lane 2's globals.css change merges.
    bg: "bg-[#EDE6DA]",
    floor: "fill-oh-paper",
    wall: "stroke-oh-charcoal",
    text: "fill-oh-stone",
    textStrong: "fill-oh-charcoal",
    zoneText: "fill-oh-stone",
    halo: "stroke-oh-paper",
    staff: "fill-oh-ember/10",
    corridor: "fill-oh-ember/20",
    lobby: "fill-oh-gold/15",
    store: "fill-oh-clay/20",
    restroom: "fill-oh-olive/20",
    kiosk: "fill-oh-ash/50",
    finger: "stroke-oh-clay fill-oh-paper",
    fingerText: "fill-oh-clay",
    door: "stroke-oh-clay",
    doorArrow: "fill-oh-clay",
    hatchPattern: "stroke-oh-charcoal/45",
    dotPattern: "fill-oh-charcoal/55",
    pod: {
      AVAILABLE: { body: "fill-oh-paper stroke-oh-charcoal/60", num: "fill-oh-charcoal" },
      RESERVED: { body: "fill-[#EDE6DA] stroke-oh-charcoal/40", num: "fill-oh-charcoal" },
      OCCUPIED: { body: "fill-oh-stone", num: "fill-oh-cream" },
      CLEANING: { body: "fill-[#EDE6DA] stroke-oh-charcoal/40", num: "fill-oh-charcoal" },
      NONE: { body: "fill-oh-cream stroke-oh-charcoal/30", num: "fill-oh-stone" },
      UNKNOWN: { body: "fill-transparent stroke-oh-ash", num: "fill-oh-stone" },
    },
    selected: { body: "fill-oh-ember-deep", num: "fill-oh-cream" },
    target: { body: "fill-oh-ember-deep", num: "fill-oh-cream" },
    hatchEdge: "stroke-oh-ember",
    numHalo: "stroke-[#EDE6DA]",
    duo: "stroke-oh-clay/50",
    duoLit: "stroke-oh-clay",
    ring: "stroke-oh-charcoal",
    focus: "stroke-oh-ember-deep",
    guestPath: "stroke-oh-clay/50",
    bowlPath: "stroke-oh-ember/50",
    guest: "fill-oh-clay stroke-oh-paper",
    bowl: "fill-oh-ember stroke-oh-paper",
  },
} as const;

/** The two status patterns, in feet. One `<defs>` per map (ids from useId). */
export function StatusPatterns({ ids, tone }: { ids: PatternIds; tone: Tone }) {
  const t = TONES[tone];
  return (
    <defs>
      <pattern id={ids.reserved} patternUnits="userSpaceOnUse" width={0.7} height={0.7}>
        {/* 45 degree hatch drawn as a diagonal line per tile, plus the corner pieces so tiles join seamlessly. */}
        <path d="M-0.175,0.175 L0.175,-0.175 M0,0.7 L0.7,0 M0.525,0.875 L0.875,0.525" className={t.hatchPattern} strokeWidth={0.14} fill="none" />
      </pattern>
      <pattern id={ids.cleaning} patternUnits="userSpaceOnUse" width={0.7} height={0.7}>
        <circle cx={0.35} cy={0.35} r={0.13} className={t.dotPattern} />
      </pattern>
    </defs>
  );
}

export interface PodView {
  label: string;
  /** Row this pod belongs to (RowKey from @oh/floor-plan). */
  row: number;
  rect: Box;
  /** Transparent hit area: the pod's full pitch plus a step into the guest aisle. */
  hit: Box;
  /** The hatch edge, as a line segment. */
  hatch: readonly [Point, Point];
  center: Point;
  duo: boolean;
}

export interface PodCellProps {
  view: PodView;
  status: PodStatus;
  tone: Tone;
  patternIds: PatternIds;
  /** Pods are buttons in pick and live mode; journey mode draws them only. */
  interactive: boolean;
  /** Pick mode: this pod can be chosen. */
  selectable: boolean;
  pickMode: boolean;
  selected: boolean;
  journeyTarget: boolean;
  dimmed: boolean;
  duoHighlight: boolean;
  tabStop: boolean;
  ariaLabel: string;
  /** "portrait" stacks the finger letter over the number; "landscape" writes "B-07" on one line. */
  layout: "portrait" | "landscape";
  showText: boolean;
  onActivate?: (label: string, via: "pointer" | "keyboard") => void;
  onNav?: (label: string, key: NavKey) => void;
  onEscape?: () => void;
  onFocusPod?: (label: string) => void;
}

const NAV_KEYS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

function PodCellImpl(props: PodCellProps) {
  const { view, status, tone, patternIds, interactive, selectable, pickMode, selected, journeyTarget, dimmed, duoHighlight, tabStop, ariaLabel, layout, showText } = props;
  const t = TONES[tone];
  const { rect, hit } = view;
  const look = selected ? t.selected : journeyTarget ? t.target : t.pod[status];
  const pattern = status === "RESERVED" ? patternIds.reserved : status === "CLEANING" ? patternIds.cleaning : null;
  const [letter, num] = view.label.split("-") as [string, string];
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.min(rect.w, rect.h) * 0.14;
  // On a hatched or dotted pod the number gets a halo in the pod color so the pattern never runs through it.
  const haloed = Boolean(pattern) && !selected;
  const numHalo = haloed ? t.numHalo : "";
  const haloProps = haloed ? { strokeWidth: 0.32, strokeLinejoin: "round" as const, paintOrder: "stroke" } : {};

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onActivate?.(view.label, "keyboard");
    } else if (NAV_KEYS.has(e.key)) {
      e.preventDefault();
      props.onNav?.(view.label, e.key as NavKey);
    } else if (e.key === "Escape") {
      props.onEscape?.();
    }
  };

  const a11y = interactive
    ? {
        role: "button",
        tabIndex: tabStop ? 0 : -1,
        "aria-label": ariaLabel,
        "aria-pressed": pickMode ? selected : undefined,
        "aria-disabled": pickMode && !selectable ? true : undefined,
        onClick: () => props.onActivate?.(view.label, "pointer"),
        onKeyDown,
        onFocus: () => props.onFocusPod?.(view.label),
      }
    : { "aria-hidden": true as const };

  return (
    <g
      data-pod={view.label}
      data-label={view.label}
      data-status={status === "NONE" || status === "UNKNOWN" ? undefined : status}
      data-duo-highlight={duoHighlight ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      className={`group outline-none ${interactive ? (pickMode && !selectable ? "cursor-default" : "cursor-pointer") : ""} ${dimmed ? "opacity-40" : ""} transition-opacity duration-200 motion-reduce:transition-none`}
      {...a11y}
    >
      <rect x={hit.x} y={hit.y} width={hit.w} height={hit.h} fill="transparent" />
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={radius} className={look.body} strokeWidth={0.12} />
      {pattern && !selected ? <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={radius} fill={`url(#${pattern})`} /> : null}
      <line x1={view.hatch[0][0]} y1={view.hatch[0][1]} x2={view.hatch[1][0]} y2={view.hatch[1][1]} className={t.hatchEdge} strokeWidth={0.28} strokeLinecap="round" />
      {selected ? <rect x={rect.x - 0.3} y={rect.y - 0.3} width={rect.w + 0.6} height={rect.h + 0.6} rx={radius + 0.2} fill="none" className={t.ring} strokeWidth={0.22} /> : null}
      {showText ? (
        layout === "portrait" ? (
          <text x={cx} y={cy} textAnchor="middle" className={`${look.num} ${numHalo} font-body tabular-nums`} fontWeight={600} {...haloProps}>
            <tspan x={cx} y={cy - 0.55} fontSize={0.85} opacity={0.75}>
              {letter}
            </tspan>
            <tspan x={cx} y={cy + 0.85} fontSize={1.25}>
              {num}
            </tspan>
          </text>
        ) : (
          <text x={cx} y={cy + 0.4} textAnchor="middle" fontSize={1.05} className={`${look.num} ${numHalo} font-body tabular-nums`} fontWeight={600} {...haloProps}>
            {view.label}
          </text>
        )
      ) : null}
      {interactive ? (
        <rect
          x={rect.x - 0.45}
          y={rect.y - 0.45}
          width={rect.w + 0.9}
          height={rect.h + 0.9}
          rx={radius + 0.3}
          fill="none"
          className={`${t.focus} opacity-0 group-focus-visible:opacity-100`}
          strokeWidth={0.32}
        />
      ) : null}
    </g>
  );
}

/** Memoized: a pinch or a status poll re-renders the map, not all 75 pods. */
export const PodCell = memo(PodCellImpl);
