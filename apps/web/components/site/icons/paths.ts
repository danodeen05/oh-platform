/**
 * Path data for the in-house icon set (Task C2, Fix round 1). Every icon is
 * built from FILLED, tapered brush-stroke outlines (see ./brush.ts) rather
 * than a uniform-width `stroke` -- that uniform-stroke look is exactly what
 * made the first pass read as a generic (Lucide/Feather-style) icon set,
 * which the brand rules ban. No icon here has a `stroke` or `stroke-width`
 * attribute anywhere; `Icon.tsx` only ever sets `fill`.
 *
 * Each entry's `paths` array holds one or more `d` strings, all filled with
 * `fill-rule="evenodd"` (which also lets a path double as a knockout hole,
 * e.g. the pin's center dot and the alert triangle's exclamation mark).
 */
import { brushStroke, circlePath, midPeakChain, ring, ringRect, roundedRectPath, taperChain, taperLine } from "./brush";

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
  | "arrow"
  | "chat"
  | "globe"
  | "mail";

export interface IconDef {
  /** One or more filled outline paths (fill-rule evenodd), no stroke. */
  paths: string[];
}

export const ICON_PATHS: Record<IconName, IconDef> = {
  bowl: {
    paths: [
      taperLine({ x: 3.3, y: 10.6 }, { x: 20.7, y: 10.6 }, 1.7, 0.4, { capStart: true }),
      midPeakChain(
        [
          { kind: "cubic", p0: { x: 4.6, y: 11 }, p1: { x: 4.6, y: 16.5 }, p2: { x: 7.2, y: 19.4 }, p3: { x: 12, y: 19.4 } },
          { kind: "cubic", p0: { x: 12, y: 19.4 }, p1: { x: 16.8, y: 19.4 }, p2: { x: 19.4, y: 16.5 }, p3: { x: 19.4, y: 11 } },
        ],
        1.7,
        0.35,
      ),
    ],
  },

  chopsticks: {
    paths: [
      taperLine({ x: 6.2, y: 20 }, { x: 17.6, y: 5.3 }, 1.7, 0.35, { capStart: true }),
      taperLine({ x: 9.2, y: 20 }, { x: 19.6, y: 7.5 }, 1.7, 0.35, { capStart: true }),
    ],
  },

  // A two-seat booth capsule with a curved center divider -- not a padlock
  // (an early pass with a canopy arc + rect base read as exactly that).
  pod: {
    paths: [
      ringRect(4, 4.5, 16, 15, 5, 1.3),
      brushStroke(
        [{ kind: "cubic", p0: { x: 12, y: 5.6 }, p1: { x: 10, y: 10 }, p2: { x: 14, y: 14 }, p3: { x: 12, y: 18.4 } }],
        (t) => 0.35 + Math.sin(Math.PI * t) * 0.6,
      ),
    ],
  },

  hatch: {
    paths: [
      ringRect(3.5, 5.5, 17, 6, 1, 1.3),
      taperLine({ x: 3.3, y: 19 }, { x: 20.7, y: 19 }, 1.6, 0.4, { capStart: true }),
      taperLine({ x: 7, y: 11.3 }, { x: 7, y: 19 }, 0.4, 1.1),
      taperLine({ x: 17, y: 11.3 }, { x: 17, y: 19 }, 0.4, 1.1),
    ],
  },

  clock: {
    paths: [
      ring(12, 12, 8.4, 1.4),
      taperChain(
        [
          { kind: "line", a: { x: 12, y: 12 }, b: { x: 12, y: 7.3 } },
          { kind: "line", a: { x: 12, y: 7.3 }, b: { x: 15.6, y: 9.6 } },
        ],
        1.5,
        0.35,
        { capStart: true },
      ),
    ],
  },

  pin: {
    paths: [
      // Solid silhouette (a pin is a mark, not an outline) with the hole
      // knocked out via fill-rule evenodd -- distinct from an outlined
      // teardrop-plus-stroked-circle pin.
      "M12 21.3 C12 21.3 5.4 13.6 5.4 8.7 C5.4 4.9 8.4 2 12 2 C15.6 2 18.6 4.9 18.6 8.7 C18.6 13.6 12 21.3 12 21.3 Z " +
        circlePath(12, 8.7, 2.3),
    ],
  },

  chevron: {
    paths: [
      midPeakChain(
        [
          { kind: "line", a: { x: 9.2, y: 5.7 }, b: { x: 15.3, y: 12 } },
          { kind: "line", a: { x: 15.3, y: 12 }, b: { x: 9.2, y: 18.3 } },
        ],
        1.7,
        0.3,
      ),
    ],
  },

  close: {
    paths: [
      taperLine({ x: 5.5, y: 5.5 }, { x: 18.5, y: 18.5 }, 1.7, 0.35, { capStart: true }),
      taperLine({ x: 18.5, y: 5.5 }, { x: 5.5, y: 18.5 }, 1.7, 0.35, { capStart: true }),
    ],
  },

  menu: {
    paths: [
      taperLine({ x: 4, y: 7 }, { x: 18, y: 7 }, 1.6, 0.4, { capStart: true }),
      taperLine({ x: 4, y: 12 }, { x: 20, y: 12 }, 1.6, 0.4, { capStart: true }),
      taperLine({ x: 4, y: 17 }, { x: 14, y: 17 }, 1.6, 0.4, { capStart: true }),
    ],
  },

  user: {
    paths: [
      ring(12, 8, 4.2, 1.4),
      midPeakChain(
        [
          { kind: "cubic", p0: { x: 4.2, y: 20 }, p1: { x: 4.2, y: 16.5 }, p2: { x: 7.2, y: 13.5 }, p3: { x: 12, y: 13.5 } },
          { kind: "cubic", p0: { x: 12, y: 13.5 }, p1: { x: 16.8, y: 13.5 }, p2: { x: 19.8, y: 16.5 }, p3: { x: 19.8, y: 20 } },
        ],
        1.6,
        0.35,
      ),
    ],
  },

  gift: {
    paths: [
      ringRect(4.5, 13, 15, 7, 1, 1.3),
      ringRect(3.3, 9.3, 17.4, 4, 1, 1.3),
      taperLine({ x: 12, y: 9.3 }, { x: 12, y: 20 }, 1.4, 0.6, { capStart: true }),
      brushStroke(
        [{ kind: "cubic", p0: { x: 12, y: 9.3 }, p1: { x: 9, y: 9.3 }, p2: { x: 6.5, y: 7 }, p3: { x: 8, y: 4.8 } }],
        (t) => 1.4 - t * 1.1,
        { capStart: true },
      ),
      brushStroke(
        [{ kind: "cubic", p0: { x: 12, y: 9.3 }, p1: { x: 15, y: 9.3 }, p2: { x: 17.5, y: 7 }, p3: { x: 16, y: 4.8 } }],
        (t) => 1.4 - t * 1.1,
        { capStart: true },
      ),
    ],
  },

  store: {
    paths: [
      midPeakChain(
        [
          { kind: "line", a: { x: 4, y: 9.5 }, b: { x: 5.2, y: 4 } },
          { kind: "line", a: { x: 5.2, y: 4 }, b: { x: 18.8, y: 4 } },
          { kind: "line", a: { x: 18.8, y: 4 }, b: { x: 20, y: 9.5 } },
        ],
        1.5,
        0.35,
      ),
      ringRect(4.5, 9.5, 15, 10, 0.5, 1.3),
      midPeakChain(
        [
          { kind: "line", a: { x: 9.5, y: 19.5 }, b: { x: 9.5, y: 13.5 } },
          { kind: "line", a: { x: 9.5, y: 13.5 }, b: { x: 14.5, y: 13.5 } },
          { kind: "line", a: { x: 14.5, y: 13.5 }, b: { x: 14.5, y: 19.5 } },
        ],
        1.3,
        0.4,
      ),
    ],
  },

  // A concave 4-point pinwheel sparkle -- solid, asymmetric curve handles so
  // it doesn't read as a generic straight-edged "sparkles" glyph.
  spark: {
    paths: ["M12 2.5 C13 8 16 11 21.5 12 C16 13 13 16 12 21.5 C11 16 8 13 2.5 12 C8 11 11 8 12 2.5 Z"],
  },

  flame: {
    paths: [
      "M12 21.6c-3.7 0-6.4-2.7-6.4-6.1 0-3.5 2.5-5.3 2.8-8.8 1.6 1.6 2.7 3.3 2.8 5.1 1-1.6 0.9-3.6-0.1-6.1 3.7 2.4 5.5 6 5.5 9.8 0 3.5-1.9 6.1-4.6 6.1z",
    ],
  },

  leaf: {
    paths: [
      "M4.4 19.6c7.2 0 12.9-5.6 12.9-12.8 0-0.9-0.1-1.9-0.3-2.7-6.5 0.8-12.6 5.5-12.6 12.8 0 0.9 0 1.9 0 2.7z",
      taperLine({ x: 6.3, y: 18 }, { x: 15, y: 6.6 }, 1, 0.25, { capStart: true }),
    ],
  },

  "wheat-off": {
    paths: [
      taperLine({ x: 12, y: 20 }, { x: 12, y: 4.3 }, 1.3, 0.3, { capStart: true }),
      taperLine({ x: 12, y: 6.3 }, { x: 9.2, y: 4.4 }, 0.9, 0.2),
      taperLine({ x: 12, y: 6.3 }, { x: 14.8, y: 4.4 }, 0.9, 0.2),
      taperLine({ x: 12, y: 10.3 }, { x: 9.2, y: 8.4 }, 0.9, 0.2),
      taperLine({ x: 12, y: 10.3 }, { x: 14.8, y: 8.4 }, 0.9, 0.2),
      taperLine({ x: 12, y: 14.3 }, { x: 9.2, y: 12.4 }, 0.9, 0.2),
      taperLine({ x: 12, y: 14.3 }, { x: 14.8, y: 12.4 }, 0.9, 0.2),
      taperLine({ x: 4, y: 4.3 }, { x: 20, y: 20 }, 1.8, 1, { capStart: true }),
    ],
  },

  seal: {
    paths: [
      ringRect(5.5, 5.5, 13, 13, 1, 1.4),
      taperLine({ x: 9, y: 12 }, { x: 15, y: 12 }, 1.3, 0.4, { capStart: true }),
      taperLine({ x: 12, y: 9 }, { x: 12, y: 15 }, 1.3, 0.4, { capStart: true }),
    ],
  },

  check: {
    paths: [
      taperChain(
        [
          { kind: "line", a: { x: 5, y: 12.8 }, b: { x: 9.4, y: 17.2 } },
          { kind: "line", a: { x: 9.4, y: 17.2 }, b: { x: 19.2, y: 6.8 } },
        ],
        1.9,
        0.25,
        { capStart: true },
      ),
    ],
  },

  alert: {
    paths: [
      "M12 3.4 L21.6 20.2 L2.4 20.2 Z " +
        // Exclamation mark, knocked out of the solid triangle (evenodd).
        "M12 9 C12.6 9 13 9.4 12.9 10 L12.4 14.6 C12.35 15 11.65 15 11.6 14.6 L11.1 10 C11 9.4 11.4 9 12 9 Z " +
        circlePath(12, 17.1, 0.9),
    ],
  },

  share: {
    paths: [
      circlePath(6.2, 14.2, 1.9),
      circlePath(17.8, 7.2, 1.9),
      circlePath(17.8, 21.2, 1.9),
      taperLine({ x: 7.8, y: 13.2 }, { x: 16.2, y: 7.9 }, 1.3, 0.7),
      taperLine({ x: 7.8, y: 15.1 }, { x: 16.2, y: 20.4 }, 1.3, 0.7),
    ],
  },

  wallet: {
    paths: [
      ringRect(3.5, 8.5, 17, 10, 1.4, 1.3),
      midPeakChain(
        [
          { kind: "line", a: { x: 3.5, y: 8.5 }, b: { x: 6.5, y: 5.5 } },
          { kind: "line", a: { x: 6.5, y: 5.5 }, b: { x: 15.5, y: 5.5 } },
          { kind: "line", a: { x: 15.5, y: 5.5 }, b: { x: 18.5, y: 8.5 } },
        ],
        1.4,
        0.4,
      ),
      roundedRectPath(15, 11.5, 3.6, 3, 0.6),
    ],
  },

  arrow: {
    paths: [
      taperLine({ x: 4, y: 12 }, { x: 16.5, y: 12 }, 1.6, 0.5, { capStart: true }),
      taperLine({ x: 12.5, y: 6.5 }, { x: 18.5, y: 12 }, 0.3, 1.3),
      taperLine({ x: 12.5, y: 17.5 }, { x: 18.5, y: 12 }, 0.3, 1.3),
    ],
  },

  // Task C4 (shell): Chappy's speech bubble, with three ink dots. The tail is
  // a tapered stroke off the bubble's lower left, not a notched outline.
  chat: {
    paths: [
      ringRect(3.4, 4.2, 17.2, 12.2, 4.2, 1.4),
      taperLine({ x: 8.6, y: 16 }, { x: 5.6, y: 20.6 }, 1.5, 0.3, { capStart: true }),
      circlePath(8.3, 10.3, 1.05),
      circlePath(12, 10.3, 1.05),
      circlePath(15.7, 10.3, 1.05),
    ],
  },

  // Task C4 (shell): the language switch. A ring with a lens-shaped pair of
  // meridians (each a mid-peak brush stroke) and a tapered equator.
  globe: {
    paths: [
      ring(12, 12, 8.4, 1.4),
      midPeakChain(
        [{ kind: "cubic", p0: { x: 12, y: 4.2 }, p1: { x: 7.6, y: 7.6 }, p2: { x: 7.6, y: 16.4 }, p3: { x: 12, y: 19.8 } }],
        1.2,
        0.3,
      ),
      midPeakChain(
        [{ kind: "cubic", p0: { x: 12, y: 4.2 }, p1: { x: 16.4, y: 7.6 }, p2: { x: 16.4, y: 16.4 }, p3: { x: 12, y: 19.8 } }],
        1.2,
        0.3,
      ),
      taperLine({ x: 4.2, y: 12 }, { x: 19.8, y: 12 }, 1.2, 0.35, { capStart: true }),
    ],
  },

  // Task C4 (shell): contact. An envelope ring with a brush-stroke flap.
  mail: {
    paths: [
      ringRect(3.4, 5.4, 17.2, 13.2, 1.6, 1.3),
      midPeakChain(
        [
          { kind: "line", a: { x: 4.8, y: 7.2 }, b: { x: 12, y: 13 } },
          { kind: "line", a: { x: 12, y: 13 }, b: { x: 19.2, y: 7.2 } },
        ],
        1.5,
        0.35,
      ),
    ],
  },
};
