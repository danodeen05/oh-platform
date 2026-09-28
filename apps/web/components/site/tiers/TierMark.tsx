/**
 * Membership tier marks (Task C2): in-house SVG recreations of
 * apps/web/public/tiers/{chopstick,noodle-master,beef-boss}.png, redrawn as
 * vector line art rather than embedding the raster PNGs, so they scale
 * crisply and can be recolored per `tone` (the PNGs are flat black).
 *
 * Recreated (not pixel-traced) in the same stroked, tapered-end language as
 * the icon set in ../icons/paths.ts, so the tier badges and the rest of the
 * in-house icon system read as one family.
 */

export type Tier = "chopstick" | "noodle-master" | "beef-boss";
export type Tone = "cream" | "gold" | "ink";

export const TIERS: Tier[] = ["chopstick", "noodle-master", "beef-boss"];

export interface TierMarkProps {
  tier: Tier;
  /** Fill tone. Defaults to "ink". */
  tone?: Tone;
  /** Pixel size for both width and height. Defaults to 48. */
  size?: number;
  className?: string;
  /** Accessible name. Omit for a decorative mark (the default, aria-hidden). */
  title?: string;
}

const TONE_VALUES: Record<Tone, string> = {
  cream: "var(--color-oh-cream, #F2EDE4)",
  gold: "var(--color-oh-gold, #C9A227)",
  ink: "var(--color-oh-ink, #2A2724)",
};

interface TierDef {
  /** Stroked paths, drawn with the given color, round caps/joins. */
  strokes: Array<{ d: string; width: number }>;
  /** Small filled slivers that taper a stroke end to a point. */
  tapers: string[];
}

// Traced from apps/web/public/tiers/chopstick.png: two crossed chopsticks,
// each a thick round-capped stroke tapering to a fine point.
const CHOPSTICK: TierDef = {
  strokes: [
    { d: "M78,12 L28,62", width: 9 },
    { d: "M34,18 L58,86", width: 9 },
  ],
  tapers: ["M31.2,65.2 L24.8,58.8 L19.5,70.5 Z", "M62.2,84.4 L53.8,87.6 L60.8,93.5 Z"],
};

// Traced from apps/web/public/tiers/noodle-master.png: a bowl, rising
// noodle strands, and chopsticks lifting them.
const NOODLE_MASTER: TierDef = {
  strokes: [
    { d: "M15,55 L85,55", width: 8 },
    { d: "M18,55 C18,74 32,89 50,89 C68,89 82,74 82,55", width: 8 },
    { d: "M40,55 C38,42 45,36 42,22", width: 5 },
    { d: "M50,55 C48,40 54,35 50,17", width: 5 },
    { d: "M60,55 C62,42 55,36 60,22", width: 5 },
    { d: "M33,17 L57,6", width: 6 },
    { d: "M43,20 L67,7", width: 6 },
  ],
  tapers: ["M57.9,3.6 L59.3,8.7 L54.2,7 Z", "M67.9,4.6 L69.3,9.7 L64.2,8 Z"],
};

// Traced from apps/web/public/tiers/beef-boss.png: curled bull horns over a
// flowing double ribbon.
const BEEF_BOSS: TierDef = {
  strokes: [
    { d: "M22,36 C10,22 14,4 36,8 C29,20 34,32 50,39", width: 9 },
    { d: "M78,36 C90,22 86,4 64,8 C71,20 66,32 50,39", width: 9 },
    { d: "M50,39 C34,46 24,62 29,80 C32,91 43,97 54,94", width: 9 },
    { d: "M50,39 C56,52 61,66 55,82", width: 8 },
  ],
  tapers: ["M34.6,7.6 L37.4,8.4 L35.8,13 Z", "M65.4,7.6 L62.6,8.4 L64.2,13 Z"],
};

const TIER_DEFS: Record<Tier, TierDef> = {
  chopstick: CHOPSTICK,
  "noodle-master": NOODLE_MASTER,
  "beef-boss": BEEF_BOSS,
};

/**
 * Server-safe (no hooks): renders identically under `renderToString`, same
 * pattern as SitePicture and Icon.
 */
export function TierMark({ tier, tone = "ink", size = 48, className, title }: TierMarkProps) {
  const def = TIER_DEFS[tier];
  const color = TONE_VALUES[tone];
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {def.strokes.map((s, i) => (
        <path key={i} d={s.d} stroke={color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {def.tapers.map((d, i) => (
        <path key={i} d={d} fill={color} stroke="none" />
      ))}
    </svg>
  );
}
