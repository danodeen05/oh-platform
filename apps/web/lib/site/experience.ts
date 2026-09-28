/**
 * Task D2: the experience page's six steps, and the timing of the journey
 * map's dots between them.
 *
 * Client-safe and tiny on purpose: the map island imports this, so it must
 * not pull `@oh/floor-plan` (and the plan model behind it) into the page's
 * first-load JS. The geometry side, where each step puts the dots, is
 * `experience-progress.ts`, used on the server.
 */
export const EXPERIENCE_STEPS = ["arrive", "order", "walk", "settle", "taste", "leave"] as const;
export type ExperienceStep = (typeof EXPERIENCE_STEPS)[number];

/** The map on this page is City Creek's comb (75 pods, not mirrored): `LOCATION_LAYOUTS["comb-75"]`. */
export const EXPERIENCE_LAYOUT = "comb-75" as const;

/** How long the dots take to travel between two progresses: longer trips take longer, within bounds. */
export function tweenMs(from: number, to: number): number {
  return Math.round(Math.min(1800, 650 + Math.abs(to - from) * 1600));
}

/** Ease in and out (cubic), 0..1 to 0..1. */
export function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}
