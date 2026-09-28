import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Icon, ICON_NAMES, type IconName } from "../icons/Icon";
import { ICON_PATHS } from "../icons/paths";

// Icon is a server-safe component (no hooks), so renderToString works with
// no providers or DOM at all, the same as SitePicture's tests.

// Task C2, Fix round 1 (design review, Important finding #2): a uniform
// 1.5px `stroke` with round caps reads as a generic Lucide/Feather clone.
// Every icon must instead be built from FILLED, tapered brush-stroke
// outlines -- so these tests assert `fill` is used and `stroke`/
// `stroke-width` are absent, everywhere.
const GENERIC_NAMES: IconName[] = ["check", "alert", "share", "gift", "menu", "close", "arrow", "chevron"];

describe("Icon", () => {
  it("renders an <svg> on the 24px grid", () => {
    const html = renderToString(<Icon name="bowl" />);
    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 24 24"');
  });

  it("defaults to a 24x24 pixel size and scales with the size prop", () => {
    const html = renderToString(<Icon name="bowl" />);
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');

    const bigger = renderToString(<Icon name="bowl" size={48} />);
    expect(bigger).toContain('width="48"');
    expect(bigger).toContain('height="48"');
  });

  it("is aria-hidden with no accessible name when no title is given", () => {
    const html = renderToString(<Icon name="chevron" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<title");
  });

  it("exposes an accessible name via role=img and a <title> when title is given", () => {
    const html = renderToString(<Icon name="close" title="Close" />);
    expect(html).toContain('role="img"');
    expect(html).toContain("<title");
    expect(html).toContain("Close");
    expect(html).not.toContain('aria-hidden="true"');
  });

  it("passes className through to the <svg>", () => {
    const html = renderToString(<Icon name="menu" className="text-oh-ember" />);
    expect(html).toMatch(/<svg[^>]*class="text-oh-ember"/);
  });

  it("every icon name has path data and renders a non-empty <svg>", () => {
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name].paths.length, `missing path data for "${name}"`).toBeGreaterThan(0);
      const html = renderToString(<Icon name={name} />);
      expect(html).toContain("<svg");
      expect(html).toContain("<path");
    }
  });

  it("has exactly the names the brief lists", () => {
    const expected: IconName[] = [
      "bowl",
      "chopsticks",
      "pod",
      "hatch",
      "clock",
      "pin",
      "chevron",
      "close",
      "menu",
      "user",
      "gift",
      "store",
      "spark",
      "flame",
      "leaf",
      "wheat-off",
      "seal",
      "check",
      "alert",
      "share",
      "wallet",
      "arrow",
      // Task C4 (shell): Chappy, the language switch and contact.
      "chat",
      "globe",
      "mail",
    ];
    expect([...ICON_NAMES].sort()).toEqual([...expected].sort());
  });

  it("every icon renders filled paths with fill-rule evenodd, and no icon uses a uniform stroke", () => {
    for (const name of ICON_NAMES) {
      const html = renderToString(<Icon name={name} />);
      expect(html, `${name} has no fill=`).toContain('fill="currentColor"');
      expect(html, `${name} has no fill-rule=`).toContain('fill-rule="evenodd"');
      // The old, banned technique: a `stroke` attribute (with or without
      // strokeLinecap="round") drawing a uniform-width line.
      expect(html, `${name} still has a stroke attribute`).not.toMatch(/\sstroke="/);
      expect(html, `${name} still has a stroke-width attribute`).not.toContain("stroke-width");
      expect(html, `${name} still has stroke-linecap`).not.toContain("stroke-linecap");
    }
  });

  it("every icon's outline is a real tapered/curved shape, not a straight-sided uniform box", () => {
    // A tapered brush stroke is built by brush.ts as a polygon of many
    // sampled points (dozens of "L" commands, since width varies point to
    // point) -- a plain stroked rectangle would be ~6 commands. A few icons
    // (pin, spark, flame, leaf) are instead hand-authored solid silhouettes
    // using cubic curves ("C") directly; either shape is "not a uniform
    // box", so a path qualifies by having plenty of commands OR a curve.
    for (const name of ICON_NAMES) {
      const combined = ICON_PATHS[name].paths.join(" ");
      const commandCount = (combined.match(/[MLCZ]/gi) ?? []).length;
      const hasCurve = /c/i.test(combined);
      expect(
        commandCount > 15 || hasCurve,
        `${name} path data looks too simple (${commandCount} path commands, curve=${hasCurve})`,
      ).toBe(true);
    }
  });

  it("the most generic shapes (check, alert, share, gift, menu, close, arrow, chevron) get a distinctive brush treatment, not a plain glyph", () => {
    for (const name of GENERIC_NAMES) {
      const def = ICON_PATHS[name];
      const combined = def.paths.join(" ");
      const commandCount = (combined.match(/[MLCZ]/gi) ?? []).length;
      // A distinctive treatment shows up as either multiple independent
      // strokes/elements (a crossing, a cluster of nodes, a multi-part
      // mark -- possibly several `paths` array entries, or several "M"
      // subpaths combined into one entry, e.g. alert's triangle + knocked-
      // out exclamation) or, for a single continuous stroke (check's one
      // heavy-entry/flicked-exit sweep), enough sampled taper points to
      // actually vary in width along its length.
      const subpathCount = (combined.match(/M/gi) ?? []).length;
      const isMultiPart = def.paths.length > 1 || subpathCount > 1;
      expect(
        isMultiPart || commandCount > 20,
        `${name} does not look distinctive (paths=${def.paths.length}, subpaths=${subpathCount}, commands=${commandCount})`,
      ).toBe(true);
    }
  });
});
