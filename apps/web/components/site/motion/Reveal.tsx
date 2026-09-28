"use client";

/**
 * Task C3 (motion kit): reveal-on-scroll for any element.
 *
 * `.oh-reveal` (motion.css) does the actual animating with
 * `animation-timeline: view(); animation-range: entry 0% cover 30%` inside
 * `@supports (animation-timeline: view())`. Where that isn't supported, the
 * same class has a `@supports not (...)` fallback keyed off `data-in`,
 * which this component's IntersectionObserver toggles. Both rules can
 * exist in the stylesheet at once without fighting: only one `@supports`
 * block is ever active in a given browser.
 *
 * The fallback's hidden starting state (`opacity: 0`) only ever applies
 * once `data-reveal-armed="true"` is present, which this component sets
 * itself right when its effect first runs. Server-rendered (or hydration-
 * never-happens) HTML never gets that attribute, so if JS doesn't execute
 * at all, the element is never hidden in the first place: there'd be
 * nothing left to un-hide it. Only a browser that both lacks native
 * `animation-timeline` support *and* has successfully run this component's
 * effect gets the hide-then-reveal treatment.
 *
 * Reduced motion renders the final static state directly (no animation
 * class, no observer): opacity 1, no transform.
 */
import { useEffect, useRef, useState, createElement, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import "./motion.css";
import { useReducedMotion } from "./useReducedMotion";

export type RevealFrom = "up" | "fade" | "scale";

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Extra delay (ms) before the fallback transition starts. Ignored by the native CSS path (view() timelines aren't delayable the same way). */
  delay?: number;
  from?: RevealFrom;
  children?: ReactNode;
}

export function Reveal({ as = "div", delay = 0, from = "up", children, className, style, ...rest }: RevealProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  // Only true once this effect has actually run on the client. Gates the
  // fallback CSS's hidden starting state, so SSR/no-JS output is never
  // stuck invisible (see file header comment).
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    setArmed(true);
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  if (reducedMotion) {
    return createElement(
      as,
      { ...rest, className, style: { ...style, opacity: 1, transform: "none" } },
      children
    );
  }

  return createElement(
    as,
    {
      ...rest,
      ref,
      className: ["oh-reveal", `oh-reveal--${from}`, className].filter(Boolean).join(" "),
      "data-in": inView ? "true" : "false",
      "data-reveal-armed": armed ? "true" : undefined,
      style: { ...style, ["--oh-reveal-delay" as string]: `${delay}ms` },
    },
    children
  );
}
