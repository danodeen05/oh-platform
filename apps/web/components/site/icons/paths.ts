/**
 * Path data for the in-house icon set (Task C2). No icon library: every
 * shape here is drawn by hand on a 24x24 grid, stroke 1.5, round caps and
 * joins, so they read as one calligraphy-brush family rather than a mix of
 * generic outline styles.
 *
 * Each entry has:
 * - `strokes`: the main stroked paths (`stroke="currentColor"`,
 *   `fill="none"`, `strokeWidth={1.5}`, round linecap/linejoin).
 * - `taper`: one small filled sliver (`fill="currentColor"`) laid over one
 *   end of a main stroke, narrowing it to a point -- the "tapered end made
 *   from a second thin path" the brief calls for, echoing the brush tip on
 *   the real chopstick/tier art (see apps/web/public/tiers/chopstick.png).
 */

export type IconName =
  | "bowl"
  | "chopsticks"
  | "pod"
  | "hatch"
  | "clock"
  | "pin"
  | "chevron"
  | "close"
  | "menu"
  | "user"
  | "gift"
  | "store"
  | "spark"
  | "flame"
  | "leaf"
  | "wheat-off"
  | "seal"
  | "check"
  | "alert"
  | "share"
  | "wallet"
  | "arrow";

export interface IconDef {
  strokes: string[];
  /** A small filled sliver that tapers one stroke's end to a point. */
  taper: string;
}

export const ICON_PATHS: Record<IconName, IconDef> = {
  bowl: {
    strokes: ["M3.5 10.5h17", "M4.5 10.5c0 4.7 3.6 8.5 7.5 8.5s7.5-3.8 7.5-8.5"],
    taper: "M20.5 10.5l1.3-.55-.1 1.15z",
  },
  chopsticks: {
    strokes: ["M6 20L17.5 5.2", "M9 20L19.5 7.4"],
    taper: "M17.5 5.2l.9-1.15.55 1.4z",
  },
  pod: {
    strokes: ["M7 9V6.5a5 5 0 0 1 10 0V9", "M3.5 9h17v9a3 3 0 0 1-3 3H6.5a3 3 0 0 1-3-3z"],
    taper: "M17 6.5l1.3-.4.15 1.25z",
  },
  hatch: {
    strokes: ["M3.5 5.5h17v6h-17z", "M3.5 19h17", "M7 11.5V19", "M17 11.5V19"],
    taper: "M20.5 5.5l1.25-.5-.05 1.2z",
  },
  clock: {
    strokes: ["M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z", "M12 7v5.2l3.6 2"],
    taper: "M15.6 14.2l1.25.35-.85.95z",
  },
  pin: {
    strokes: [
      "M12 21c0-2.2-6.5-8.9-6.5-13A6.5 6.5 0 0 1 18.5 8c0 4.1-6.5 10.8-6.5 13z",
      "M12 10.7a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z",
    ],
    taper: "M12 21l-.55 1.25-.55-1.15z",
  },
  chevron: {
    strokes: ["M9 5.5L15.2 12 9 18.5"],
    taper: "M15.2 12l.35-1.3 1 .85z",
  },
  close: {
    strokes: ["M5.5 5.5l13 13", "M18.5 5.5l-13 13"],
    taper: "M18.5 5.5l1.3-.4-.15 1.25z",
  },
  menu: {
    strokes: ["M4 7h16", "M4 12h16", "M4 17h11.5"],
    taper: "M15.5 17l1.35.15-.65 1.15z",
  },
  user: {
    strokes: ["M12 12.2a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4z", "M4.2 20c0-4.2 3.9-6.5 7.8-6.5s7.8 2.3 7.8 6.5"],
    taper: "M19.8 20l1.4.1-.7 1.15z",
  },
  gift: {
    strokes: [
      "M3.5 9.5h17v4h-17z",
      "M4.5 13.5h15v6.5h-15z",
      "M12 9.5v10.5",
      "M8.2 9.5c-1.7 0-3-1.2-3-2.5s1.2-2.5 2.7-2.5c1.8 0 3.6 2.2 4.1 5",
      "M15.8 9.5c1.7 0 3-1.2 3-2.5s-1.2-2.5-2.7-2.5c-1.8 0-3.6 2.2-4.1 5",
    ],
    taper: "M20.5 9.5l1.3-.5v1.3z",
  },
  store: {
    strokes: ["M4 9.5l1.2-5.5h13.6l1.2 5.5", "M4.5 9.5v10h15v-10", "M9.5 19.5v-6h5v6"],
    taper: "M19.9 4l1.15.65-1.05.75z",
  },
  spark: {
    strokes: ["M12 3.5l1.7 6.8 6.8 1.7-6.8 1.7-1.7 6.8-1.7-6.8-6.8-1.7 6.8-1.7z"],
    taper: "M12 3.5l.75-1.15.55 1.3z",
  },
  flame: {
    strokes: [
      "M12 21.5c-3.6 0-6.2-2.6-6.2-6 0-3.4 2.4-5.2 2.7-8.6 1.6 1.6 2.6 3.3 2.7 5 1-1.6.9-3.6-.1-6 3.6 2.4 5.4 5.9 5.4 9.6 0 3.4-1.9 6-4.5 6z",
    ],
    taper: "M12 2.9l1.05.85-1.2.6z",
  },
  leaf: {
    strokes: ["M4.5 19.5c7 0 12.5-5.4 12.5-12.4 0-.9-.1-1.8-.3-2.6-6.3.8-12.2 5.3-12.2 12.4 0 .9 0 1.8 0 2.6z", "M6.3 18c3.4-3.6 6.8-7.2 8.7-11.4"],
    taper: "M17 4.5l1.35.1-.75 1.1z",
  },
  "wheat-off": {
    strokes: [
      "M12 20V4.5",
      "M12 6.5l-2.6-1.7",
      "M12 6.5l2.6-1.7",
      "M12 10.5l-2.6-1.7",
      "M12 10.5l2.6-1.7",
      "M12 14.5l-2.6-1.7",
      "M12 14.5l2.6-1.7",
      "M4 4.5l16 16",
    ],
    taper: "M20 20.5l1.2.65-1.2.6z",
  },
  seal: {
    strokes: ["M5.5 5.5h13v13h-13z", "M9 12h6", "M12 9v6"],
    taper: "M18.5 5.5l1.3-.5v1.3z",
  },
  check: {
    strokes: ["M5 12.8l4.2 4.2L19 7.2"],
    taper: "M19 7.2l.4-1.3 1 .9z",
  },
  alert: {
    strokes: ["M12 3.2l9.3 16.3H2.7z", "M12 10v4.3", "M12 17.2v.01"],
    taper: "M21.3 19.5l.55 1.25-1.3-.2z",
  },
  share: {
    strokes: [
      "M6.2 14.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z",
      "M17.8 7.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z",
      "M17.8 21.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z",
      "M8.1 11.1l7.8-4.8",
      "M8.1 13.1l7.8 4.8",
    ],
    taper: "M15.9 6.3l1.35-.2-.4 1.3z",
  },
  wallet: {
    strokes: ["M3.5 7.5h17v11h-17z", "M3.5 7.5l3-3h9l3 3", "M15.5 12.5h3.5v3h-3.5z"],
    taper: "M20.5 7.5l1.3-.35-.1 1.3z",
  },
  arrow: {
    strokes: ["M4 12h13.2", "M12.5 6.5L18.5 12l-6 5.5"],
    taper: "M18.5 12l-.15 1.35-1.1-.75z",
  },
};
