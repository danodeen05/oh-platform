import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Icon, ICON_NAMES, type IconName } from "../icons/Icon";
import { ICON_PATHS } from "../icons/paths";

// Icon is a server-safe component (no hooks), so renderToString works with
// no providers or DOM at all, the same as SitePicture's tests.

describe("Icon", () => {
  it("renders an <svg> with the 24px grid and 1.5px stroke", () => {
    const html = renderToString(<Icon name="bowl" />);
    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke-width="1.5"');
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
      expect(ICON_PATHS[name], `missing path data for "${name}"`).toBeTruthy();
      const html = renderToString(<Icon name={name} />);
      expect(html).toContain("<svg");
      expect(html).toContain("<path");
    }
  });

  it("draws a tapered end for every icon via a second, thinner path", () => {
    for (const name of ICON_NAMES) {
      const def = ICON_PATHS[name];
      expect(def.taper, `missing taper path for "${name}"`).toBeTruthy();
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
    ];
    expect([...ICON_NAMES].sort()).toEqual([...expected].sort());
  });
});
