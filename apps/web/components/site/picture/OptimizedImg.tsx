/**
 * A plain <img> served through Next's image optimizer (Task G2b).
 *
 * next/image's client component costs about 5 KB of gzipped JS on every
 * page that renders it. For a photo that only needs the optimizer's resized
 * files (menu and store photos under /public), this builds the same
 * `/_next/image?url=…&w=…&q=75` srcset by hand, with no client code at all.
 * The widths are Next's default device and image sizes, which the optimizer
 * accepts. `fill` is the caller's job (absolute inset-0, object-cover).
 */

const WIDTHS = [64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200] as const;

export function optimizedSrc(src: string, width: number, quality = 75): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

export function optimizedSrcSet(src: string, quality = 75): string {
  return WIDTHS.map((w) => `${optimizedSrc(src, w, quality)} ${w}w`).join(", ");
}

export function OptimizedImg({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- optimizer URLs built by hand (see above)
    <img
      src={optimizedSrc(src, 828)}
      srcSet={optimizedSrcSet(src)}
      sizes={sizes}
      alt={alt}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={className}
    />
  );
}
