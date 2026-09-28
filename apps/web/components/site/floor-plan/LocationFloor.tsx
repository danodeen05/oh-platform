"use client";

/**
 * The live room on a location page (Task D4): the comb map in live mode,
 * fed every 15 s by `useSeats` (GET /locations/:id/seats, statuses only), the
 * live count of free pods, and "See it in 3D", which swaps in the three.js
 * model only when tapped.
 */
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { CombMapLabels } from "./CombMap";
import { useSeats, type CombLayoutKey } from "./useSeats";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { SITE_API_URL } from "@/lib/site/api";
import type { IsoLabels } from "@/components/plan/modules/floor-plan/three/types";

// Task G2b: the live map sits below the hero, so CombMap and the floor-plan
// geometry behind it (@oh/floor-plan, which reads the plan model: about
// 40 KB gzipped) load right after hydration instead of with the page. The
// placeholder is the map's own box (portrait under 768px), so nothing shifts.
const CombMap = dynamic(() => import("./CombMap").then((m) => m.CombMap), {
  ssr: false,
  loading: () => <div aria-hidden="true" data-location-map-placeholder className="aspect-[53/73] w-full rounded-2xl bg-oh-ink md:aspect-[73/53]" />,
});

const LocationFloor3D = dynamic(() => import("./LocationFloor3D"), {
  ssr: false,
  loading: () => null,
});

export interface LocationFloorText {
  loading: string;
  error: string;
  /** The message template, "{free} of {total} pods free". */
  podsFree: string;
  threeD: string;
  threeDHint: string;
  threeDClose: string;
  threeDUnavailable: string;
  threeDAria: string;
}

export interface LocationFloorProps {
  locationId: string;
  layoutKey: CombLayoutKey;
  labels: CombMapLabels;
  isoLabels: IsoLabels;
  text: LocationFloorText;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

export function LocationFloor({ locationId, layoutKey, labels, isoLabels, text }: LocationFloorProps) {
  const seats = useSeats(locationId, { apiBase: SITE_API_URL, refreshMs: 15_000 });
  const reduce = useReducedMotion();
  const [view, setView] = useState<"map" | "3d" | "no3d">("map");
  const onUnavailable = useCallback(() => setView("no3d"), []);
  const key = seats.layoutKey || layoutKey;
  const free = seats.seats.filter((s) => s.status === "AVAILABLE").length;
  const total = seats.seats.length;

  return (
    <div data-location-map-live className="flex flex-col gap-4">
      <p aria-live="polite" className="m-0 flex min-h-6 items-center gap-2 text-[15px] text-oh-cream">
        {seats.status === "error" && total === 0 ? (
          <span className="text-oh-mute">{text.error}</span>
        ) : total > 0 ? (
          <>
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-oh-olive-light" />
            <span data-pods-free={free}>{fill(text.podsFree, { free, total })}</span>
          </>
        ) : (
          <span className="text-oh-mute">{text.loading}</span>
        )}
      </p>

      <div data-location-map>
        <CombMap layoutKey={key} mode="live" labels={labels} seats={seats.seats} tone="night" />
      </div>

      {view === "3d" ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[28px] bg-oh-charcoal">
            <LocationFloor3D layoutKey={key} labels={isoLabels} aria={text.threeDAria} reduce={reduce} onUnavailable={onUnavailable} />
          </div>
          <button
            type="button"
            onClick={() => setView("map")}
            className={`inline-flex min-h-12 cursor-pointer items-center justify-center self-start rounded-full border border-oh-stone bg-transparent px-5 font-[inherit] text-[15px] font-semibold text-oh-cream hover:border-oh-mute ${FOCUS}`}
          >
            {text.threeDClose}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            data-location-3d
            disabled={view === "no3d"}
            onClick={() => setView("3d")}
            onPointerEnter={() => void import("./LocationFloor3D")}
            className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-oh-cream bg-transparent px-5 font-[inherit] text-[15px] font-semibold text-oh-cream hover:bg-oh-cream hover:text-oh-charcoal disabled:cursor-default disabled:border-oh-stone disabled:text-oh-mute disabled:hover:bg-transparent ${FOCUS}`}
          >
            <CubeGlyph />
            {text.threeD}
          </button>
          <p className="m-0 text-sm text-oh-mute">{view === "no3d" ? text.threeDUnavailable : text.threeDHint}</p>
        </div>
      )}
    </div>
  );
}

/** A filled isometric block in the house style (no icon library). */
function CubeGlyph() {
  return (
    <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" className="shrink-0 fill-current">
      <path d="M12 2.2 21 7v10l-9 4.8L3 17V7l9-4.8Zm0 2.3L5.6 7.9 12 11.3l6.4-3.4L12 4.5Zm-7 5.1v6.2l6 3.2v-6.2l-6-3.2Zm8 9.4 6-3.2V9.6l-6 3.2V19Z" />
    </svg>
  );
}
