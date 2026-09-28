/**
 * Membership tier marks (Task C2, Fix round 1): renders the owner's actual
 * tier art -- apps/web/public/tiers/{chopstick,noodle-master,beef-boss}.png
 * -- traced into vector path data by scripts/trace-tier-marks.mjs (see
 * ./tier-paths.ts, generated, do not hand-edit). This replaced an earlier,
 * hand-redrawn line-art approximation: the owner's binding rule is that the
 * marks must be the owner's actual art, traced, not a reinterpretation.
 *
 * Task G2a: the path data no longer ships in the page. The large marks are
 * <symbol>s in public/tiers/marks.svg (scripts/build-tier-sprite.mjs, from
 * the same tier-paths.ts) drawn with <use href>, so they cost one cached
 * file instead of 27 KB in the shared JS and twice that in each page's HTML.
 * The small chopstick mark (the dock's) stays inline so the dock never waits.
 */
import type { Tier } from "./tier-paths";
import { TIER_INLINE_PATHS, TIER_SPRITE_URL, TIER_VIEWBOX } from "./tier-sprite";

export type { Tier };
export type Tone = "cream" | "gold" | "ink" | "current";

export const TIERS = Object.keys(TIER_VIEWBOX) as Tier[];

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
  const inline = TIER_INLINE_PATHS[tier];
  const color = TONE_VALUES[tone];
  const labelled = Boolean(title);

  return (
    <svg
      viewBox={TIER_VIEWBOX[tier]}
      width={size}
      height={size}
      className={className}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {inline ? (
        <path d={inline} fill={color} fillRule="evenodd" stroke="none" />
      ) : (
        // The symbol's path carries fill-rule="evenodd" and no fill, so it takes this one.
        <use href={`${TIER_SPRITE_URL}#${tier}`} fill={color} />
      )}
    </svg>
  );
}
