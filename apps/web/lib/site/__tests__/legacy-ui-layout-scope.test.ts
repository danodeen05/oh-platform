import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// Task C1 fix round 1: `.legacy-ui` must scope tightly around chrome that
// still needs the retired global element rules (Header/ActiveOrderBanner/
// Footer/the old Chappy mount), never around `{children}` -- otherwise a
// future `(site)` route rendered through this same shared layout would
// silently inherit legacy styling through the DOM tree, even though it never
// opts into `.legacy-ui` itself.

const WEB_ROOT = path.resolve(__dirname, "../../..");

/**
 * Walks `<div ...>`/`</div>` tokens (and `{children}` occurrences) in
 * document order and reports whether any `{children}` sits inside a div
 * whose opening tag includes `className`. Good enough for this repo's
 * layouts, which don't put ">" inside a div's own attributes.
 */
function isChildrenInsideClass(source: string, className: string): boolean {
  const divTokenRe = /<div\b[^>]*>|<\/div>/g;
  const childrenRe = /\{children\}/g;

  const tokens: Array<{ index: number; kind: "open" | "close" | "children"; hasClass?: boolean }> = [];

  let m: RegExpExecArray | null;
  while ((m = divTokenRe.exec(source))) {
    const tag = m[0];
    if (tag.startsWith("</div")) {
      tokens.push({ index: m.index, kind: "close" });
    } else if (!/\/>\s*$/.test(tag)) {
      tokens.push({ index: m.index, kind: "open", hasClass: tag.includes(className) });
    }
  }
  while ((m = childrenRe.exec(source))) {
    tokens.push({ index: m.index, kind: "children" });
  }
  tokens.sort((a, b) => a.index - b.index);

  const openStack: boolean[] = [];
  for (const t of tokens) {
    if (t.kind === "open") {
      openStack.push(!!t.hasClass);
    } else if (t.kind === "close") {
      openStack.pop();
    } else if (openStack.some(Boolean)) {
      return true;
    }
  }
  return false;
}

// Task C4 layout split: the chrome moved out of the shared [locale] layout
// into components/legacy/LegacyChrome.tsx (rendered by the `(legacy)` group
// and the two stay-in-place routes that had it), and `(site)` renders
// SiteShell. The same invariant still holds at each level.
const read = (rel: string) => readFileSync(path.join(WEB_ROOT, rel), "utf8");

describe("app/[locale]/layout.tsx: no chrome, and .legacy-ui does not wrap {children}", () => {
  const source = read("app/[locale]/layout.tsx");

  test("no `{children}` occurrence is nested inside a `.legacy-ui` div", () => {
    expect(isChildrenInsideClass(source, "legacy-ui")).toBe(false);
    expect(source).not.toMatch(/className="legacy-ui"/);
  });

  test("the shared layout no longer renders the legacy chrome", () => {
    expect(source).not.toMatch(/<Header|<Footer|<ActiveOrderBanner/);
  });
});

describe("components/legacy/LegacyChrome.tsx: the chrome is scoped, {children} is not", () => {
  const source = read("components/legacy/LegacyChrome.tsx");

  test("no `{children}` occurrence is nested inside a `.legacy-ui` div", () => {
    expect(isChildrenInsideClass(source, "legacy-ui")).toBe(false);
  });

  test("Header/ActiveOrderBanner/Footer and the old Chappy are scoped under .legacy-ui", () => {
    // Sanity check for the helper itself, and a regression guard.
    expect(source).toMatch(/className="legacy-ui"[\s\S]*?<Header \/>[\s\S]*?<ActiveOrderBanner \/>/);
    expect(source).toMatch(/className="legacy-ui"[\s\S]*?<Footer \/>[\s\S]*?<\/div>/);
    expect(source).toMatch(/className="legacy-ui"[\s\S]*?<LegacyChappy \/>/);
  });

  test("`<main>` renders {children} directly, unscoped", () => {
    expect(source).toMatch(/<main[^>]*>\{children\}<\/main>/);
  });

  test("honors the embed contract", () => {
    expect(source).toMatch(/x-embed/);
  });
});

describe("stay-in-place routes that inherited the chrome keep it", () => {
  test.each(["app/[locale]/agents/layout.tsx", "app/[locale]/kiosk-unauthorized/layout.tsx"])("%s renders LegacyChrome", (rel) => {
    expect(read(rel)).toMatch(/<LegacyChrome>/);
  });
});

describe("the (legacy) group scopes its pages; the (site) group never does", () => {
  test("(legacy) wraps its pages in .legacy-ui inside the legacy chrome", () => {
    const src = read("app/[locale]/(legacy)/layout.tsx");
    expect(src).toMatch(/<LegacyChrome>\s*<div className="legacy-ui">\{children\}<\/div>\s*<\/LegacyChrome>/);
  });

  test("(site) renders SiteShell with no legacy-ui", () => {
    const src = read("app/[locale]/(site)/layout.tsx");
    expect(src).toMatch(/<SiteShell>\{children\}<\/SiteShell>/);
    expect(src).not.toMatch(/className="legacy-ui"/);
    const shell = read("components/site/shell/SiteShell.tsx");
    expect(isChildrenInsideClass(shell, "legacy-ui")).toBe(false);
    expect(shell).toMatch(/x-embed/);
  });
});

describe("routes that stay in place (not moved to (legacy)) scope .legacy-ui in their own layout", () => {
  test.each([
    // Task G2a: the kiosk's client layout moved to KioskLayoutClient.tsx (layout.tsx now only adds Clerk).
    ["kiosk", "app/[locale]/kiosk/KioskLayoutClient.tsx"],
    ["cny", "app/[locale]/cny/layout.tsx"],
    ["agents", "app/[locale]/agents/layout.tsx"],
  ])("%s layout applies legacy-ui somewhere", (_name, relPath) => {
    const src = readFileSync(path.join(WEB_ROOT, relPath), "utf8");
    expect(src).toMatch(/legacy-ui/);
  });
});
