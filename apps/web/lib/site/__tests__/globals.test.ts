import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// Task C1: the legacy element rules (button, input, textarea, a, h1-h6, p)
// must not style the whole document any more. Under the controller's
// ROUTE-GROUP ruling they are scoped under `.legacy-ui` instead of deleted,
// so kiosk, CNY and any not-yet-rebuilt customer route keep their look.
const globalsCss = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Pulls out every selector list that precedes a `{` (works for plain rules
// and for rules nested in @media/@keyframes, since it just walks brace pairs
// left to right), then splits each list on `,` into individual selectors.
function allSelectors(cssText: string): string[] {
  const selectors: string[] = [];
  const re = /([^{}]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText))) {
    for (const raw of m[1].split(",")) {
      const sel = raw.replace(/\s+/g, " ").trim();
      if (sel) selectors.push(sel);
    }
  }
  return selectors;
}

// A selector "bare-matches" a tag name if that tag (or its pseudo-class,
// e.g. `textarea:focus`) is the whole selector and it isn't scoped under
// `.legacy-ui`.
function bareSelectorsFor(selectors: string[], tag: string): string[] {
  const tagRe = new RegExp(`^${tag}\\b`);
  return selectors.filter((sel) => tagRe.test(sel) && !sel.includes(".legacy-ui"));
}

const css = withoutComments(globalsCss);
const selectors = allSelectors(css);

describe("app/globals.css: legacy element rules are scoped, not global", () => {
  test.each(["button", "input", "textarea", "a", "h1", "h2", "h3", "h4", "h5", "h6", "p"])(
    "has no bare `%s` selector",
    (tag) => {
      expect(bareSelectorsFor(selectors, tag)).toEqual([]);
    }
  );

  test("`textarea:focus` specifically is not bare", () => {
    expect(selectors.filter((sel) => sel.startsWith("textarea:focus") && !sel.includes(".legacy-ui"))).toEqual([]);
  });

  test("the rules still exist, scoped under .legacy-ui (nothing was silently deleted)", () => {
    for (const tag of ["button", "input", "textarea", "a", "h1", "p"]) {
      expect(selectors.some((sel) => sel.includes(".legacy-ui") && new RegExp(`\\b${tag}\\b`).test(sel))).toBe(true);
    }
    expect(selectors.some((sel) => sel.includes(".legacy-ui") && sel.includes("textarea:focus"))).toBe(true);
  });

  test("scopes with :where() so specificity matches the old unscoped rules", () => {
    const scoped = selectors.filter((sel) => sel.includes("legacy-ui"));
    expect(scoped.length).toBeGreaterThan(0);
    for (const sel of scoped) {
      expect(sel).toMatch(/:where\(\.legacy-ui\)/);
    }
  });

  test("declares the new linen token", () => {
    expect(css).toMatch(/--color-oh-linen:\s*#EDE6DA/i);
  });
});
