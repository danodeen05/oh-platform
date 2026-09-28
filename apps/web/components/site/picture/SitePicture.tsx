import { preload } from "react-dom";
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
   * Resolved, translated alt text. Required: SitePicture is a server-safe
   * component with no hooks (so it can render identically on the server, in
   * isolation, and under `renderToString` in tests with no next-intl
   * provider present) and therefore cannot call `useTranslations` itself.
   * Callers must resolve the message and pass it here, e.g.:
   *
   *   <SitePicture image="storefront-dusk" sizes="100vw"
   *     alt={t(SITE_IMAGES["storefront-dusk"].alt)} />
   *
   * There is no fallback to the raw `siteImages.*` message key: shipping an
   * untranslated dotted key as visible/AT-read text would violate the
   * no-untranslated-text rule, so omitting `alt` is a type error instead.
   */
  alt: string;
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
  const fallbackSrc = pickWidth(entry.srcSet.webp, 780);
  if (priority) {
    // Task G2a: a <link rel=preload> in <head> for the LCP image, so its
    // request starts with the first bytes of the document instead of when
    // the parser reaches the <picture>. Same AVIF candidates and sizes as
    // the <source>, so the browser picks the file the picture will use.
    preload(pickWidth(entry.srcSet.avif, 1200), {
      as: "image",
      type: "image/avif",
      imageSrcSet: entry.srcSet.avif,
      imageSizes: sizes,
      fetchPriority: "high",
    });
  }

  return (
    <picture className={className}>
      <source type="image/avif" srcSet={entry.srcSet.avif} sizes={sizes} />
      <source type="image/webp" srcSet={entry.srcSet.webp} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- precomputed static asset, not routed through next/image's optimizer on purpose */}
      <img
        src={fallbackSrc}
        alt={alt}
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
