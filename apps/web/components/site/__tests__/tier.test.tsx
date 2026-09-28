import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { TierMark, TIERS, type Tier } from "../tiers/TierMark";

describe("TierMark", () => {
  it("renders an <svg> for every tier", () => {
    for (const tier of TIERS) {
      const html = renderToString(<TierMark tier={tier} />);
      expect(html, `${tier} did not render an <svg>`).toContain("<svg");
      // Task G2a: inline for the dock's small chopstick mark, from the sprite for the rest.
      expect(html).toMatch(tier === "chopstick" ? /<path/ : /<use href="\/tiers\/marks\.svg\?v=[0-9a-f]+#/);
    }
  });

  it("has exactly the three tiers from public/tiers/*.png", () => {
    const expected: Tier[] = ["chopstick", "noodle-master", "beef-boss"];
    expect([...TIERS].sort()).toEqual([...expected].sort());
  });

  it("defaults to a 48px size and scales with the size prop", () => {
    const html = renderToString(<TierMark tier="chopstick" />);
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');

    const bigger = renderToString(<TierMark tier="chopstick" size={120} />);
    expect(bigger).toContain('width="120"');
    expect(bigger).toContain('height="120"');
  });

  it("supports cream, gold and ink tones with visibly different fills", () => {
    const cream = renderToString(<TierMark tier="beef-boss" tone="cream" />);
    const gold = renderToString(<TierMark tier="beef-boss" tone="gold" />);
    const ink = renderToString(<TierMark tier="beef-boss" tone="ink" />);
    expect(cream).not.toEqual(gold);
    expect(gold).not.toEqual(ink);
    expect(cream).not.toEqual(ink);
  });

  it("the current tone fills with currentColor so it follows the surrounding text color (Task C4)", () => {
    const html = renderToString(<TierMark tier="chopstick" tone="current" size={24} />);
    expect(html).toContain('fill="currentColor"');
  });

  it("is aria-hidden with no title, and exposes role=img + <title> when given one", () => {
    const hidden = renderToString(<TierMark tier="noodle-master" />);
    expect(hidden).toContain('aria-hidden="true"');

    const labeled = renderToString(<TierMark tier="noodle-master" title="Noodle Master tier" />);
    expect(labeled).toContain('role="img"');
    expect(labeled).toContain("<title");
    expect(labeled).toContain("Noodle Master tier");
  });

  it("renders the traced compound path with an evenodd fill rule (holes from the source PNG)", () => {
    // Inline marks carry it on the path; sprite marks on the symbol's path (tier-sprite.test.ts).
    const html = renderToString(<TierMark tier="chopstick" />);
    expect(html).toContain('fill-rule="evenodd"');
  });

  it("uses a non-default viewBox taken from the trace, not a fixed grid", () => {
    // Each tier's source PNG has different pixel dimensions, so a real
    // trace produces a different viewBox per tier -- a hand-drawn stand-in
    // on a shared 0 0 100 100 grid would not.
    const viewBoxes = TIERS.map((tier) => {
      const html = renderToString(<TierMark tier={tier} />);
      return html.match(/viewBox="([^"]+)"/)?.[1];
    });
    expect(new Set(viewBoxes).size).toBe(TIERS.length);
  });
});
