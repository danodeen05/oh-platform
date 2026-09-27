"use client";

import { useEffect } from "react";
import { isSectionKey } from "@/lib/plan/sections";

const FLUSH_MS = 15_000;
const TICK_MS = 1_000;

const TARGET_MAX_LEN = 40;
const TARGETS_PER_FLUSH = 20;

interface Bucket {
  seconds: number;
  interactions: number;
  targets: Map<string, number>;
}

/**
 * A short human label for the control a reader touched, so the owner's
 * summary can say "moved the rent slider" instead of "12 interactions".
 * An explicit data-plan-track wins, then aria-label, the associated
 * <label>, and finally the control's own text.
 */
export function targetLabel(target: Element | null): string | null {
  const el = target?.closest<HTMLElement>("[data-plan-track], button, a, input, select, textarea, [role=slider], [role=tab], [role=switch], summary, label");
  if (!el) return null;
  const tracked = el.closest<HTMLElement>("[data-plan-track]")?.dataset.planTrack;
  let text = tracked || el.getAttribute("aria-label") || "";
  if (!text && "labels" in el) {
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels[0]) text = labels[0].textContent ?? "";
  }
  if (!text && el.id) text = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent ?? "";
  if (!text && el.getAttribute("aria-labelledby")) text = document.getElementById(el.getAttribute("aria-labelledby")!)?.textContent ?? "";
  if (!text && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) text = el.textContent ?? "";
  const clean = text.replace(/\s+/g, " ").trim().slice(0, TARGET_MAX_LEN);
  return clean || null;
}

/**
 * Section dwell tracking (spec 4.5). Renders nothing.
 *
 * Every second, one visible `[data-section]` (the one covering the most of
 * the viewport) earns a second, so totals never double count. Pointer and
 * key events are credited to the section they happened in, along with a
 * short label of the control touched (see targetLabel). Buckets flush
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
        b = { seconds: 0, interactions: 0, targets: new Map() };
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
      // Shell chrome (header, palette, ask dialog, bottom bar) is not reading the plan.
      if (target?.closest("[data-plan-shell]")) return;
      const key = target?.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (!key || !isSectionKey(key)) return;
      const b = bucket(key);
      b.interactions += 1;
      // Key presses inside a field are typing, not a new control; count the field once per flush.
      const label = targetLabel(target);
      if (label && (b.targets.has(label) || b.targets.size < TARGETS_PER_FLUSH)) {
        if ((ev.type === "keydown" || ev.type === "input") && b.targets.has(label)) return;
        b.targets.set(label, (b.targets.get(label) ?? 0) + 1);
      }
    };
    document.addEventListener("pointerdown", onInteract, { passive: true });
    document.addEventListener("keydown", onInteract, { passive: true });
    document.addEventListener("input", onInteract, { passive: true });

    const flush = (): void => {
      for (const [sectionKey, b] of buckets) {
        if (b.seconds === 0 && b.interactions === 0) continue;
        const targets = b.targets.size ? Object.fromEntries(b.targets) : undefined;
        const body = JSON.stringify({ sectionKey, seconds: Math.round(b.seconds), interactions: b.interactions, targets });
        b.seconds = 0;
        b.interactions = 0;
        b.targets.clear();
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
