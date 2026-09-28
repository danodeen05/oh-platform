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
 * In-house icon (Task C2, Fix round 1). No icon library, and no uniform-
 * width `stroke` -- every icon is a set of FILLED, tapered brush-stroke
 * outlines (see ./brush.ts and ./paths.ts), which is what keeps this from
 * reading as a generic Lucide/Feather-style outline set. There is no
 * `stroke` or `stroke-width` attribute anywhere in this component.
 *
 * Server-safe (no hooks): renders identically under `renderToString` with
 * no providers, matching SitePicture's pattern.
 */
export function Icon({ name, size = 24, className, title }: IconProps) {
  const def = ICON_PATHS[name];
  const labelled = Boolean(title);

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} role={labelled ? "img" : undefined} aria-hidden={labelled ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {def.paths.map((d, i) => (
        <path key={i} d={d} fill="currentColor" fillRule="evenodd" />
      ))}
    </svg>
  );
}
