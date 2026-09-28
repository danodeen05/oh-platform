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
  /**
   * Task G2a: the widest file a phone (below 768px) may pick. A 390px phone
   * at 3x DPR would otherwise always take the 1200w file; for the heroes the
   * 780w AVIF is about half the bytes on the connection that matters most.
   */
  phoneMaxWidth?: 390 | 780;
}

const PHONE = "(max-width: 767px)";
const NOT_PHONE = "(min-width: 768px)";
// Art direction (G2a fix round 1): images with a `portrait` crop serve it to
// phones held upright, full width, and the landscape art everywhere else.
const PORTRAIT_PHONE = "(max-width: 767px) and (orientation: portrait)";
const NOT_PORTRAIT_PHONE = "(min-width: 768px), (orientation: landscape)";

/**
 * Server-safe `<picture>` for `SITE_IMAGES`. Serves the precomputed AVIF and
 * WebP files at 390/780/1200w directly from `apps/web/public/site/` rather
 * than routing through Vercel's on-demand image optimizer: faster on
 * mobile, and it avoids re-encoding AVIF output that's already compressed
 * (controller ruling, Task C6 fix round 1).
 */
export function SitePicture({ image, sizes, priority = false, className, alt, phoneMaxWidth }: SitePictureProps) {
  const entry = SITE_IMAGES[image];
  const fallbackSrc = pickWidth(entry.srcSet.webp, 780);
  const phone = phoneMaxWidth
    ? { avif: capSrcSet(entry.srcSet.avif, phoneMaxWidth), webp: capSrcSet(entry.srcSet.webp, phoneMaxWidth) }
    : null;
  const portrait = entry.portrait;
  if (priority) {
    // Task G2a: a <link rel=preload> in <head> for the LCP image, so its
    // request starts with the first bytes of the document instead of when
    // the parser reaches the <picture>. Same AVIF candidates, sizes and
    // media as the <source>s, so the browser preloads the file the picture
    // will use.
    const base = { as: "image" as const, type: "image/avif", imageSizes: sizes, fetchPriority: "high" as const };
    if (portrait) {
      preload(pickWidth(portrait.srcSet.avif, 780), {
        ...base,
        imageSrcSet: portrait.srcSet.avif,
        imageSizes: "100vw",
        media: PORTRAIT_PHONE,
      });
      preload(pickWidth(entry.srcSet.avif, 1200), { ...base, imageSrcSet: entry.srcSet.avif, media: NOT_PORTRAIT_PHONE });
    } else if (phone && phoneMaxWidth) {
      preload(pickWidth(entry.srcSet.avif, phoneMaxWidth), { ...base, imageSrcSet: phone.avif, media: PHONE });
      preload(pickWidth(entry.srcSet.avif, 1200), { ...base, imageSrcSet: entry.srcSet.avif, media: NOT_PHONE });
    } else {
      preload(pickWidth(entry.srcSet.avif, 1200), { ...base, imageSrcSet: entry.srcSet.avif });
    }
  }

  return (
    <picture className={className}>
      {portrait ? <source media={PORTRAIT_PHONE} type="image/avif" srcSet={portrait.srcSet.avif} sizes="100vw" /> : null}
      {portrait ? <source media={PORTRAIT_PHONE} type="image/webp" srcSet={portrait.srcSet.webp} sizes="100vw" /> : null}
      {phone ? <source media={PHONE} type="image/avif" srcSet={phone.avif} sizes={sizes} /> : null}
      {phone ? <source media={PHONE} type="image/webp" srcSet={phone.webp} sizes={sizes} /> : null}
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

// The candidates in a `srcset` string no wider than `max`.
function capSrcSet(srcSet: string, max: number): string {
  return srcSet
    .split(",")
    .map((part) => part.trim())
    .filter((part) => Number(part.slice(part.lastIndexOf(" ") + 1, -1)) <= max)
    .join(", ");
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
