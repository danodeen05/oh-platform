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
});
