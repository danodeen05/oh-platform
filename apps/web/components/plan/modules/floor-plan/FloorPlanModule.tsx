"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { fmtInteger, fmtPercent } from "@oh/plan-model";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";
import { FloorPlanSvg } from "./FloorPlanSvg";
import {
  AREAS,
  BOWL_PATH,
  DINING_SQFT_PER_POD,
  GUEST_PATH,
  JOURNEY_POD,
  JOURNEY_REAL_SECONDS,
  JOURNEY_SECONDS,
  JOURNEY_STEPS,
  POD,
  PODS,
  TOTAL_SQFT,
  pointAt,
  type LayerKey,
  type Pod,
} from "./layout";

const LAYER_KEYS: readonly LayerKey[] = ["pods", "corridors", "kitchen", "boh", "restrooms", "entry"];

function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The Floor Plan (spec 6.2): zoom and pan, hover or tap any pod, toggle
 * layers, play the order journey, and read the square-footage breakdown.
 * The honesty note about 21 sf per pod comes from the same geometry.
 */
export function FloorPlanModule() {
  const t = useTranslations("plan.floorPlan");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ pods: true, corridors: true, kitchen: true, boh: true, restrooms: true, entry: true });
  const [hovered, setHovered] = useState<Pod | null>(null);
  const [pinned, setPinned] = useState<Pod | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!playing) return;
    if (reduce) {
      setProgress(1);
      setPlaying(false);
      return;
    }
    const start = performance.now() - progress * JOURNEY_SECONDS * 1000;
    let frame = 0;
    const step = (now: number): void => {
      const p = Math.min(1, (now - start) / (JOURNEY_SECONDS * 1000));
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(step);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduce]);

  const active = pinned ?? hovered;
  const steps = JOURNEY_STEPS;
  const currentStep = progress > 0 ? [...steps].reverse().find((s) => progress >= s.at) ?? steps[0] : null;
  const guestT = Math.min(1, progress / 0.2);
  const guest = progress > 0 ? pointAt(GUEST_PATH, guestT) : null;
  const bowl = progress >= 0.72 ? pointAt(BOWL_PATH, Math.min(1, (progress - 0.72) / 0.28)) : null;
  const journeyPod = progress > 0 ? JOURNEY_POD : null;

  const zoom = (factor: number): void => setView((v) => ({ ...v, k: Math.min(4, Math.max(1, v.k * factor)) }));
  const reset = (): void => setView({ k: 1, x: 0, y: 0 });
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!drag.current || view.k === 1) return;
    setView((v) => ({ ...v, x: (drag.current?.vx ?? 0) + (e.clientX - (drag.current?.x ?? 0)), y: (drag.current?.vy ?? 0) + (e.clientY - (drag.current?.y ?? 0)) }));
  };
  const onPointerUp = (): void => {
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
  };

  const podLabel = (p: Pod): string => t("pod.aria", { number: p.number, type: t(`pod.${p.type}`), row: p.row, position: p.position });
  const svgLabels = { entry: t("zones.entry"), dining: t("zones.dining"), kitchen: t("zones.kitchen"), boh: t("zones.boh"), restrooms: t("zones.restrooms"), kiosk: t("zones.kiosk"), corridor: t("zones.corridor"), aisle: t("zones.aisle"), pass: t("zones.pass") };

  return (
    <div data-plan-module="floor-plan">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-oh-stone">
              <button type="button" onClick={() => zoom(1.25)} aria-label={t("zoom.in")} className="bg-oh-ink px-3 py-1.5 text-[0.9rem] text-oh-cream hover:bg-oh-stone">+</button>
              <button type="button" onClick={() => zoom(1 / 1.25)} aria-label={t("zoom.out")} className="border-l border-oh-stone bg-oh-ink px-3 py-1.5 text-[0.9rem] text-oh-cream hover:bg-oh-stone">−</button>
              <button type="button" onClick={reset} className="border-l border-oh-stone bg-oh-ink px-3 py-1.5 text-[0.75rem] text-oh-mute hover:text-oh-cream">{t("zoom.reset")}</button>
            </div>
            <button
              type="button"
              onClick={() => { if (progress >= 1) setProgress(0); setPlaying((p) => !p); }}
              className="rounded-md bg-oh-ember-deep px-3 py-1.5 text-[0.8rem] font-semibold text-oh-cream hover:bg-oh-ember"
            >
              {playing ? t("journey.pause") : progress >= 1 ? t("journey.replay") : t("journey.play")}
            </button>
            <span className="text-[0.75rem] text-oh-mute">{t("zoom.hint")}</span>
          </div>
          <div
            className="overflow-hidden rounded-lg border border-oh-stone bg-oh-charcoal touch-pan-y"
            style={{ cursor: view.k > 1 ? "grab" : "default" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "center", transition: drag.current ? "none" : "transform 120ms ease-out" }}>
              <FloorPlanSvg
                theme="dark"
                layers={layers}
                labels={svgLabels}
                activePod={active?.number ?? journeyPod}
                guest={guest}
                bowl={bowl}
                showPaths={progress > 0}
                onPodEnter={setHovered}
                onPodLeave={() => setHovered(null)}
                onPodActivate={(p) => setPinned((cur) => (cur?.number === p.number ? null : p))}
                podLabel={podLabel}
                className="block h-auto w-full select-none"
              />
            </div>
          </div>
          <div className="mt-3 min-h-[3.5rem] rounded-md border border-oh-stone bg-oh-ink px-4 py-3 text-[0.85rem]" aria-live="polite">
            {active ? (
              <>
                <span className="font-display text-[1.1rem] text-oh-cream">{t("pod.title", { number: active.number })}</span>
                <span className="ml-3 text-oh-mute">{t("pod.detail", { type: t(`pod.${active.type}`), row: active.row, position: active.position, panel: t(`pod.panel.${active.panel}`) })}</span>
                <span className="ml-3 text-oh-mute">{t("pod.size", { w: POD.w.toFixed(2), d: POD.d.toFixed(1) })}</span>
              </>
            ) : currentStep ? (
              <>
                <span className="font-display tabular-nums text-[1.1rem] text-oh-gold">{fmtClock(currentStep.realSeconds)}</span>
                <span className="ml-3 text-oh-cream">{t(`journey.steps.${currentStep.key}`)}</span>
              </>
            ) : (
              <span className="text-oh-mute">{t("pod.hint")}</span>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-5">
          <div>
            <h2 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("layers.title")}</h2>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {LAYER_KEYS.map((k) => (
                <li key={k}>
                  <label className={["inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-[0.78rem]", layers[k] ? "border-oh-mute text-oh-cream" : "border-oh-stone text-oh-mute"].join(" ")}>
                    <input type="checkbox" checked={layers[k]} onChange={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} className="h-3.5 w-3.5 accent-[#C1502E]" />
                    {t(`layers.${k}`)}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("areas.title")}</h2>
            <table className="w-full border-collapse text-[0.85rem]">
              <tbody>
                {AREAS.map((a) => (
                  <tr key={a.key} className="border-b border-oh-stone">
                    <th scope="row" className="py-1.5 text-left font-normal text-oh-mute">{t(`areas.${a.key}`)}</th>
                    <td className="py-1.5 text-right tabular-nums text-oh-cream">{t("areas.sqft", { value: fmtInteger(a.sqft, locale) })}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-oh-mute">{fmtPercent(a.sqft / TOTAL_SQFT, locale, 0)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="py-1.5 text-left font-normal text-oh-cream">{t("areas.total")}</th>
                  <td className="py-1.5 text-right tabular-nums text-oh-cream">{t("areas.sqft", { value: fmtInteger(TOTAL_SQFT, locale) })}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("journey.title")}</h2>
            <ol className="m-0 list-none p-0 text-[0.8rem]">
              {steps.map((s) => {
                const reached = progress >= s.at && progress > 0;
                return (
                  <li key={s.key} className={["flex gap-3 border-l-2 py-1 pl-3", reached ? "border-oh-gold text-oh-cream" : "border-oh-stone text-oh-mute"].join(" ")}>
                    <span className="w-9 shrink-0 tabular-nums">{fmtClock(s.realSeconds)}</span>
                    <span>{t(`journey.steps.${s.key}`)}</span>
                  </li>
                );
              })}
            </ol>
            <p className="m-0 mt-2 text-[0.72rem] text-oh-mute">{t("journey.note", { real: fmtClock(JOURNEY_REAL_SECONDS), anim: JOURNEY_SECONDS })}</p>
          </div>
        </aside>
      </div>

      <BenchmarkCallout
        eyebrow={t("honesty.eyebrow")}
        claim={t("honesty.claim", { pods: PODS.length, sqft: fmtInteger(TOTAL_SQFT, locale), perPod: fmtInteger(DINING_SQFT_PER_POD, locale) })}
        benchmark={t("honesty.text", { w: POD.w.toFixed(2), d: POD.d.toFixed(1) })}
      />
    </div>
  );
}
