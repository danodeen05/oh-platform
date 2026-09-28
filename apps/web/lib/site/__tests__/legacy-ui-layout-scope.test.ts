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

describe("app/[locale]/layout.tsx: .legacy-ui does not wrap {children}", () => {
  const source = readFileSync(path.join(WEB_ROOT, "app/[locale]/layout.tsx"), "utf8");

  test("no `{children}` occurrence is nested inside a `.legacy-ui` div", () => {
    expect(isChildrenInsideClass(source, "legacy-ui")).toBe(false);
  });

  test("the shared chrome (Header/ActiveOrderBanner/Footer) is still scoped under .legacy-ui", () => {
    // Sanity check for the helper itself, and a regression guard: the fix
    // must not have removed the scoping, only narrowed it.
    expect(source).toMatch(/className="legacy-ui"[\s\S]*?<Header \/>/);
    expect(source).toMatch(/<Footer \/>[\s\S]*?<\/div>/);
    expect((source.match(/className="legacy-ui"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test("`<main>` renders {children} directly, unscoped", () => {
    expect(source).toMatch(/<main[^>]*>\{children\}<\/main>/);
  });
});

describe("routes that stay in place (not moved to (legacy)) scope .legacy-ui in their own layout", () => {
  test.each([
    ["kiosk", "app/[locale]/kiosk/layout.tsx"],
    ["cny", "app/[locale]/cny/layout.tsx"],
    ["agents", "app/[locale]/agents/layout.tsx"],
  ])("%s layout applies legacy-ui somewhere", (_name, relPath) => {
    const src = readFileSync(path.join(WEB_ROOT, relPath), "utf8");
    expect(src).toMatch(/legacy-ui/);
  });
});
