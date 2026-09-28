"use client";

/**
 * Task C3 (motion kit): counts up to a number once it scrolls into view.
 *
 * There's no reliable cross-browser way to animate visible text content
 * purely with CSS, so this always uses a short rAF loop, gated by an
 * IntersectionObserver so it only ever runs once, starting when the
 * element becomes visible.
 *
 * Reduced motion renders the final `to` value immediately, no counting.
 */
import { createElement, useEffect, useRef, useState, type ElementType } from "react";
import "./motion.css";
import { useReducedMotion } from "./useReducedMotion";

export interface CountUpProps {
  to: number;
  from?: number;
  /** Animation duration in ms. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  as?: ElementType;
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUp({
  to,
  from = 0,
  duration = 1200,
  decimals = 0,
  prefix = "",
  suffix = "",
  as = "span",
  className,
}: CountUpProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (reducedMotion) {
      setValue(to);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setValue(to);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || startedRef.current) continue;
          startedRef.current = true;
          observer.disconnect();
          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = now - start;
            const t = duration > 0 ? Math.min(1, elapsed / duration) : 1;
            setValue(from + (to - from) * easeOutCubic(t));
            if (t < 1) {
              rafRef.current = requestAnimationFrame(tick);
            }
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, to, from, duration]);

  const display = `${prefix}${value.toFixed(decimals)}${suffix}`;

  return createElement(as, { ref, className: ["oh-count-up", className].filter(Boolean).join(" ") }, display);
}
