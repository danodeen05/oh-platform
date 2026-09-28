"use client";

/**
 * Task C3 (motion kit). Every primitive in components/site/motion reads
 * this hook and renders its final static state when it's true: no
 * animation-timeline classes doing work, no rAF loops, no drag.
 *
 * Built on useSyncExternalStore rather than useState+useEffect so React
 * itself reconciles the SSR/client mismatch: the server snapshot is always
 * `false` (there's no OS preference on the server), and React re-renders
 * once with the real client value right after hydration instead of
 * throwing a hydration-mismatch warning.
 */
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getMedia(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(QUERY);
}

function subscribe(onChange: () => void): () => void {
  const mql = getMedia();
  if (!mql) return () => {};

  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }

  // Safari < 14 fallback.
  const legacy = mql as unknown as {
    addListener(cb: () => void): void;
    removeListener(cb: () => void): void;
  };
  legacy.addListener(onChange);
  return () => legacy.removeListener(onChange);
}

function getSnapshot(): boolean {
  return getMedia()?.matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
