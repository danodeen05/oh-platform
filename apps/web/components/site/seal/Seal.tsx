import { SEALS, DEFAULT_SEAL } from "./seals";

export type SealVariant = "filled" | "outline";

export interface SealProps {
  /** Badge slug, e.g. "first-order". Looked up in SEALS; unknown slugs fall back to DEFAULT_SEAL. */
  iconKey: string;
  /** Accessible name -- the translated badge name. Never the raw glyph or slug. */
  name: string;
  /** Pixel size for both width and height. Defaults to 56. */
  size?: number;
  /** Whether the viewer has earned this badge. Drives the default `variant` (filled when earned, outline when not). Defaults to true. */
  earned?: boolean;
  /**
   * 白文 (filled) or 朱文 (outline). Defaults from `earned`: earned -> filled
   * (a solid cinnabar field with the glyph drawn on top in paper color),
   * not earned -> outline (a muted cinnabar glyph and border, no field).
   * Pass explicitly to override the default.
   */
  variant?: SealVariant;
  className?: string;
}

const CINNABAR = "var(--color-oh-ember, #C1502E)";
const PAPER = "var(--color-oh-cream, #F2EDE4)";

const GLYPH_FONT = "'Noto Serif TC', 'Noto Serif SC', 'PingFang TC', serif";

function sanitizeId(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "-");
}

// A small deterministic hash (not for security/uniqueness) used only to
// give each seal's stamped-edge texture a slightly different character --
// same input always produces the same output, so SSR and hydration always
// agree (unlike React's useId, which this component never needs since it
// has no hooks at all).
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Chop seal (印章) badge mark (Task C2, Fix round 1: authentic 白文/朱文
 * styles; Fix round 2: filled-variant rendering bug). The glyph is
 * decorative (`aria-hidden`); the accessible name always comes from the
 * `name` prop (the translated badge name from the API/DB), never from the
 * glyph or the slug.
 *
 * Both variants get a subtle, deterministic stamped-edge texture via an SVG
 * filter (`feTurbulence` + `feDisplacementMap`); the filter id is derived
 * from `iconKey` + `variant`, not `useId`, so server and client markup
 * always match.
 *
 * Fix round 2: the filled (白文) variant used to punch the glyph out of a
 * paper-colored backing rect via an SVG `<mask>`. That's wrong: a mask
 * applies to the WHOLE group it's attached to, so masking the glyph out of
 * a group containing both the paper rect and the cinnabar field made both
 * transparent in the glyph's shape -- on the dark site that showed as a
 * charcoal hole straight through to the page background, not a cream
 * glyph. Fixed by not knocking anything out at all: the cinnabar field is
 * drawn solid, and the glyph is drawn ON TOP of it in paper color, both
 * under the same stamped-edge filter so they share one printed texture.
 *
 * Server-safe (no hooks): renders identically under `renderToString`.
 */
export function Seal({ iconKey, name, size = 56, earned = true, variant, className }: SealProps) {
  const def = SEALS[iconKey] ?? DEFAULT_SEAL;
  const resolvedVariant: SealVariant = variant ?? (earned ? "filled" : "outline");

  const idBase = `seal-${sanitizeId(iconKey)}-${resolvedVariant}`;
  const filterId = `${idBase}-edge`;

  const h = hashString(iconKey);
  const seed = h % 100;
  const baseFrequency = (0.055 + (h % 6) * 0.006).toFixed(4);

  const isRound = def.border === "round";
  const isDouble = def.border === "double";

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={name}
      opacity={resolvedVariant === "outline" ? 0.72 : 1}
    >
      <defs>
        {/* Subtle, deterministic irregularity so the stamp doesn't look
            machine-perfect -- a real chop leaves an uneven ink edge. */}
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={2} seed={seed} result="oh-seal-noise" />
          <feDisplacementMap in="SourceGraphic" in2="oh-seal-noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {resolvedVariant === "filled" ? (
        // No mask/knockout: a round seal must stay transparent outside its
        // circle, and a masked group can't do that (see the note above), so
        // the field is drawn solid and the glyph sits on top of it in paper
        // color -- one filter group, one shared texture, no full-bleed rect.
        <g filter={`url(#${filterId})`}>
          {isRound ? <circle cx="32" cy="32" r="27" fill={CINNABAR} /> : <rect x="5" y="5" width="54" height="54" rx="3" fill={CINNABAR} />}
          {isDouble ? <rect x="11" y="11" width="42" height="42" rx="2" fill="none" stroke={PAPER} strokeWidth="1.4" opacity={0.85} /> : null}
          <text
            x="32"
            y="33"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="28"
            fontFamily={GLYPH_FONT}
            fill={PAPER}
            aria-hidden="true"
          >
            {def.glyph}
          </text>
        </g>
      ) : (
        <g filter={`url(#${filterId})`}>
          {isRound ? (
            <circle cx="32" cy="32" r="27" fill="none" stroke={CINNABAR} strokeWidth="3" />
          ) : (
            <rect x="5" y="5" width="54" height="54" rx="3" fill="none" stroke={CINNABAR} strokeWidth="3" />
          )}
          {isDouble ? <rect x="11" y="11" width="42" height="42" rx="2" fill="none" stroke={CINNABAR} strokeWidth="1.5" /> : null}
          <text
            x="32"
            y="33"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="28"
            fontFamily={GLYPH_FONT}
            fill={CINNABAR}
            aria-hidden="true"
          >
            {def.glyph}
          </text>
        </g>
      )}
    </svg>
  );
}
