"use client";

/**
 * Task D2: the pinned journey map. City Creek's real comb layout
 * (`CombMap mode="journey"`, `buildLayout(LOCATION_LAYOUTS["comb-75"])`),
 * with the guest dot and the bowl dot following the step on screen.
 *
 * - Which step is on screen: an IntersectionObserver on the page's
 *   `[data-step]` sections, against a line across the middle of the
 *   viewport. The steps themselves stay server-rendered.
 * - Where that step puts the dots: `stepProgress()` (lib/site/experience-progress,
 *   computed on the server and passed in as `progress`), a progress on the floor-plan package's own journey timeline, so the dots
 *   only ever travel along the layout's paths (entry, kiosk, cross-aisle,
 *   aisle, seat; kitchen, corridor, hatch; aisle, store, exit).
 * - Motion: a requestAnimationFrame tween from the current progress to the
 *   step's, eased, longer for longer trips. Scrolling back runs the path
 *   backwards. Reduced motion jumps straight to the step.
 * - Phones: a small card pinned to the top right of the steps (the parent
 *   makes it sticky). Desktop: a full panel in the right column with the
 *   step's caption and a stepper that scrolls to each step.
 *
 * Copy comes in as props (resolved on the server), so this island adds
 * nothing to the (site) client message scope.
 *
 * Budget: CombMap and the geometry behind it (`@oh/floor-plan`, which reads
 * the plan model's base assumptions) are about 30 KB of gzipped JS. They load
 * as a separate chunk after the page's load event (at idle), or at once on
 * the first scroll, so they stay out of the 170 KB first load. Until then
 * the card holds its exact size with an empty floor.
 */
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { CombMapLabels, CombMapProps } from "@/components/site/floor-plan/CombMap";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { easeInOut, EXPERIENCE_LAYOUT, EXPERIENCE_STEPS, tweenMs, type ExperienceStep } from "@/lib/site/experience";

