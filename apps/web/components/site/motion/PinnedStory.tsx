"use client";

/**
 * Task C3 (motion kit): a pinned, multi-screen scroll chapter.
 *
 * The outer element is `screens * 100svh` tall. Its inner content is
 * `position: sticky; top: 0; height: 100svh`, so it stays pinned to the
 * viewport while the outer element scrolls underneath it (native momentum
 * scrolling stays untouched: nothing calls preventDefault or hijacks the
 * wheel/touch events).
 *
 * `--progress` goes from 0 to 1 across that scroll range. Where supported,
 * a CSS `@property --progress` animation on `animation-timeline: view()`
 * (see motion.css) drives it with zero JS on every frame. Where it isn't
 * supported, an rAF-throttled scroll listener computes the same number
 * with `progressFromScroll` and writes it as an inline custom property,
 * which CSS animations always outrank in the cascade, so the two paths
 * never fight once native support lands mid-session (e.g. a browser
 * update while a tab is open).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./motion.css";
import { useReducedMotion } from "./useReducedMotion";

export interface PinnedStoryProps {
  /** How many viewport-heights tall the scroll chapter is. */
  screens: number;
  /** Render prop: receives a CSS value usable in an inline style, e.g. `style={{ opacity: progressVar }}`. */
  children: (progressVar: string) => ReactNode;
  className?: string;
}

/**
 * Clamped scroll progress for a pinned container.
 *
 * @param top - the container's `getBoundingClientRect().top` (px, viewport-relative)
 * @param height - the container's total height (px) -- `screens * viewport`
 * @param viewport - the viewport height (px)
 */
export function progressFromScroll(top: number, height: number, viewport: number): number {
  const distance = height - viewport;
  if (distance <= 0) {
    // No scroll room to scrub through: either already at/past the pin
    // point (done) or hasn't arrived yet.
    return top <= 0 ? 1 : 0;
  }
  const raw = -top / distance;
  if (raw <= 0) return 0; // normalizes -0 to 0 too
  if (raw > 1) return 1;
  return raw;
}

function supportsScrollDrivenAnimations(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline: view()")
  );
}

export function PinnedStory({ screens, children, className }: PinnedStoryProps) {
  const reducedMotion = useReducedMotion();
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    if (supportsScrollDrivenAnimations()) return; // CSS drives --progress natively.

    const node = outerRef.current;
    if (!node) return;

    function measure() {
      rafRef.current = null;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setProgress(progressFromScroll(rect.top, rect.height, window.innerHeight));
    }

    function onScrollOrResize() {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    // Final static state: no pin, no multi-screen spacer, progress at 1.
    return (
      <div
        className={["oh-pinned-story", "oh-pinned-story--static", className].filter(Boolean).join(" ")}
        data-reduced-motion=""
      >
        <div className="oh-pinned-story__sticky">{children("1")}</div>
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      className={["oh-pinned-story", className].filter(Boolean).join(" ")}
      style={{ height: `${screens * 100}svh`, ["--progress" as string]: progress }}
    >
      <div className="oh-pinned-story__sticky">{children("var(--progress)")}</div>
    </div>
  );
}
