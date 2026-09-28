import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Seal } from "../seal/Seal";
import { SEALS, DEFAULT_SEAL } from "../seal/seals";

describe("Seal", () => {
  it("renders an <svg> chop seal", () => {
    const html = renderToString(<Seal iconKey="first-order" name="First Bowl" />);
    expect(html).toContain("<svg");
  });

  it("exposes the translated badge name as the accessible name, with the glyph aria-hidden", () => {
    const html = renderToString(<Seal iconKey="vip" name="VIP" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="VIP"');
    // The CJK glyph itself must never be the thing assistive tech announces.
    // (No `/s` dotAll flag: the tsconfig target is ES2017, so `[\s\S]`
    // stands in for "any character including newlines".)
    expect(html).toMatch(/aria-hidden="true"[^>]*>(?:(?!<\/svg>)[\s\S])*牛/);
  });

  it("defaults to a 56px size and scales with the size prop", () => {
    const html = renderToString(<Seal iconKey="first-order" name="First Bowl" />);
    expect(html).toContain('width="56"');
    expect(html).toContain('height="56"');

    const bigger = renderToString(<Seal iconKey="first-order" name="First Bowl" size={96} />);
    expect(bigger).toContain('width="96"');
    expect(bigger).toContain('height="96"');
  });

  it("dims unearned seals without changing the accessible name", () => {
    const earned = renderToString(<Seal iconKey="vip" name="VIP" earned />);
    const unearned = renderToString(<Seal iconKey="vip" name="VIP" earned={false} />);
    expect(earned).toContain('aria-label="VIP"');
    expect(unearned).toContain('aria-label="VIP"');
    expect(earned).not.toEqual(unearned);
  });

  it("falls back to the default seal for an unknown badge slug", () => {
    const html = renderToString(<Seal iconKey="some-future-badge" name="Mystery Badge" />);
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="Mystery Badge"');
    expect(html).toContain(DEFAULT_SEAL.glyph);
  });

  it("every SEALS entry renders as an <svg> with its own glyph", () => {
    for (const [slug, def] of Object.entries(SEALS)) {
      const html = renderToString(<Seal iconKey={slug} name={`Badge: ${slug}`} />);
      expect(html, `${slug} did not render an <svg>`).toContain("<svg");
      expect(html, `${slug} did not render its glyph "${def.glyph}"`).toContain(def.glyph);
      expect(["square", "round", "double"]).toContain(def.border);
    }
  });

  // Task C2, Fix round 1 (design review, Important finding #3): authentic
  // 白文 (filled) and 朱文 (outline) styles.

  it("defaults to the filled (白文) variant when earned: a solid cinnabar field with the glyph drawn on top", () => {
    const html = renderToString(<Seal iconKey="vip" name="VIP" earned />);
    // Fix round 2: no more mask/knockout at all (see below for why).
    expect(html).not.toContain("<mask");
    expect(html).toMatch(/<(rect|circle)[^>]*fill="var\(--color-oh-ember[^"]*"/);
  });

  it("defaults to the outline (朱文) variant when not earned, with no solid field", () => {
    const html = renderToString(<Seal iconKey="vip" name="VIP" earned={false} />);
    expect(html).not.toContain("<mask");
    // The border/glyph are stroked/filled with ink, but nothing covers the
    // whole seal: no cinnabar-filled rect or circle standing in for a field.
    expect(html).not.toMatch(/<(rect|circle)[^>]*fill="var\(--color-oh-ember[^>]*(?<!fill="none")\/>/);
    expect(html).toMatch(/<(rect|circle)[^>]*fill="none"/);
  });

  it("an explicit variant prop overrides the earned-derived default", () => {
    const filledButLocked = renderToString(<Seal iconKey="vip" name="VIP" earned={false} variant="filled" />);
    const outlineButEarned = renderToString(<Seal iconKey="vip" name="VIP" earned variant="outline" />);
    // Filled = a solid cinnabar field (circle/rect fill, not stroke-only).
    expect(filledButLocked).toMatch(/<(rect|circle)[^>]*fill="var\(--color-oh-ember[^"]*"/);
    // Outline = stroked only, no solid field.
    expect(outlineButEarned).toMatch(/<(rect|circle)[^>]*fill="none"/);
    expect(outlineButEarned).not.toMatch(/<(rect|circle)[^>]*fill="var\(--color-oh-ember[^>]*(?<!fill="none")\/>/);
  });

  // Task C2, Fix round 2 (design review, rendering bug at Seal.tsx:113-117):
  // the filled variant used to draw a full-bleed paper rect *inside the same
  // masked group* as the cinnabar field. An SVG mask applies to the whole
  // group it's on, so the glyph's knockout made BOTH the paper rect and the
  // cinnabar field transparent there -- on the dark site that showed as a
  // charcoal hole through to the page background, not a cream glyph. Fixed
  // by dropping the mask entirely: the field is solid, and the glyph is
  // drawn on top of it in paper color instead of being knocked out.

  it("the filled variant's glyph is filled with the paper color, not knocked out", () => {
    const html = renderToString(<Seal iconKey="vip" name="VIP" earned />);
    const paperTextRe = /<text[^>]*fill="var\(--color-oh-cream[^"]*"[^>]*>牛<\/text>/;
    expect(html).toMatch(paperTextRe);
  });

  it("has no element inside a mask with a full-bleed paper rect (regression guard for the round-1 bug)", () => {
    for (const variant of ["filled", "outline"] as const) {
      const html = renderToString(<Seal iconKey="vip" name="VIP" variant={variant} />);
      const maskBodies = html.match(/<mask[^]*?<\/mask>/g) ?? [];
      for (const body of maskBodies) {
        expect(body).not.toMatch(/<rect[^>]*width="64"[^>]*height="64"[^>]*fill="var\(--color-oh-cream/);
      }
    }
  });

  it("a round filled seal has no square paper background -- it stays transparent outside the circle", () => {
    // "vip" is a "double" (square-family) border; pick a "round" badge.
    const roundSlug = Object.entries(SEALS).find(([, def]) => def.border === "round")?.[0];
    expect(roundSlug, "fixture assumption: at least one SEALS entry uses a round border").toBeTruthy();
    const html = renderToString(<Seal iconKey={roundSlug!} name="Round badge" earned variant="filled" />);
    // No full 64x64 rect of any kind sitting behind (or around) the circle
    // -- the round seal's field is only the <circle>. (The glyph itself
    // legitimately uses the paper color, drawn on top of the circle; what's
    // banned here is a square backing rect, which is the round-1 bug.)
    expect(html).not.toMatch(/<rect[^>]*width="64"[^>]*height="64"/);
    expect(html).toContain("<circle");
  });

  it("gives both variants a subtle stamped-edge filter with a deterministic id (no useId-style hydration mismatch)", () => {
    const first = renderToString(<Seal iconKey="vip" name="VIP" earned />);
    const second = renderToString(<Seal iconKey="vip" name="VIP" earned />);
    expect(first).toContain("<filter");
    expect(first).toContain("feTurbulence");
    expect(first).toContain("feDisplacementMap");

    const idOf = (html: string) => html.match(/<filter id="([^"]+)"/)?.[1];
    expect(idOf(first)).toBeTruthy();
    expect(idOf(first)).toBe(idOf(second));

    // Different seal keys get different (still deterministic) ids, so two
    // different badges' filters never collide.
    const other = renderToString(<Seal iconKey="first-order" name="First Bowl" earned />);
    expect(idOf(other)).not.toBe(idOf(first));
  });

  it("stays legible: both variants' glyphs use the same font size at both a small and a large rendered size", () => {
    for (const size of [32, 96]) {
      const filled = renderToString(<Seal iconKey="vip" name="VIP" earned size={size} />);
      const outline = renderToString(<Seal iconKey="vip" name="VIP" earned={false} size={size} />);
      expect(filled).toContain('font-size="28"');
      expect(outline).toContain('font-size="28"');
    }
  });
});
