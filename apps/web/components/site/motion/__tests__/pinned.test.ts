// @vitest-environment jsdom
//
// Task C3 (motion kit): pure-helper TDD.
//
// progressFromScroll(top, height, viewport) is the rAF-fallback math behind
// PinnedStory's --progress custom property, used when the browser doesn't
// support `animation-timeline: view()/scroll()`. It must clamp to [0, 1]
// and handle the "no scroll room" edge case (height <= viewport) without
// dividing by zero or going negative/over 1.
//
// useReducedMotion() must read `prefers-reduced-motion` via matchMedia and
// react to changes, so every primitive can render its final static state.
import { describe, expect, it, vi, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { progressFromScroll } from "../PinnedStory";
import { useReducedMotion } from "../useReducedMotion";

// This file stays .ts (not .tsx) per the brief's file list, so component
// probes are built with createElement rather than JSX syntax.

describe("progressFromScroll", () => {
  it("is 0 before the pinned container reaches the top of the viewport", () => {
    expect(progressFromScroll(120, 3000, 800)).toBe(0);
  });

  it("is 0 exactly at the moment the container's top hits the viewport top", () => {
    expect(progressFromScroll(0, 3000, 800)).toBe(0);
  });

  it("is 0.5 halfway through the scrollable distance", () => {
    // distance = height - viewport = 3000 - 800 = 2200
    expect(progressFromScroll(-1100, 3000, 800)).toBeCloseTo(0.5, 5);
  });

  it("is 1 exactly at the end of the scrollable distance", () => {
    expect(progressFromScroll(-2200, 3000, 800)).toBe(1);
  });

  it("clamps to 1 when scrolled past the end (overshoot)", () => {
    expect(progressFromScroll(-5000, 3000, 800)).toBe(1);
  });

  it("clamps to 0 when the container hasn't started scrolling (large positive top)", () => {
    expect(progressFromScroll(9999, 3000, 800)).toBe(0);
  });

  it("returns 1 when there's no scroll room and the container is at/above the viewport top", () => {
    // height <= viewport: nothing to scrub through, so once its top is at
    // or above 0 it should read as "done" rather than throw or divide by 0.
    expect(progressFromScroll(0, 400, 800)).toBe(1);
    expect(progressFromScroll(-10, 400, 800)).toBe(1);
  });

  it("returns 0 when there's no scroll room and the container hasn't arrived yet", () => {
    expect(progressFromScroll(50, 400, 800)).toBe(0);
  });

  it("returns 1 when height exactly equals viewport (distance is 0) and top is 0", () => {
    expect(progressFromScroll(0, 800, 800)).toBe(1);
  });
});

// --- useReducedMotion -------------------------------------------------

type Listener = () => void;

/**
 * Installs a fake matchMedia whose `matches` can be flipped after the fact,
 * notifying subscribers the way a real MediaQueryList would.
 */
function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  const mql: Partial<MediaQueryList> & { matches: boolean } = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_type: string, cb: any) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: any) => {
      listeners.delete(cb);
    },
  };
  Object.defineProperty(mql, "matches", {
    get: () => matches,
  });
  window.matchMedia = vi.fn().mockImplementation(() => mql) as any;
  return {
    set(next: boolean) {
      matches = next;
      for (const cb of listeners) cb();
    },
  };
}

function Probe({ onRender }: { onRender: (value: boolean) => void }) {
  const reduced = useReducedMotion();
  onRender(reduced);
  return null;
}

function renderProbe(onRender: (value: boolean) => void) {
  return createElement(Probe, { onRender });
}

describe("useReducedMotion", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    if (container) container.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  it("returns true when prefers-reduced-motion matches", () => {
    installMatchMedia(true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const values: boolean[] = [];
    act(() => {
      root!.render(renderProbe((v) => values.push(v)));
    });

    expect(values[values.length - 1]).toBe(true);
  });

  it("returns false when prefers-reduced-motion does not match", () => {
    installMatchMedia(false);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const values: boolean[] = [];
    act(() => {
      root!.render(renderProbe((v) => values.push(v)));
    });

    expect(values[values.length - 1]).toBe(false);
  });

  it("reacts to a change event fired after mount", () => {
    const media = installMatchMedia(false);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const values: boolean[] = [];
    act(() => {
      root!.render(renderProbe((v) => values.push(v)));
    });
    expect(values[values.length - 1]).toBe(false);

    act(() => {
      media.set(true);
    });

    expect(values[values.length - 1]).toBe(true);
  });
});
