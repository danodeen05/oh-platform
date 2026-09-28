"use client";

/**
 * Task C3 (motion kit): a background/foreground layer that drifts slightly
 * against the page's scroll.
 *
 * Native-first: where `animation-timeline: scroll()` is supported,
 * motion.css drives `--oh-parallax-shift` (a registered `<length>` custom
 * property) purely in CSS, tied to the nearest scroller's scroll position.
 * Elsewhere, an IntersectionObserver-gated, rAF-throttled scroll listener
 * computes the same custom property from the element's position relative
 * to the viewport center. CSS animation values outrank inline styles in
 * the cascade, so when both are present the native one simply wins.
 *
 * Reduced motion renders flat: no shift, no listener.
 */
import { useEffect, useRef, type ReactNode } from "react";
import "./motion.css";
import { useReducedMotion } from "./useReducedMotion";

export interface ParallaxLayerProps {
  children: ReactNode;
  /** Relative drift strength; 0 disables it, negative moves opposite to scroll. */
  speed?: number;
  /** Max drift distance in px at the edge of its travel. */
  offset?: number;
  className?: string;
}

function supportsScrollTimeline(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline: scroll()")
  );
}

export function ParallaxLayer({ children, speed = 0.3, offset = 40, className }: ParallaxLayerProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) return;
    if (supportsScrollTimeline()) return; // CSS drives --oh-parallax-shift natively.

    const node = ref.current;
    if (!node) return;

    function measure() {
      rafRef.current = null;
      if (!activeRef.current || !node) return;
      const rect = node.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const distanceFromCenter = rect.top + rect.height / 2 - viewportCenter;
      const ratio = viewportCenter > 0 ? Math.max(-1, Math.min(1, distanceFromCenter / viewportCenter)) : 0;
      node.style.setProperty("--oh-parallax-shift", `${(-ratio * offset * speed).toFixed(2)}px`);
    }

    function onScroll() {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(measure);
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        activeRef.current = entry.isIntersecting;
        if (activeRef.current) onScroll();
      }
    });
    observer.observe(node);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, speed, offset]);

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={["oh-parallax", className].filter(Boolean).join(" ")}
      style={{ ["--oh-parallax-offset" as string]: `${offset}px` }}
    >
      {children}
    </div>
  );
}
