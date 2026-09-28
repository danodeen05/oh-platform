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
   * (a solid cinnabar field with the glyph carved/knocked out in paper
   * color), not earned -> outline (a muted cinnabar glyph and border, no
   * field). Pass explicitly to override the default.
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
 * styles). The glyph is decorative (`aria-hidden`); the accessible name
 * always comes from the `name` prop (the translated badge name from the
 * API/DB), never from the glyph or the slug.
 *
 * Both variants get a subtle, deterministic stamped-edge texture via an SVG
 * filter (`feTurbulence` + `feDisplacementMap`); the filter/mask ids are
 * derived from `iconKey` + `variant`, not `useId`, so server and client
 * markup always match.
 *
 * Server-safe (no hooks): renders identically under `renderToString`.
 */
export function Seal({ iconKey, name, size = 56, earned = true, variant, className }: SealProps) {
  const def = SEALS[iconKey] ?? DEFAULT_SEAL;
  const resolvedVariant: SealVariant = variant ?? (earned ? "filled" : "outline");

  const idBase = `seal-${sanitizeId(iconKey)}-${resolvedVariant}`;
  const filterId = `${idBase}-edge`;
  const maskId = `${idBase}-mask`;

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
        {resolvedVariant === "filled" ? (
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
            {/* White = visible (the cinnabar field), black = knocked out
                (the glyph reads as carved through to the paper beneath). */}
            <rect x="0" y="0" width="64" height="64" fill="#fff" />
            <text
              x="32"
              y="33"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="28"
              fontFamily={GLYPH_FONT}
              fill="#000"
              aria-hidden="true"
            >
              {def.glyph}
            </text>
          </mask>
        ) : null}
      </defs>

      {resolvedVariant === "filled" ? (
        <g filter={`url(#${filterId})`}>
          {/* Paper backing (inside the mask, below the cinnabar field) so the
              knocked-out glyph reads as cream, not transparent. */}
          <g mask={`url(#${maskId})`}>
            <rect x="0" y="0" width="64" height="64" fill={PAPER} />
            {isRound ? <circle cx="32" cy="32" r="27" fill={CINNABAR} /> : <rect x="5" y="5" width="54" height="54" rx="3" fill={CINNABAR} />}
          </g>
          {isDouble ? <rect x="11" y="11" width="42" height="42" rx="2" fill="none" stroke={PAPER} strokeWidth="1.4" opacity={0.85} /> : null}
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
