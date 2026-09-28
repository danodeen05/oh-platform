"use client";

/**
 * "See it in 3D" on a location page (Task D4). The business plan's isometric
 * scene, drawn with this location's comb layout (City Creek's 75 pods, or
 * University Place's 70, mirrored). LocationFloor loads this module with
 * next/dynamic only after the tap, and FloorPlan3D in turn lazy-loads the
 * three.js scene, so no three.js code ships with the page.
 */
import { useMemo } from "react";
import { buildLayout, LOCATION_LAYOUTS, type LayerKey } from "@oh/floor-plan";
import { FloorPlan3D } from "@/components/plan/modules/floor-plan/three/FloorPlan3D";
import type { IsoLabels } from "@/components/plan/modules/floor-plan/three/types";
import type { CombLayoutKey } from "./useSeats";

const LAYERS: Record<LayerKey, boolean> = {
  pods: true,
  corridors: true,
  aisles: true,
  kitchen: true,
  boh: true,
  restrooms: true,
  entry: true,
  store: true,
  flow: false,
  dimensions: false,
};

const noop = (): void => {};

export interface LocationFloor3DProps {
  layoutKey: CombLayoutKey;
  labels: IsoLabels;
  aria: string;
  reduce: boolean;
  onUnavailable: () => void;
}

export default function LocationFloor3D({ layoutKey, labels, aria, reduce, onUnavailable }: LocationFloor3DProps) {
  const layout = useMemo(() => buildLayout(LOCATION_LAYOUTS[layoutKey]), [layoutKey]);
  return (
    <FloorPlan3D
      layout={layout}
      layers={LAYERS}
      progress={0}
      guest={null}
      bowl={null}
      activePod={null}
      reduce={reduce}
      preset="overview"
      focus="all"
      labels={labels}
      canvasAria={aria}
      onPodEnter={noop}
      onPodLeave={noop}
      onPodActivate={noop}
      onUnavailable={onUnavailable}
    />
  );
}
