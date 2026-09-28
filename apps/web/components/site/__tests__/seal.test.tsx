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
  // 白文 (filled, knocked-out glyph) and 朱文 (outline, glyph in ink) styles.

  it("defaults to the filled (白文) variant when earned, with a mask that knocks out the glyph", () => {
    const html = renderToString(<Seal iconKey="vip" name="VIP" earned />);
    expect(html).toContain("<mask");
    expect(html).toMatch(/mask="url\(#[^")]+\)"/);
    // The mask itself carries the glyph (in black, to punch the hole).
    expect(html).toMatch(/<mask[^]*?<\/mask>/);
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
    expect(filledButLocked).toContain("<mask");
    expect(outlineButEarned).not.toContain("<mask");
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

  it("stays legible: the filled variant's mask text and the outline variant's glyph use the same font size at both a small and a large rendered size", () => {
    for (const size of [32, 96]) {
      const filled = renderToString(<Seal iconKey="vip" name="VIP" earned size={size} />);
      const outline = renderToString(<Seal iconKey="vip" name="VIP" earned={false} size={size} />);
      expect(filled).toContain('font-size="28"');
      expect(outline).toContain('font-size="28"');
    }
  });
});
