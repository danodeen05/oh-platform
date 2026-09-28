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
 *
 * Arming runs in an isomorphic layout effect (useLayoutEffect on the
 * client, a no-op on the server), not a passive effect. A passive effect
 * runs *after* the browser paints, so for an element already in the
 * viewport at mount, arming there would paint one frame with
 * `data-reveal-armed` set but `data-in` not yet set (IntersectionObserver
 * callbacks are asynchronous even for an already-intersecting element) --
 * visible, then hidden, then visible again once the observer catches up.
 * The layout effect instead does a synchronous `getBoundingClientRect()`
 * check and, if the element is already on screen, sets `data-in` in the
 * very same commit as `data-reveal-armed`, so that hidden frame never
 * happens. Only an element that starts off-screen ever actually goes
 * through a hidden state, which is the intended reveal-on-scroll effect.
 */
import { useEffect, useLayoutEffect, useRef, useState, createElement, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import "./motion.css";
import { useReducedMotion } from "./useReducedMotion";

// useLayoutEffect warns ("does nothing on the server") when it runs during
// SSR; swap to useEffect there, where the arming logic is a no-op anyway
// since it never runs until the client mounts.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;

    // Both state updates below happen synchronously in this one layout
    // effect call, so React commits them together in a single pass before
    // the browser paints -- there is no intermediate "armed but hidden"
    // frame for an element that's already visible.
    setArmed(true);

    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const rect = node.getBoundingClientRect();
    const alreadyInViewport =
      rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    if (alreadyInViewport) {
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
