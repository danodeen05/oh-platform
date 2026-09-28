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
 *
 * Once it has counted, a new `to` (a live total, e.g. the rewards
 * simulator) counts from the value on screen to the new one, straight away:
 * the element is already in view, so there's nothing to wait for.
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
  /** Formats the ticking value for display (e.g. localized money); overrides decimals/prefix/suffix. */
  format?: (value: number) => string;
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
  format,
  as = "span",
  className,
}: CountUpProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [value, setValue] = useState(from);
  const valueRef = useRef(from);

  useEffect(() => {
    if (reducedMotion) {
      valueRef.current = to;
      setValue(to);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      valueRef.current = to;
      setValue(to);
      return;
    }

    const run = (startValue: number) => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const t = duration > 0 ? Math.min(1, elapsed / duration) : 1;
        const next = startValue + (to - startValue) * easeOutCubic(t);
        valueRef.current = next;
        setValue(next);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (startedRef.current) {
      // Already counted once: go from what's on screen to the new target.
      run(valueRef.current);
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || startedRef.current) continue;
          startedRef.current = true;
          observer.disconnect();
          run(from);
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

  const display = format ? format(value) : `${prefix}${value.toFixed(decimals)}${suffix}`;

  return createElement(as, { ref, className: ["oh-count-up", className].filter(Boolean).join(" ") }, display);
}
