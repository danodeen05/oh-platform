import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SITE_IMAGES } from "@/lib/site/images";
import { SitePicture } from "../picture/SitePicture";

// SitePicture is a server-safe component (no hooks), so renderToString works
// with no providers, DOM, or next-intl context at all -- the same
// environment a real RSC render runs in.

describe("SitePicture", () => {
  it("renders an avif source, a webp source, and an img fallback with all 3 widths", () => {
    const html = renderToString(<SitePicture image="storefront-dusk" sizes="100vw" />);
    const entry = SITE_IMAGES["storefront-dusk"];

    expect(html).toContain('type="image/avif"');
    expect(html).toContain('type="image/webp"');
    expect(html).toContain(entry.srcSet.avif);
    expect(html).toContain(entry.srcSet.webp);
    for (const width of [390, 780, 1200]) {
      expect(entry.srcSet.avif).toContain(`${width}w`);
      expect(entry.srcSet.webp).toContain(`${width}w`);
    }
    expect(html).toContain('sizes="100vw"');
  });

  it("uses the 780w webp file as the <img> fallback src", () => {
    const html = renderToString(<SitePicture image="hall-rows" sizes="100vw" />);
    const entry = SITE_IMAGES["hall-rows"];
    const expected780 = entry.srcSet.webp
      .split(",")
      .map((s) => s.trim())
      .find((s) => s.endsWith("780w"))!
      .split(" ")[0];

    expect(html).toContain(`src="${expected780}"`);
    // The 1200w file legitimately appears inside the srcset attribute; what
    // it must NOT do is show up as the <img> tag's own src.
    expect(html).not.toContain(`src="${entry.src.webp}"`);
  });

  it("sets width and height attributes matching the SITE_IMAGES entry", () => {
    const html = renderToString(<SitePicture image="bowl-slices-top" sizes="50vw" />);
    const entry = SITE_IMAGES["bowl-slices-top"];

    expect(html).toContain(`width="${entry.w}"`);
    expect(html).toContain(`height="${entry.h}"`);
  });

  // React's static markup renderer serializes the `fetchPriority` prop with
  // its JSX casing preserved rather than lowercasing it; HTML attribute
  // names are case-insensitive on parse, so this is equivalent to
  // `fetchpriority` once a browser parses the markup. Assertions below are
  // case-insensitive on the attribute name for that reason.

  it("defaults to lazy loading with no fetchpriority", () => {
    const html = renderToString(<SitePicture image="chopsticks" sizes="100vw" />);
    expect(html).toContain('loading="lazy"');
    expect(html.toLowerCase()).not.toContain("fetchpriority");
  });

  it("switches to eager loading and high fetchpriority when priority is set", () => {
    const html = renderToString(<SitePicture image="chopsticks" sizes="100vw" priority />);
    expect(html).toContain('loading="eager"');
    expect(html.toLowerCase()).toContain('fetchpriority="high"');
  });

  it("uses the alt prop when given", () => {
    const html = renderToString(<SitePicture image="sign-pool" sizes="100vw" alt="Custom alt text" />);
    expect(html).toContain('alt="Custom alt text"');
  });

  it("falls back to the raw siteImages.* message key when alt is omitted", () => {
    const html = renderToString(<SitePicture image="sign-pool" sizes="100vw" />);
    expect(html).toContain(`alt="${SITE_IMAGES["sign-pool"].alt}"`);
  });

  it("passes className through to the <picture> element", () => {
    const html = renderToString(<SitePicture image="bowl-empty" sizes="100vw" className="rounded-lg" />);
    expect(html).toMatch(/<picture[^>]*class="rounded-lg"/);
  });
});
