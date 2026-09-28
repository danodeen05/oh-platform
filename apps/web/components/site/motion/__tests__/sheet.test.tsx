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
    // The body-scroll-lock cleanup (Sheet.tsx) calls window.scrollTo on
    // close/unmount; jsdom doesn't implement it and logs a console error
    // otherwise. These tests aren't about the lock, so just stub it quiet.
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.style.position = "";
    document.body.style.top = "";
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

// Follow-up D: a transformed ancestor (the order flow's .oh-step-in entrance
// animation) became the containing block of the sheet's position: fixed and
// trapped its z-index under the top bar. The sheet renders through a portal
// into the site shell's root (or <body> outside the shell), never in place.
describe("Sheet portal", () => {
  let shell: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockReducedMotion();
    polyfillRaf();
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    act(() => root.unmount());
    shell?.remove();
    document.body.style.position = "";
    document.body.style.top = "";
    vi.restoreAllMocks();
  });

  function renderInside(host: HTMLElement) {
    const transformed = document.createElement("div");
    transformed.className = "oh-step-in";
    transformed.style.transform = "translateY(12px)";
    host.appendChild(transformed);
    root = createRoot(transformed);
    act(() => {
      root.render(createElement(Sheet, { open: true, onClose: () => {}, label: "Pods", children: createElement("button", null, "Pick") }));
    });
    return transformed;
  }

  it("renders into the site shell's root, not inside a transformed ancestor", () => {
    shell = document.createElement("div");
    shell.setAttribute("data-site-shell", "full");
    document.body.appendChild(shell);
    const transformed = renderInside(shell);
    const sheetRoot = document.querySelector(".oh-sheet-root");
    expect(sheetRoot).not.toBeNull();
    expect(transformed.contains(sheetRoot)).toBe(false);
    expect(sheetRoot!.parentElement).toBe(shell);
    expect(document.activeElement?.textContent).toBe("Pick");
  });

  it("falls back to <body> outside the site shell", () => {
    shell = document.createElement("div");
    document.body.appendChild(shell);
    const transformed = renderInside(shell);
    const sheetRoot = document.querySelector(".oh-sheet-root");
    expect(transformed.contains(sheetRoot)).toBe(false);
    expect(sheetRoot!.parentElement).toBe(document.body);
  });
});

// Fix round 1: iOS has no reliable "overflow: hidden on body" scroll lock,
// so Sheet pins the body with position: fixed at its negated scrollY and
// restores that scroll position on close. The lock is ref-counted at
// module scope so a still-open (e.g. nested) sheet keeps the page pinned
// even after another sheet closes.
describe("Sheet body scroll lock", () => {
  let container: HTMLDivElement;
  let root: Root;
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReducedMotion();
    polyfillRaf();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    document.body.style.position = "";
    document.body.style.top = "";
    scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.style.position = "";
    document.body.style.top = "";
    vi.restoreAllMocks();
  });

  function sheet(open: boolean, label: string) {
    return createElement(Sheet, { open, onClose: () => {}, label, children: createElement("p", null, "content") });
  }

  it("locks the body while open", () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(240);

    act(() => {
      root.render(sheet(true, "One"));
    });

    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-240px");
  });

  it("restores the saved scroll position on close", () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(240);

    act(() => {
      root.render(sheet(true, "One"));
    });
    act(() => {
      root.render(sheet(false, "One"));
    });

    expect(document.body.style.position).toBe("");
    expect(scrollToSpy).toHaveBeenCalledWith(0, 240);
  });

  it("keeps the lock when two sheets are open and only one closes", () => {
    function TwoSheets({ innerOpen }: { innerOpen: boolean }) {
      return createElement(
        "div",
        null,
        sheet(true, "Outer"),
        createElement(Sheet, {
          open: innerOpen,
          onClose: () => {},
          label: "Inner",
          children: createElement("p", null, "inner"),
        })
      );
    }

    act(() => {
      root.render(createElement(TwoSheets, { innerOpen: true }));
    });
    expect(document.body.style.position).toBe("fixed");

    // Close only the inner sheet -- the outer one is still open, so the
    // lock must not be released yet.
    act(() => {
      root.render(createElement(TwoSheets, { innerOpen: false }));
    });
    expect(document.body.style.position).toBe("fixed");
    expect(scrollToSpy).not.toHaveBeenCalled();

    // Now close (unmount) the outer one too: the lock releases.
    act(() => {
      root.render(createElement("div"));
    });
    expect(document.body.style.position).toBe("");
  });
});
