"use client";

import { useEffect, useState } from "react";
import { geoAlbersUsa, geoMercator, geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { MapView } from "./markets";

export interface MapGeometry {
  projection: GeoProjection;
  /** Filled land shapes. */
  shapes: readonly string[];
  /** Internal borders. */
  borders: string;
  /** Emphasized outline (Utah, the nation, or nothing). */
  outline: string | null;
}

export const MAP_W = 800;
export const MAP_H = 520;
const PAD = 24;

/**
 * Lazy-loads the TopoJSON for a view (spec 7.3) and returns projected SVG
 * path strings. us-atlas states for Utah and the US, world-atlas countries
 * for the world.
 */
export function useMapGeometry(view: MapView): MapGeometry | null {
  const [geo, setGeo] = useState<Record<MapView, MapGeometry | null>>({ utah: null, us: null, world: null });
  useEffect(() => {
    if (geo[view]) return;
    let cancelled = false;
    (async () => {
      let next: MapGeometry;
      if (view === "world") {
        const topo = (await import("world-atlas/countries-110m.json")).default as unknown as Topology;
        const countries = feature(topo, topo.objects.countries as never) as unknown as GeoPermissibleObjects & { features: GeoPermissibleObjects[] };
        const projection = geoNaturalEarth1().fitExtent([[PAD, PAD], [MAP_W - PAD, MAP_H - PAD]], countries);
        const path = geoPath(projection);
        next = { projection, shapes: countries.features.map((f) => path(f) ?? ""), borders: path(mesh(topo, topo.objects.countries as never, (a, b) => a !== b) as GeoPermissibleObjects) ?? "", outline: null };
      } else {
        const topo = (await import("us-atlas/states-10m.json")).default as unknown as Topology;
        const states = feature(topo, topo.objects.states as never) as unknown as { features: (GeoPermissibleObjects & { id?: string })[] };
        const utah = states.features.find((f) => f.id === "49");
        const nation = feature(topo, topo.objects.nation as never) as unknown as GeoPermissibleObjects;
        const projection = view === "utah" && utah ? geoMercator().fitExtent([[PAD * 3, PAD], [MAP_W - PAD * 3, MAP_H - PAD]], utah) : geoAlbersUsa().fitExtent([[PAD, PAD], [MAP_W - PAD, MAP_H - PAD]], nation);
        const path = geoPath(projection);
        next = {
          projection,
          shapes: states.features.map((f) => path(f) ?? ""),
          borders: path(mesh(topo, topo.objects.states as never, (a, b) => a !== b) as GeoPermissibleObjects) ?? "",
          outline: view === "utah" && utah ? path(utah) : path(nation),
        };
      }
      if (!cancelled) setGeo((g) => ({ ...g, [view]: next }));
    })().catch(() => {
      /* keep the counters usable even if the map fails to load */
    });
    return () => {
      cancelled = true;
    };
  }, [view, geo]);
  return geo[view];
}