/** Resolves once the page has loaded and gone idle, or on the first scroll, whichever is first. */
function useAfterLoad(): boolean {
  const [go, setGo] = useState(false);
  useEffect(() => {
    let done = false;
    let idleId: number | undefined;
    const fire = () => {
      if (done) return;
      done = true;
      setGo(true);
    };
    const idle = () => {
      // Safari has no requestIdleCallback.
      idleId = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fire, { timeout: 1200 }) : window.setTimeout(fire, 200);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    window.addEventListener("scroll", fire, { once: true, passive: true });
    return () => {
      done = true;
      window.removeEventListener("load", idle);
      window.removeEventListener("scroll", fire);
      if (idleId === undefined) return;
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, []);
  return go;
}

export interface JourneyMapStep {
  key: ExperienceStep;
  /** Short name, e.g. "Order". */
  name: string;
  /** "Go to step 2: Order". */
  goLabel: string;
  /** What the dots are doing at this step, with the pod label filled in. */
  caption: string;
}

export interface JourneyMapProps {
  comb: CombMapLabels;
  title: string;
  note: string;
  stepperLabel: string;
  steps: JourneyMapStep[];
  progress: Record<ExperienceStep, number>;
}

export function JourneyMap({ comb, title, note, stepperLabel, steps, progress }: JourneyMapProps) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<ExperienceStep>("arrive");
  const [value, setValue] = useState(progress.arrive);
  const [observing, setObserving] = useState(false);
  const current = useRef(progress.arrive);
  const frame = useRef<number | null>(null);

  // The map itself, as a lazy chunk (see Budget above).
  const load = useAfterLoad();
  const [Comb, setComb] = useState<ComponentType<CombMapProps> | null>(null);
  useEffect(() => {
    if (!load) return;
    let live = true;
    import("@/components/site/floor-plan/CombMap").then((m) => {
      if (live) setComb(() => m.CombMap);
    });
    return () => {
      live = false;
    };
  }, [load]);

  // Which step crosses the middle of the viewport.
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("li[data-step]"));
    if (!nodes.length || typeof IntersectionObserver === "undefined") {
      setObserving(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const key = (e.target as HTMLElement).dataset.step as ExperienceStep | undefined;
          if (e.isIntersecting && key && (EXPERIENCE_STEPS as readonly string[]).includes(key)) setActive(key);
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    for (const n of nodes) io.observe(n);
    setObserving(true);
    return () => io.disconnect();
  }, []);

  // Travel to the active step's progress.
  useEffect(() => {
    const target = progress[active];
    if (frame.current != null) cancelAnimationFrame(frame.current);
    const from = current.current;
    if (reduced || from === target) {
      current.current = target;
      setValue(target);
      return;
    }
    const duration = tweenMs(from, target);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Land exactly on the target (floating point would leave it a hair off, and `moving` true).
      const v = t >= 1 ? target : from + (target - from) * easeInOut(t);
      current.current = v;
      setValue(v);
      frame.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [active, progress, reduced]);

  // Derived, not stored: true from the render that changes the step until the dots arrive (no stale frame).
  const moving = value !== progress[active];
  const index = EXPERIENCE_STEPS.indexOf(active);
  const step = steps[index];

  const goTo = (key: ExperienceStep) => {
    const el = document.querySelector<HTMLElement>(`li[data-step="${key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    // Move focus with the view, for keyboard and screen reader users.
    el.focus({ preventScroll: true });
  };

  return (
    <div
      data-journey-map
      data-ready={observing && Comb ? "true" : "false"}
      data-active-step={active}
      data-moving={moving ? "true" : "false"}
      className="xp-map rounded-2xl border border-oh-cream/15 bg-oh-charcoal p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.85)] lg:rounded-[1.75rem] lg:p-5"
    >
      <div className="hidden lg:block">
        <p className="m-0 font-body text-xs font-medium uppercase tracking-[0.2em] text-oh-gold">{title}</p>
      </div>
      {Comb ? (
        // The bowl dot shows from the status step on: the kitchen fires a bowl once its guest checks in.
        <Comb layoutKey={EXPERIENCE_LAYOUT} mode="journey" labels={comb} journeyProgress={value} bowlFrom={progress.status} legend={false} className="xp-map-in lg:mt-4" />
      ) : (
        // Same box as the map (portrait under 768px, like CombMap's own switch), so nothing shifts when it arrives.
        <div aria-hidden="true" className="aspect-[53/73] w-full rounded-2xl bg-oh-ink md:aspect-[73/53] lg:mt-4" />
      )}
      <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-x-3 gap-y-0.5 px-1 pb-0.5 text-sm text-oh-cream/85 lg:mt-4 lg:gap-x-5 lg:px-0 lg:text-base" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-oh-charcoal bg-oh-gold" />
          {comb.marker.guest}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-oh-charcoal bg-oh-ember-light" />
          {comb.marker.bowl}
        </li>
      </ul>
      <div className="hidden lg:block">
        <p className="m-0 mt-4 min-h-[3.2em] font-body text-lg leading-snug text-oh-cream" aria-live="polite">
          {step?.caption}
        </p>
        <nav aria-label={stepperLabel} className="mt-5 border-t border-oh-stone/70 pt-4">
          <ol className="m-0 grid list-none grid-cols-4 gap-x-2 gap-y-3 p-0">
            {steps.map((s, i) => {
              const on = s.key === active;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => goTo(s.key)}
                    aria-label={s.goLabel}
                    aria-current={on ? "step" : undefined}
                    className="group flex min-h-11 w-full cursor-pointer appearance-none flex-col items-start gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-oh-cream/60 transition-colors hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oh-cream aria-[current=step]:text-oh-cream"
                  >
                    <span className="relative block h-0.5 w-full overflow-hidden rounded-full bg-oh-stone">
                      <span
                        className={`xp-bar absolute inset-y-0 left-0 block rounded-full bg-oh-gold ${i <= index ? "w-full" : "w-0"}`}
                      />
                    </span>
                    <span className="text-sm font-semibold">{s.name}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <p className="m-0 mt-4 text-sm text-oh-mute">{note}</p>
      </div>
    </div>
  );
}
