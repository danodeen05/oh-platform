import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SITE_IMAGES } from "@/lib/site/images";
import { SitePicture } from "../picture/SitePicture";

// SitePicture is a server-safe component (no hooks), so renderToString works
// with no providers, DOM, or next-intl context at all -- the same
// environment a real RSC render runs in.

describe("SitePicture", () => {
  it("renders an avif source, a webp source, and an img fallback with all 3 widths", () => {
    const html = renderToString(
      <SitePicture image="storefront-dusk" sizes="100vw" alt={SITE_IMAGES["storefront-dusk"].alt} />,
    );
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
    const html = renderToString(<SitePicture image="hall-rows" sizes="100vw" alt="Hall of pods" />);
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
    const html = renderToString(<SitePicture image="bowl-slices-top" sizes="50vw" alt="Sliced brisket bowl" />);
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
    const html = renderToString(<SitePicture image="chopsticks" sizes="100vw" alt="Wooden chopsticks" />);
    expect(html).toContain('loading="lazy"');
    expect(html.toLowerCase()).not.toContain("fetchpriority");
  });

  it("switches to eager loading and high fetchpriority when priority is set", () => {
    const html = renderToString(<SitePicture image="chopsticks" sizes="100vw" alt="Wooden chopsticks" priority />);
    expect(html).toContain('loading="eager"');
    expect(html.toLowerCase()).toContain('fetchpriority="high"');
  });

  // Task G2a: phones can be capped to a smaller file (the heroes use 780w).
  it("with phoneMaxWidth, offers phones only the candidates up to that width, before the full set", () => {
    const html = renderToString(<SitePicture image="storefront-dusk" sizes="100vw" alt="x" phoneMaxWidth={780} />);
    const phoneAvif = html.match(/<source media="\(max-width: 767px\)" type="image\/avif" srcSet="([^"]+)"/)?.[1];
    expect(phoneAvif).toBeDefined();
    expect(phoneAvif).toContain("storefront-dusk-780.avif 780w");
    expect(phoneAvif).not.toContain("1200");
    expect(html.indexOf('media="(max-width: 767px)"')).toBeLessThan(html.indexOf('<source type="image/avif"'));
    expect(html).toContain("storefront-dusk-1200.avif 1200w");
  });

  it("without phoneMaxWidth, renders no media-scoped sources", () => {
    const html = renderToString(<SitePicture image="storefront-dusk" sizes="100vw" alt="x" />);
    expect(html).not.toContain("media=");
  });

  it("renders the provided alt text on the <img>", () => {
    const html = renderToString(<SitePicture image="sign-pool" sizes="100vw" alt="Custom alt text" />);
    expect(html).toContain('alt="Custom alt text"');
  });

  it("never renders the raw siteImages.* message key as alt text", () => {
    // Regression guard for the no-untranslated-text rule: a caller can still
    // (accidentally) pass the raw key as a string since it's just a string
    // prop, but the component itself must not manufacture one as a fallback.
    const html = renderToString(<SitePicture image="sign-pool" sizes="100vw" alt="A lit sign in a pool" />);
    expect(html).not.toContain(SITE_IMAGES["sign-pool"].alt);
  });

  it("passes className through to the <picture> element", () => {
    const html = renderToString(<SitePicture image="bowl-empty" sizes="100vw" alt="An empty bowl" className="rounded-lg" />);
    expect(html).toMatch(/<picture[^>]*class="rounded-lg"/);
  });

  it("requires alt at the type level (tsc must flag this omission)", () => {
    // This exists purely so tsc catches a regression if `alt` is ever made
    // optional again. The component still renders at runtime (JS doesn't
    // enforce the type), so we don't assert on the output here -- the
    // coverage is `pnpm --filter @oh/web exec tsc --noEmit -p tsconfig.json`
    // reporting exactly one new error, at the line below.
    // @ts-expect-error alt is required; omitting it must be a type error.
    renderToString(<SitePicture image="sign-pool" sizes="100vw" />);
    expect(true).toBe(true);
  });
});
