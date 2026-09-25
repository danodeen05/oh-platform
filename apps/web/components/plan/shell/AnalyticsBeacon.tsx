"use client";

import { useEffect } from "react";
import { isSectionKey } from "@/lib/plan/sections";

const FLUSH_MS = 15_000;
const TICK_MS = 1_000;

interface Bucket {
  seconds: number;
  interactions: number;
}

/**
 * Section dwell tracking (spec 4.5). Renders nothing.
 *
 * Every second, one visible `[data-section]` (the one covering the most of
 * the viewport) earns a second, so totals never double count. Pointer and
 * key events are credited to the section they happened in. Buckets flush
 * to /api/plan/heartbeat every 15 s and when the tab hides or unloads, via
 * sendBeacon so the last flush survives navigation. The session id comes
 * from the cookie server-side; nothing identifying is sent from here.
 */
export function AnalyticsBeacon() {
  useEffect(() => {
    const ratios = new Map<string, number>();
    const buckets = new Map<string, Bucket>();

    const bucket = (key: string): Bucket => {
      let b = buckets.get(key);
      if (!b) {
        b = { seconds: 0, interactions: 0 };
        buckets.set(key, b);
      }
      return b;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const key = (e.target as HTMLElement).dataset.section;
          if (!key) continue;
          if (e.isIntersecting) ratios.set(key, e.intersectionRatio);
          else ratios.delete(key);
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );

    const observeAll = (): void => {
      document.querySelectorAll<HTMLElement>("[data-section]").forEach((el) => observer.observe(el));
    };
    observeAll();
    // Client-side navigations swap sections without remounting this leaf.
    const mutations = new MutationObserver(observeAll);
    mutations.observe(document.body, { childList: true, subtree: true });

    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      let best: string | null = null;
      let bestRatio = 0;
      for (const [key, ratio] of ratios) {
        if (ratio > bestRatio) {
          best = key;
          bestRatio = ratio;
        }
      }
      if (best && isSectionKey(best)) bucket(best).seconds += TICK_MS / 1000;
    }, TICK_MS);

    const onInteract = (ev: Event): void => {
      const target = ev.target as Element | null;
      const key = target?.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (key && isSectionKey(key)) bucket(key).interactions += 1;
    };
    document.addEventListener("pointerdown", onInteract, { passive: true });
    document.addEventListener("keydown", onInteract, { passive: true });
    document.addEventListener("input", onInteract, { passive: true });

    const flush = (): void => {
      for (const [sectionKey, b] of buckets) {
        if (b.seconds === 0 && b.interactions === 0) continue;
        const body = JSON.stringify({ sectionKey, seconds: Math.round(b.seconds), interactions: b.interactions });
        b.seconds = 0;
        b.interactions = 0;
        if (!navigator.sendBeacon?.("/api/plan/heartbeat", body)) {
          void fetch("/api/plan/heartbeat", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } });
        }
      }
    };
    const flusher = window.setInterval(flush, FLUSH_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(flusher);
      observer.disconnect();
      mutations.disconnect();
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("keydown", onInteract);
      document.removeEventListener("input", onInteract);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return null;
}
