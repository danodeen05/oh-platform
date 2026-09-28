import { ICON_PATHS, type IconName } from "./paths";

export type { IconName };
export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

export interface IconProps {
  name: IconName;
  /** Pixel size for both width and height. Defaults to the 24px grid. */
  size?: number;
  className?: string;
  /**
   * Accessible name. Omit for a purely decorative icon (the default): the
   * `<svg>` is then `aria-hidden`. Pass a translated string to expose it as
   * `role="img"` with a visible `<title>`.
   */
  title?: string;
}

/**
 * In-house icon (Task C2). No icon library: every glyph is a hand-drawn SVG
 * on a 24x24 grid, 1.5px stroke, round caps/joins, with one tapered accent
 * path per icon to echo the calligraphy-brush look used across the brand
 * (see the tier marks and chop seals in this same directory tree).
 *
 * Server-safe (no hooks): renders identically under `renderToString` with
 * no providers, matching SitePicture's pattern.
 */
export function Icon({ name, size = 24, className, title }: IconProps) {
  const def = ICON_PATHS[name];
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={className}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {def.strokes.map((d, i) => (
        <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <path d={def.taper} fill="currentColor" stroke="none" />
    </svg>
  );
}
