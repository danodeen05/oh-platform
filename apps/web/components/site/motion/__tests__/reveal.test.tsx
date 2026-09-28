// @vitest-environment jsdom
//
// Task C3 fix round 1: the fallback CSS's hidden starting state
// (`.oh-reveal { opacity: 0 }`) must not apply when JS never runs at all
// (blocked/failed script, hydration never happens) -- otherwise
// server-rendered content would be stuck invisible forever, since nothing
// would ever be left to set opacity back to 1.
//
// Reveal.tsx only sets `data-reveal-armed="true"` from its own effect, so
// it's absent from server-rendered HTML. This test renders the real
// server HTML with `renderToString` and checks that attribute isn't
// there, then checks motion.css's fallback block actually requires it
// before hiding anything (so the component-side guarantee lines up with
// what the stylesheet does).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Reveal } from "../Reveal";

describe("Reveal SSR / no-JS safety", () => {
  it("server-rendered HTML is not marked armed, and is not hidden inline", () => {
    const html = renderToString(createElement(Reveal, { from: "up" }, "Hello"));

    expect(html).toContain("oh-reveal");
    expect(html).toContain("Hello");
    expect(html).not.toContain("data-reveal-armed");
    // No inline opacity:0 -- whatever hiding exists lives in the
    // stylesheet, gated as asserted below, not baked into the markup.
    expect(html).not.toMatch(/style="[^"]*opacity:\s*0/);
  });

  it("motion.css only hides .oh-reveal once data-reveal-armed=\"true\" is set, never unconditionally", () => {
    const css = readFileSync(path.resolve(__dirname, "../motion.css"), "utf8");
    const block = extractBlockAfter(css, "@supports not (animation-timeline: view())");

    // The bare, unconditional selector must never carry the hidden state.
    expect(block).not.toMatch(/(^|\s)\.oh-reveal\s*\{[^}]*opacity:\s*0/);
    // Hiding is scoped to the armed-but-not-yet-in-view state.
    expect(block).toMatch(/\.oh-reveal\[data-reveal-armed="true"\]:not\(\[data-in="true"\]\)\s*\{[^}]*opacity:\s*0/);
  });
});

/** Finds `needle` in `css` and returns the contents of the brace block that starts right after it (balanced, so nested rules inside don't confuse it). */
function extractBlockAfter(css: string, needle: string): string {
  const needleIndex = css.indexOf(needle);
  if (needleIndex === -1) throw new Error(`"${needle}" not found in CSS`);
  const openIndex = css.indexOf("{", needleIndex);
  let depth = 0;
  for (let i = openIndex; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(openIndex + 1, i);
    }
  }
  throw new Error(`Unbalanced braces after "${needle}"`);
}
