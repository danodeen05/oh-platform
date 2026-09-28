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
 *   walk    (computed)     the guest in the aisle, at the pod's door
 *   settle  end of guestIn the guest seated in the pod, checked in
 *   status  "feed"         still seated; the bowl appears in the kitchen
 *                          (PREPPING on the phone), the Live Kitchen Feed
 *                          narrating it
 *   panel   end of bowl    the bowl down the corridor to the pod's hatch
 *   taste   after bowl     the bowl at the hatch, the guest still seated
 *   leave   1              the guest out the exit, the bowl cleared
 *
 * The bowl dot shows from the status step on (JourneyMap passes
 * `bowlFrom = status`): the kitchen fires a bowl once its guest checks in,
 * which is when the phone goes from QUEUED to PREPPING. Taste moves no dot
 * on purpose: nothing on the floor moves while the guest eats.
 *
 * Computed on the server (Steps.tsx) and handed to the map as plain numbers.
 * Pure: no React, no DOM. Tested in __tests__/experience.test.ts.
 */
import { buildLayout, JOURNEY_STEPS, LOCATION_LAYOUTS, PHASES, type Layout } from "@oh/floor-plan";
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
 * The journey progress at which the guest dot stands on the guest path's
 * point `index` (0 the entry door, 1 the kiosk, ..., last the seat), as a
 * share of the path's length inside the guest-in phase.
 */
export function guestPointProgress(layout: Layout, index: number): number {
  const path = layout.guestPath as readonly Point[];
  const total = pathLength(path);
  const upTo = pathLength(path.slice(0, index + 1));
  const [a, b] = PHASES.guestIn;
  return a + (total === 0 ? 0 : upTo / total) * (b - a);
}

/** The guest dot at the middle lobby kiosk: the guest path's second point. */
export function kioskProgress(layout: Layout): number {
  return guestPointProgress(layout, 1);
}

/** The guest dot in the aisle at the pod's door: the last point before the seat. */
export function podDoorProgress(layout: Layout): number {
  return guestPointProgress(layout, layout.guestPath.length - 2);
}

/** The journey timeline's own moment for the Live Kitchen Feed: seated, the bowl still in the kitchen. */
function feedProgress(): number {
  return JOURNEY_STEPS.find((s) => s.key === "feed")?.at ?? (PHASES.guestIn[1] + PHASES.bowl[0]) / 2;
}

/** Journey progress (0..1) for each step, on a layout's own paths. */
export function stepProgress(layout: Layout = buildLayout(LOCATION_LAYOUTS[EXPERIENCE_LAYOUT])): Record<ExperienceStep, number> {
  const [, bowlEnd] = PHASES.bowl;
  const [, guestSeated] = PHASES.guestIn;
  const [guestOut] = PHASES.guestOut;
  return {
    arrive: 0,
    order: kioskProgress(layout),
    walk: podDoorProgress(layout),
    settle: guestSeated,
    status: feedProgress(),
    panel: bowlEnd,
    // Delivered, and still seated: halfway between the bowl at the hatch and the guest getting up.
    taste: (bowlEnd + guestOut) / 2,
    leave: 1,
  };
}
