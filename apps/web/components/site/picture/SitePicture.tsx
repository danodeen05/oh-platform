import { SITE_IMAGES, type ImageKey } from "@/lib/site/images";

export interface SitePictureProps {
  /** Key into SITE_IMAGES. */
  image: ImageKey;
  /** The `sizes` attribute, shared by both `<source>` elements. */
  sizes: string;
  /**
   * Marks this as the largest-contentful-paint image: `loading="eager"` and
   * `fetchPriority="high"` instead of the lazy-loaded default.
   */
  priority?: boolean;
  className?: string;
  /**
   * Resolved alt text. SitePicture is a server-safe component with no hooks
   * (so it can render identically on the server, in isolation, and under
   * `renderToString` in tests with no next-intl provider present) and
   * therefore cannot call `useTranslations` itself. Callers should resolve
   * the message and pass it here:
   *
   *   <SitePicture image="storefront-dusk" sizes="100vw"
   *     alt={t(SITE_IMAGES["storefront-dusk"].alt)} />
   *
   * When omitted, the raw `siteImages.*` message key is used as a fallback
   * so the rendered `<img>` never ships with an empty `alt` attribute.
   */
  alt?: string;
}

/**
 * Server-safe `<picture>` for `SITE_IMAGES`. Serves the precomputed AVIF and
 * WebP files at 390/780/1200w directly from `apps/web/public/site/` rather
 * than routing through Vercel's on-demand image optimizer: faster on
 * mobile, and it avoids re-encoding AVIF output that's already compressed
 * (controller ruling, Task C6 fix round 1).
 */
export function SitePicture({ image, sizes, priority = false, className, alt }: SitePictureProps) {
  const entry = SITE_IMAGES[image];
  const resolvedAlt = alt ?? entry.alt;
  const fallbackSrc = pickWidth(entry.srcSet.webp, 780);

  return (
    <picture className={className}>
      <source type="image/avif" srcSet={entry.srcSet.avif} sizes={sizes} />
      <source type="image/webp" srcSet={entry.srcSet.webp} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- precomputed static asset, not routed through next/image's optimizer on purpose */}
      <img
        src={fallbackSrc}
        alt={resolvedAlt}
        width={entry.w}
        height={entry.h}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
      />
    </picture>
  );
}

// Pulls the URL for a given width out of a `srcset` string ("url 390w, url
// 780w, url 1200w"), so the fallback `<img>` never hardcodes the naming
// convention separately from what the script actually generated.
function pickWidth(srcSet: string, width: number): string {
  const match = srcSet
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith(`${width}w`));
  if (!match) {
    throw new Error(`SitePicture: no ${width}w entry in srcSet "${srcSet}"`);
  }
  return match.slice(0, match.lastIndexOf(" "));
}
