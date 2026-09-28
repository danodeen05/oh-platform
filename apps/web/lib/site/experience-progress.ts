/**
 * Task D2: where each step of a visit puts the journey on the comb floor plan.
 *
 * The map (CombMap in journey mode) draws the guest and the bowl from one
 * number, the journey progress 0..1 of `@oh/floor-plan` (`journeyMarkers`
 * and `PHASES`). Each step is a progress on that same timeline, so the dots
 * always sit on the layout's real paths:
 *
 *   arrive  0              the guest at the entry door, the bowl not yet plated
 *   order   (computed)     the guest at the middle lobby kiosk
 *   walk    end of guestIn the guest at the pod (seated)
 *   settle  mid bowl       the bowl halfway down the staff corridor
 *   taste   after bowl     the bowl at the pod's hatch, the guest still seated
 *   leave   1              the guest out the exit, the bowl cleared
 *
 * Computed on the server (Steps.tsx) and handed to the map as plain numbers.
 * Pure: no React, no DOM. Tested in __tests__/experience.test.ts.
 */
import { buildLayout, LOCATION_LAYOUTS, PHASES, type Layout } from "@oh/floor-plan";
import { EXPERIENCE_LAYOUT, type ExperienceStep } from "./experience";

type Point = readonly [number, number];

function pathLength(path: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1] as Point;
    const b = path[i] as Point;
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

/**
 * The journey progress at which the guest dot stands at the kiosk: the
 * guest path's second point (entry door, kiosk, lobby opening, ...), as a
 * share of the path's length inside the guest-in phase.
 */
export function kioskProgress(layout: Layout): number {
  const path = layout.guestPath as readonly Point[];
  const total = pathLength(path);
  const toKiosk = pathLength(path.slice(0, 2));
  const [a, b] = PHASES.guestIn;
  return a + (total === 0 ? 0 : toKiosk / total) * (b - a);
}

/** Journey progress (0..1) for each step, on a layout's own paths. */
export function stepProgress(layout: Layout = buildLayout(LOCATION_LAYOUTS[EXPERIENCE_LAYOUT])): Record<ExperienceStep, number> {
  const [bowlStart, bowlEnd] = PHASES.bowl;
  const [, guestSeated] = PHASES.guestIn;
  const [guestOut] = PHASES.guestOut;
  return {
    arrive: 0,
    order: kioskProgress(layout),
    walk: guestSeated,
    settle: (bowlStart + bowlEnd) / 2,
    // Delivered, and still seated: halfway between the bowl at the hatch and the guest getting up.
    taste: (bowlEnd + guestOut) / 2,
    leave: 1,
  };
}
