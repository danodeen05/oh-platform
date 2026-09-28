"use client";

/**
 * Task D7: the JS fallback for rewards.css's scroll-driven custom
 * properties, for browsers without `animation-timeline: view()`.
 *
 * `measure(rect, viewportHeight)` returns the custom properties to write on
 * the element each frame. Nothing runs where native support exists, under
 * reduced motion, or while the element is off screen (an
 * IntersectionObserver gates the rAF-throttled scroll listener), the same
 * pattern as the motion kit's ParallaxLayer.
 */
import { useEffect, type RefObject } from "react";

export function supportsViewTimeline(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline: view()");
}

export function clamp01(n: number): number {
  return n <= 0 ? 0 : n >= 1 ? 1 : n;
}

/** Progress through a `cover a% cover b%` view range, 0..1, like the CSS timeline. */
export function coverProgress(rect: { top: number; height: number }, viewport: number, from: number, to: number): number {
  const total = viewport + rect.height;
  if (total <= 0) return 1;
  const cover = (viewport - rect.top) / total;
  return clamp01((cover - from) / (to - from));
}

export function useScrollVars(
  ref: RefObject<HTMLElement | null>,
  measure: (el: HTMLElement, viewport: number) => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || supportsViewTimeline()) return;
    const node = ref.current;
    if (!node) return;

    let active = false;
    let raf: number | null = null;
    const run = () => {
      raf = null;
      if (active) measure(node, window.innerHeight);
    };
    const onScroll = () => {
      if (raf == null) raf = requestAnimationFrame(run);
    };
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            for (const entry of entries) {
              active = entry.isIntersecting;
              if (active) onScroll();
            }
          })
        : null;
    if (observer) observer.observe(node);
    else {
      active = true;
      onScroll();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
    // `measure` is a stable module-level function at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, enabled]);
}
