import { SEALS, DEFAULT_SEAL } from "./seals";

export interface SealProps {
  /** Badge slug, e.g. "first-order". Looked up in SEALS; unknown slugs fall back to DEFAULT_SEAL. */
  iconKey: string;
  /** Accessible name -- the translated badge name. Never the raw glyph or slug. */
  name: string;
  /** Pixel size for both width and height. Defaults to 56. */
  size?: number;
  /** Whether the viewer has earned this badge. Unearned seals render dimmed but keep the same accessible name. Defaults to true. */
  earned?: boolean;
  className?: string;
}

const INK_COLOR = "var(--color-oh-ash, #8A8178)";
const CINNABAR = "var(--color-oh-ember, #C1502E)";

/**
 * Chop seal (印章) badge mark (Task C2): a cinnabar square/round/double
 * border with one CJK glyph, in the style of a traditional ink stamp. The
 * glyph is decorative (`aria-hidden`); the accessible name always comes
 * from the `name` prop (the translated badge name from the API/DB), never
 * from the glyph or the slug.
 *
 * Server-safe (no hooks): renders identically under `renderToString`.
 */
export function Seal({ iconKey, name, size = 56, earned = true, className }: SealProps) {
  const def = SEALS[iconKey] ?? DEFAULT_SEAL;
  const color = earned ? CINNABAR : INK_COLOR;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={name}
      opacity={earned ? 1 : 0.55}
    >
      {def.border === "round" ? (
        <circle cx="32" cy="32" r="27" fill="none" stroke={color} strokeWidth="3" />
      ) : (
        <rect x="5" y="5" width="54" height="54" rx="3" fill="none" stroke={color} strokeWidth="3" />
      )}
      {def.border === "double" ? <rect x="11" y="11" width="42" height="42" rx="2" fill="none" stroke={color} strokeWidth="1.5" /> : null}
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="28"
        fontFamily="'Noto Serif TC', 'Noto Serif SC', 'PingFang TC', serif"
        fill={color}
        aria-hidden="true"
      >
        {def.glyph}
      </text>
    </svg>
  );
}
