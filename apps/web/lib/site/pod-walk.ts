/**
 * The pod's walk from the entrance (Task D5), from the floor plan geometry.
 */
import { buildLayout, entryWalkDistance, LOCATION_LAYOUTS } from "@oh/floor-plan";

/** An average adult stride, for turning the walked path into steps. */
export const STEP_FT = 2.5;

/**
 * Steps from the entry door to a pod, along the real walking path the floor
 * plan geometry draws (entry, cross-aisle, guest aisle, pod: the same
 * `entryWalkDistance` that ranks "best pod"), divided by one stride. Null
 * when the layout or the pod is unknown: then the copy says "nearest the
 * entrance" and never shows a number.
 */
export function podWalkSteps(layoutKey: string | null | undefined, label: string | null | undefined): number | null {
  if (!layoutKey || !label || !(layoutKey in LOCATION_LAYOUTS)) return null;
  const layout = buildLayout(LOCATION_LAYOUTS[layoutKey as keyof typeof LOCATION_LAYOUTS]);
  const pod = layout.pods.find((p) => p.label === label);
  if (!pod) return null;
  const feet = entryWalkDistance(layout, pod);
  if (!Number.isFinite(feet) || feet <= 0) return null;
  return Math.max(1, Math.round(feet / STEP_FT));
}
