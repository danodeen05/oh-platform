import { Color } from "three";
import type { Territory } from "../layout";

/** Design tokens as three.js colors. Floors are the page surfaces warmed by each territory's accent. */
export const P = {
  bg: "#1C1B19",
  edge: "#F2EDE4",
  edgeSoft: "#9A9188",
  floor: { guest: "#3F3A2C", staff: "#48302A" } satisfies Record<Territory, string>,
  floorRestroom: "#33352E",
  floorStore: "#3E3129",
  wall: "#3A3632",
  wallTop: "#4A4540",
  podShell: "#2A2724",
  podSeat: "#1C1B19",
  hatch: "#C1502E",
  hatchOpen: "#E07A5A",
  duo: "#C9A227",
  kiosk: "#C9A227",
  equipment: "#3A3632",
  pass: "#8C5A3C",
  shelf: "#8C5A3C",
  door: "#C9A227",
  guest: "#C9A227",
  runner: "#C1502E",
  bowl: "#F2EDE4",
  active: "#E07A5A",
} as const;

const BG = new Color(P.bg);
/** Pull a color most of the way to the background, for the territory focus. */
export function dim(hex: string, amount = 0.75): Color {
  return new Color(hex).lerp(BG, amount);
}
export const color = (hex: string): Color => new Color(hex);
