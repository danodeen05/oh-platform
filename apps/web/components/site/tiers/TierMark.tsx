/**
 * Membership tier marks (Task C2, Fix round 1): renders the owner's actual
 * tier art -- apps/web/public/tiers/{chopstick,noodle-master,beef-boss}.png
 * -- traced into vector path data by scripts/trace-tier-marks.mjs (see
 * ./tier-paths.ts, generated, do not hand-edit). This replaced an earlier,
 * hand-redrawn line-art approximation: the owner's binding rule is that the
 * marks must be the owner's actual art, traced, not a reinterpretation.
 */
import { TIER_PATHS, type Tier } from "./tier-paths";

export type { Tier };
export type Tone = "cream" | "gold" | "ink" | "current";

export const TIERS = Object.keys(TIER_PATHS) as Tier[];

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
  // Task C4 fix round 1: follows the surrounding text color (the dock's
  // active and inactive states), like the in-house icons.
  current: "currentColor",
};

/**
 * Server-safe (no hooks): renders identically under `renderToString`, same
 * pattern as SitePicture and Icon.
 */
export function TierMark({ tier, tone = "ink", size = 48, className, title }: TierMarkProps) {
  const def = TIER_PATHS[tier];
  const color = TONE_VALUES[tone];
  const labelled = Boolean(title);

  return (
    <svg
      viewBox={def.viewBox}
      width={size}
      height={size}
      className={className}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d={def.d} fill={color} fillRule="evenodd" stroke="none" />
    </svg>
  );
}
