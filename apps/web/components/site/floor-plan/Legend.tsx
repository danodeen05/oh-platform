"use client";

/**
 * CombMap key (Task D4a). Each swatch is drawn with the same fill and pattern
 * as the map itself, so the key can never drift from what it explains.
 */
import { useId } from "react";
import { StatusPatterns, TONES, type Tone } from "./PodCell";

export interface LegendLabels {
  title: string;
  available: string;
  reserved: string;
  occupied: string;
  cleaning: string;
  duo: string;
  selected: string;
  hatch: string;
}

type Item = "available" | "reserved" | "occupied" | "cleaning" | "duo" | "selected" | "hatch";

function Swatch({ item, tone, ids, duoLit }: { item: Item; tone: Tone; ids: { reserved: string; cleaning: string }; duoLit: boolean }) {
  const t = TONES[tone];
  // A pod seen from above, 4.5 ft by 2.35 ft, drawn at 4 px per foot-ish.
  const body =
    item === "selected"
      ? t.selected.body
      : item === "reserved"
        ? t.pod.RESERVED.body
        : item === "occupied"
          ? t.pod.OCCUPIED.body
          : item === "cleaning"
            ? t.pod.CLEANING.body
            : t.pod.AVAILABLE.body;
  const pattern = item === "reserved" ? ids.reserved : item === "cleaning" ? ids.cleaning : null;
  return (
    <svg viewBox="-0.3 -0.3 5.1 2.95" width={34} height={20} aria-hidden="true" className="shrink-0">
      <rect x={0} y={0} width={4.5} height={2.35} rx={0.33} className={body} strokeWidth={0.12} />
      {pattern ? <rect x={0} y={0} width={4.5} height={2.35} rx={0.33} fill={`url(#${pattern})`} /> : null}
      {item === "duo" ? (
        <rect x={-0.2} y={-0.2} width={4.9} height={2.75} rx={0.45} fill="none" className={duoLit ? t.duoLit : t.duo} strokeWidth={duoLit ? 0.3 : 0.18} strokeDasharray={duoLit ? undefined : "0.4 0.35"} />
      ) : null}
      {item === "selected" ? <rect x={-0.2} y={-0.2} width={4.9} height={2.75} rx={0.45} fill="none" className={t.ring} strokeWidth={0.18} /> : null}
      {item === "hatch" ? <line x1={4.5} y1={0.1} x2={4.5} y2={2.25} className={t.hatchEdge} strokeWidth={0.3} strokeLinecap="round" /> : null}
    </svg>
  );
}

/** `duoLit` matches the map: a solid gold outline for a party of two, dashed otherwise. */
export function Legend({ labels, tone = "night", items, duoLit = false, className }: { labels: LegendLabels; tone?: Tone; items: readonly Item[]; duoLit?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = { reserved: `cm-legend-${uid}-reserved`, cleaning: `cm-legend-${uid}-cleaning` };
  const text = tone === "night" ? "text-oh-cream" : "text-oh-charcoal";
  const muted = tone === "night" ? "text-oh-mute" : "text-oh-stone";
  return (
    <div className={className}>
      {/* One set of pattern defs for every swatch. Zero-size rather than display:none, which would stop the patterns painting. */}
      <svg width={0} height={0} aria-hidden="true" className="absolute">
        <StatusPatterns ids={ids} tone={tone} />
      </svg>
      <p className={`m-0 mb-2 text-base font-semibold uppercase tracking-[0.14em] ${muted}`}>{labels.title}</p>
      <ul className={`m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-base ${text}`}>
        {items.map((item) => (
          <li key={item} className="flex min-w-0 items-center gap-2">
            <Swatch item={item} tone={tone} ids={ids} duoLit={duoLit} />
            <span className="min-w-0 break-words">{labels[item]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
