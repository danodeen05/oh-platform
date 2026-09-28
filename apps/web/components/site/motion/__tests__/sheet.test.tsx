// @vitest-environment jsdom
//
// Task C3 (motion kit): Sheet accessibility TDD.
//
// Sheet must be keyboard- and screen-reader-safe: role="dialog" with
// aria-modal, a focus trap that wraps Tab/Shift+Tab at its edges, Esc to
// close, and focus returned to whatever opened it once it closes.
//
// Reduced motion is mocked "on" for these tests: with framer-motion's
// enter/exit animations skipped (see Sheet.tsx), AnimatePresence unmounts
// the panel synchronously, which keeps this test about a11y wiring rather
// than animation timing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Sheet } from "../Sheet";

function mockReducedMotion() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as any;
}

// jsdom has no requestAnimationFrame; framer-motion's drag controls touch it
// even when `drag={false}`, so give it a synchronous-ish stand-in.
function polyfillRaf() {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

function Harness({ onCloseSpy }: { onCloseSpy: () => void }) {
  const [open, setOpen] = useState(false);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { id: "opener", onClick: () => setOpen(true) },
      "Open"
    ),
    createElement(
      Sheet,
      {
        open,
        onClose: () => {
          onCloseSpy();
          setOpen(false);
        },
        label: "Order details",
        children: [
          createElement("button", { id: "first", key: "first" }, "First"),
          createElement("button", { id: "second", key: "second" }, "Second"),
        ],
      }
    )
  );
}

describe("Sheet accessibility", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockReducedMotion();
    polyfillRaf();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function openSheet(onCloseSpy: () => void) {
    act(() => {
      root.render(createElement(Harness, { onCloseSpy }));
    });
    const opener = document.getElementById("opener") as HTMLButtonElement;
    act(() => {
      opener.focus();
      opener.click();
    });
  }

  it("renders nothing while closed", () => {
    act(() => {
      root.render(createElement(Harness, { onCloseSpy: () => {} }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("exposes role=dialog, aria-modal and the label when open", () => {
    openSheet(() => {});
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-label")).toBe("Order details");
  });

  it("moves focus into the panel on open", () => {
    openSheet(() => {});
    const first = document.getElementById("first");
    expect(document.activeElement).toBe(first);
  });

  it("traps Tab so it wraps from the last focusable element to the first", () => {
    openSheet(() => {});
    const second = document.getElementById("second") as HTMLButtonElement;
    act(() => {
      second.focus();
    });
    expect(document.activeElement).toBe(second);

    act(() => {
      second.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })
      );
    });

    expect(document.activeElement).toBe(document.getElementById("first"));
  });

  it("traps Shift+Tab so it wraps from the first focusable element to the last", () => {
    openSheet(() => {});
    const first = document.getElementById("first") as HTMLButtonElement;
    expect(document.activeElement).toBe(first);

    act(() => {
      first.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(document.activeElement).toBe(document.getElementById("second"));
  });

  it("calls onClose when Escape is pressed", () => {
    const onCloseSpy = vi.fn();
    openSheet(onCloseSpy);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      );
    });

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the opener once closed", () => {
    const onCloseSpy = vi.fn();
    openSheet(onCloseSpy);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      );
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("opener"));
  });
});
