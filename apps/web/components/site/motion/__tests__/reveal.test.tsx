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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
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

// Fix round 2: arming used to happen in a passive effect, which runs
// after paint. For an element already in the viewport at mount, that
// painted one frame with data-reveal-armed set but data-in not yet set
// (IntersectionObserver's callback is asynchronous even for an
// already-intersecting element) -- visible, then hidden, then visible
// again. Reveal now arms in a layout effect and does a synchronous
// getBoundingClientRect() check, setting data-in in the very same commit
// as data-reveal-armed when the element already starts on screen.
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  constructor(private callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

describe("Reveal: no armed-but-hidden flash for an already-visible element", () => {
  let container: HTMLDivElement;
  let root: Root;
  let getRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
    // Simulate an element already sitting inside the viewport at mount.
    getRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 200,
      left: 10,
      right: 200,
      width: 190,
      height: 100,
      x: 10,
      y: 100,
      toJSON() {
        return this;
      },
    } as DOMRect);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    getRectSpy.mockRestore();
    delete (globalThis as any).IntersectionObserver;
    vi.restoreAllMocks();
  });

  it("sets data-in in the same commit as data-reveal-armed, without waiting on IntersectionObserver", () => {
    act(() => {
      root.render(createElement(Reveal, { from: "up" }, "Hello"));
    });

    const el = container.querySelector(".oh-reveal");
    expect(el).not.toBeNull();
    // Both attributes land together -- there was no intermediate render
    // with armed=true and in=false for this already-visible element.
    expect(el!.getAttribute("data-reveal-armed")).toBe("true");
    expect(el!.getAttribute("data-in")).toBe("true");
    // And the shortcut path was actually used: no observer was ever
    // constructed, so this isn't just an observer callback that happened
    // to run synchronously in this test environment.
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
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
