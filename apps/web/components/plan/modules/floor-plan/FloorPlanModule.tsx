"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { fmtInteger, fmtPercent } from "@oh/plan-model";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";
import { DataTableToggle } from "@/components/plan/primitives/DataTableToggle";
import { Lightbox } from "@/components/plan/primitives/Lightbox";
import { FloorPlanSvg, type HoverTarget, type LabelKey } from "./FloorPlanSvg";
import { JourneyTimeline } from "./JourneyTimeline";
import { PodTable } from "./PodTable";
import { ServiceExplainer } from "./ServiceExplainer";
import { ShellFacts } from "./ShellFacts";
import { TerritoryLegend } from "./TerritoryLegend";
import { FloorPlan3D, preloadFloorPlan3D } from "./three/FloorPlan3D";
import type { IsoFocus, IsoPreset } from "./three/types";
import {
  ANIMATED_STEPS,
  AREAS,
  BUILDING,
  DIMS,
  DINING_SQFT_PER_POD,
  GUEST_AISLES,
  JOURNEY_POD,
  JOURNEY_REAL_SECONDS,
  JOURNEY_SECONDS,
  LAYER_KEYS,
  POD,
  PODS,
  ROWS,
  SHELL_FACTS,
  STAFF_CORRIDORS,
  TERRITORY_TOTALS,
  TOTAL_SQFT,
  ZONES,
  journeyClock,
  journeyMarkers,
  type Actor,
  type AreaKey,
  type JourneyStep,
  type LayerKey,
  type Pod,
  type ZoneKey,
} from "./layout";

type Mode = "blueprint" | "territory" | "iso";
const MODES: readonly Mode[] = ["blueprint", "territory", "iso"];
const PRESETS: readonly IsoPreset[] = ["overview", "kitchen", "finger", "lobby"];
const FOCUS: readonly IsoFocus[] = ["all", "guest", "staff"];

function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const radio = (on: boolean): string =>
  ["rounded-md px-3 py-1 text-[0.78rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember", on ? "bg-oh-charcoal text-oh-cream" : "bg-transparent text-oh-mute hover:text-oh-cream"].join(" ");
const groupCls = "inline-flex rounded-lg border border-oh-stone bg-oh-ink p-1";
const iconBtn = "bg-oh-charcoal/90 px-2.5 py-1 text-[0.85rem] leading-none text-oh-cream hover:bg-oh-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember";

/**
 * The Floor Plan (spec 6.2), rebuilt around the comb service layout. One
 * geometry model (layout.ts) drives the blueprint, the territory paint, the
 * 3D scene, the areas table and the journey, so they cannot disagree.
 */
export function FloorPlanModule() {
  const t = useTranslations("plan.floorPlan");
  const locale = useLocale();
  const reduce = useReducedMotion() ?? false;

  const [mode, setMode] = useState<Mode>("blueprint");
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    pods: true,
    corridors: true,
    aisles: true,
    kitchen: true,
    boh: true,
    restrooms: true,
    entry: true,
    store: true,
    flow: false,
    dimensions: false,
  });
  const [hovered, setHovered] = useState<Pod | null>(null);
  const [pinned, setPinned] = useState<Pod | null>(null);
  const [focused, setFocused] = useState<Pod | null>(null);
  const [tabPod, setTabPod] = useState<number>(JOURNEY_POD);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preset, setPreset] = useState<IsoPreset>("overview");
  const [focus, setFocus] = useState<IsoFocus>("all");
  const [isoUnavailable, setIsoUnavailable] = useState(false);
  const [isoRequested, setIsoRequested] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const svgHost = useRef<HTMLDivElement>(null);

  const [compact, setCompact] = useState(false);
  useEffect(() => {
    setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = (): void => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Journey clock: one rAF loop; reduced motion jumps to the end state.
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

  const markers = useMemo(() => journeyMarkers(progress), [progress]);
  const currentStep: JourneyStep | null = progress > 0 ? [...ANIMATED_STEPS].reverse().find((s) => (s.at as number) <= progress) ?? null : null;
  const clock = journeyClock(progress);
  const showJourney = progress > 0;
  const active = pinned ?? hovered ?? focused;
  const activePod = active?.number ?? (showJourney ? JOURNEY_POD : null);

  // Zoom and pan (2D only).
  const zoom = (factor: number): void => setView((v) => ({ ...v, k: Math.min(4, Math.max(1, v.k * factor)) }));
  const resetView = (): void => setView({ k: 1, x: 0, y: 0 });
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
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

  // Pod selection and the roving tab stop.
  const focusPodElement = useCallback((n: number): void => {
    setTabPod(n);
    const el = svgHost.current?.querySelector<SVGGElement>(`[data-pod="${n}"]`);
    el?.focus();
  }, []);
  const activate = (p: Pod): void => {
    setPinned((cur) => (cur?.number === p.number ? null : p));
    setTabPod(p.number);
  };
  const onPodKeyDown = (e: KeyboardEvent<SVGGElement>, p: Pod): void => {
    const row = ROWS[p.row - 1];
    if (!row) return;
    let next: Pod | undefined;
    if (e.key === "ArrowDown") next = PODS.find((q) => q.row === p.row && q.position === p.position + 1);
    else if (e.key === "ArrowUp") next = PODS.find((q) => q.row === p.row && q.position === p.position - 1);
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const r = p.row + (e.key === "ArrowRight" ? 1 : -1);
      const target = ROWS[r - 1];
      if (target) next = PODS.find((q) => q.row === r && q.position === Math.min(p.position, target.capacity));
    } else if (e.key === "Home") next = PODS.find((q) => q.row === p.row && q.position === 1);
    else if (e.key === "End") next = [...PODS].reverse().find((q) => q.row === p.row);
    else if (e.key === "Escape") {
      setPinned(null);
      return;
    }
    if (next) {
      e.preventDefault();
      focusPodElement(next.number);
    }
  };
  const stepPod = (delta: number): void => {
    const base = pinned?.number ?? JOURNEY_POD;
    const n = Math.min(PODS.length, Math.max(1, base + delta));
    const p = PODS.find((q) => q.number === n);
    if (p) {
      setPinned(p);
      setTabPod(n);
    }
  };

  // Copy.
  const sideLabel = (s: Pod["side"]): string => t(`pod.side.${s}`);
  const typeLabel = (k: Pod["type"]): string => t(`pod.${k}`);
  const podText = (p: Pod): string =>
    [
      t("readout.pod", { number: p.number, finger: p.finger, side: sideLabel(p.side), position: p.position, aisle: p.aisle, corridor: p.corridor }),
      t("readout.podType", { type: typeLabel(p.type), w: POD.w.toFixed(2), d: POD.d.toFixed(1) }),
      p.duoWith !== undefined ? t("readout.podDuo", { number: p.duoWith }) : "",
    ]
      .filter(Boolean)
      .join(" ");
  const zoneValue = (key: ZoneKey): string => fmtInteger((ZONES.find((z) => z.key === key)?.w ?? 0) * (ZONES.find((z) => z.key === key)?.h ?? 0), locale);
  const targetText = (h: HoverTarget): string => {
    if (h.kind === "corridor") {
      const k = STAFF_CORRIDORS[h.index - 1];
      return t("readout.corridor", { n: h.index, pods: PODS.filter((p) => p.corridor === h.index).length, w: k?.w ?? DIMS.corridorW });
    }
    if (h.kind === "aisle") {
      if (h.index === 0) return t("readout.crossAisle", { w: DIMS.crossAisle });
      const a = GUEST_AISLES[h.index - 1];
      return t("readout.aisle", { n: h.index, pods: PODS.filter((p) => p.aisle === h.index).length, w: a?.w ?? DIMS.aisleW });
    }
    switch (h.key) {
      case "kitchen":
        return t("readout.kitchen", { value: zoneValue("kitchen") });
      case "dish":
        return t("readout.dish", { value: zoneValue("dish") });
      case "boh":
        return t("readout.boh", { value: zoneValue("boh") });
      case "lobby":
        return t("readout.lobby", { value: zoneValue("lobby") });
      case "store":
        return t("readout.store", { value: zoneValue("store") });
      default:
        return t("readout.restrooms");
    }
  };
  const actorLabel = (a: Actor): string => t(`journey.actors.${a}`);
  const stepText = (key: JourneyStep["key"]): string => t(`journey.steps.${key}`, { pod: JOURNEY_POD });

  const liveText = pinned
    ? `${podText(pinned)} ${t("readout.pinned")}`
    : focused
      ? podText(focused)
      : currentStep
        ? t("readout.step", { actor: actorLabel(currentStep.actor), time: fmtClock(currentStep.realSeconds), text: stepText(currentStep.key) })
        : t("readout.default");
  const hoverText = hovered ? podText(hovered) : hoverTarget ? targetText(hoverTarget) : null;

  const podLabel = (p: Pod): string => t("pod.aria", { number: p.number, type: typeLabel(p.type), finger: p.finger, side: sideLabel(p.side), position: p.position });
  const svgLabels = useMemo(() => {
    const keys: LabelKey[] = ["title", "kitchen", "dish", "boh", "restroomHall", "restroomMen", "restroomWomen", "store", "lobby", "kiosk", "corridor", "aisle", "crossAisle", "pass", "entry", "exit", "staffDoor", "receiving", "ft"];
    return Object.fromEntries(keys.map((k) => [k, t(`zones.${k}`)])) as Record<LabelKey, string>;
  }, [t]);

  const svgProps = {
    layers,
    labels: svgLabels,
    activePod,
    tabPod,
    focusPod: focused?.number ?? null,
    hoverTarget,
    guest: showJourney ? markers.guest : null,
    bowl: showJourney ? markers.bowl : null,
    showPaths: showJourney,
    onPodEnter: setHovered,
    onPodLeave: () => setHovered(null),
    onPodActivate: activate,
    onPodFocus: (p: Pod) => {
      setFocused(p);
      setTabPod(p.number);
    },
    onPodBlur: () => setFocused(null),
    onPodKeyDown,
    onTargetEnter: setHoverTarget,
    onTargetLeave: () => setHoverTarget(null),
    podLabel,
  };

  const legendLabels = { staff: t("legend.staff"), guest: t("legend.guest"), hatch: t("legend.hatch") };
  const legendDetail = {
    staff: t("legend.staffSqft", { value: fmtInteger(TERRITORY_TOTALS.staff, locale) }),
    guest: t("legend.guestSqft", { value: fmtInteger(TERRITORY_TOTALS.guest, locale), pods: PODS.length }),
    touch: t("legend.touch", { hatches: SHELL_FACTS.hatches }),
  };

  const isoLabels = useMemo(
    () => ({ kitchen: t("zones.kitchen"), lobby: t("zones.lobby"), store: t("zones.store"), restrooms: t("zones.restroomHall"), corridor: t("zones.corridor"), aisle: t("zones.aisle"), loading: t("modes.isoLoading") }),
    [t],
  );
  const onPodLeave = useCallback(() => setHovered(null), []);
  const onIsoUnavailable = useCallback(() => {
    setIsoUnavailable(true);
    setMode("blueprint");
  }, []);
  const isoWanted = mode === "iso" && !isoUnavailable;
  const isoMounted = isoWanted && (!coarsePointer || isoRequested);

  const viewport = (
    <div className="relative overflow-hidden rounded-lg border border-oh-stone bg-oh-charcoal">
      {mode !== "iso" ? (
        <div
          className={["touch-pan-y", view.k > 1 ? "cursor-grab active:cursor-grabbing" : ""].join(" ")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <div ref={svgHost} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "center", transition: drag.current ? "none" : "transform 120ms ease-out" }}>
            <FloorPlanSvg theme="dark" mode={mode === "territory" ? "territory" : "blueprint"} className="block h-auto w-full select-none" {...svgProps} />
          </div>
          <div className="absolute right-2 top-2 inline-flex overflow-hidden rounded-md border border-oh-stone" role="group" aria-label={t("zoom.hint")}>
            <button type="button" onClick={() => zoom(1.25)} aria-label={t("zoom.in")} className={iconBtn}>
              +
            </button>
            <button type="button" onClick={() => zoom(1 / 1.25)} aria-label={t("zoom.out")} className={`border-l border-oh-stone ${iconBtn}`}>
              −
            </button>
            <button type="button" onClick={resetView} aria-label={t("zoom.reset")} className={`border-l border-oh-stone ${iconBtn} text-[0.7rem] text-oh-mute`}>
              1:1
            </button>
          </div>
        </div>
      ) : (
        <div>
          {isoMounted ? (
            <FloorPlan3D
              layers={layers}
              progress={progress}
              guest={showJourney ? markers.guest : null}
              bowl={showJourney ? markers.bowl : null}
              activePod={activePod}
              reduce={reduce}
              preset={preset}
              focus={focus}
              labels={isoLabels}
              canvasAria={t("iso.aria")}
              onPodEnter={setHovered}
              onPodLeave={onPodLeave}
              onPodActivate={activate}
              onUnavailable={onIsoUnavailable}
            />
          ) : (
            <div className="flex aspect-[7/5] w-full flex-col items-center justify-center gap-3 bg-oh-charcoal">
              <button type="button" onClick={() => setIsoRequested(true)} className="rounded-md bg-oh-ember-deep px-4 py-2 text-[0.85rem] font-semibold text-oh-cream hover:bg-oh-ember focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-cream">
                {t("modes.isoLoad")}
              </button>
              <p className="m-0 max-w-xs text-center text-[0.75rem] text-oh-mute">{t("iso.controls")}</p>
            </div>
          )}
          {/* Keyboard path stays on the 2D pods while the 3D view is showing. */}
          <div ref={svgHost} className="sr-only">
            <FloorPlanSvg theme="dark" mode="blueprint" {...svgProps} />
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-2 hidden rounded-md bg-oh-charcoal/85 px-3 py-1.5 lg:block">
        <TerritoryLegend labels={legendLabels} />
      </div>
    </div>
  );

  // Desktop: every aside panel open. Phones: accordions, journey open, the rest closed.
  const asideSection = (id: string, title: string, children: React.ReactNode, openOnPhone = true) => (
    <details open={compact ? openOnPhone : true} className="group rounded-lg border border-oh-stone bg-oh-ink/40 lg:border-0 lg:bg-transparent">
      <summary className="cursor-pointer list-none px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute marker:content-none lg:cursor-default lg:px-0 lg:pb-2 lg:pt-0 [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90 lg:hidden" aria-hidden="true">
          ▸
        </span>{" "}
        <span id={id}>{title}</span>
      </summary>
      <div className="px-3 pb-3 lg:px-0 lg:pb-0">{children}</div>
    </details>
  );

  return (
    <div data-plan-module="floor-plan">
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label={t("modes.label")} className={groupCls}>
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              aria-disabled={m === "iso" && isoUnavailable ? true : undefined}
              onClick={() => {
                if (m === "iso" && isoUnavailable) return;
                setMode(m);
              }}
              onPointerEnter={m === "iso" ? preloadFloorPlan3D : undefined}
              onFocus={m === "iso" ? preloadFloorPlan3D : undefined}
              className={radio(mode === m)}
            >
              {t(`modes.${m}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (progress >= 1) setProgress(0);
            setPlaying((p) => !p);
          }}
          className="rounded-md bg-oh-ember-deep px-3 py-1 text-[0.78rem] font-semibold text-oh-cream hover:bg-oh-ember focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-cream"
        >
          {playing ? t("journey.pause") : progress >= 1 ? t("journey.replay") : t("journey.play")}
        </button>
        {showJourney ? <span className="font-display tabular-nums text-[1.05rem] text-oh-gold">{fmtClock(clock)}</span> : null}
        {mode === "iso" ? (
          <>
            <div role="radiogroup" aria-label={t("iso.presets.label")} className={groupCls}>
              {PRESETS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={preset === p} onClick={() => setPreset(p)} className={radio(preset === p)}>
                  {t(`iso.presets.${p}`)}
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label={t("iso.focus.label")} className={groupCls}>
              {FOCUS.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={focus === f} onClick={() => setFocus(f)} className={radio(focus === f)}>
                  {t(`iso.focus.${f}`)}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      {isoUnavailable ? <p className="m-0 mb-3 text-[0.78rem] text-oh-mute">{t("modes.isoUnavailable")}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <DataTableToggle
            labels={{ showTable: t("table.show"), showChart: t("table.hide") }}
            chart={viewport}
            table={
              <PodTable
                caption={t("table.caption", { pods: PODS.length })}
                headers={{ pod: t("table.pod"), finger: t("table.finger"), side: t("table.side"), position: t("table.position"), aisle: t("table.aisle"), corridor: t("table.corridor"), type: t("table.type") }}
                sideLabel={sideLabel}
                typeLabel={typeLabel}
              />
            }
          />
          <TerritoryLegend labels={legendLabels} className="mt-3 lg:hidden" />

          {/* readout: the visible line follows the pointer; the live region only speaks for pins, focus and journey steps */}
          <div className="mt-3 flex min-h-[3.5rem] items-center gap-3 rounded-md border border-oh-stone bg-oh-ink px-4 py-3 text-[0.85rem]">
            <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t("pod.stepper")}>
              <button type="button" onClick={() => stepPod(-1)} aria-label={t("pod.prev")} className="h-9 w-9 rounded-md border border-oh-stone bg-transparent text-[1.1rem] leading-none text-oh-mute hover:text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember md:h-7 md:w-7">
                ‹
              </button>
              <button type="button" onClick={() => stepPod(1)} aria-label={t("pod.next")} className="h-9 w-9 rounded-md border border-oh-stone bg-transparent text-[1.1rem] leading-none text-oh-mute hover:text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember md:h-7 md:w-7">
                ›
              </button>
            </div>
            <p className="m-0 leading-snug text-oh-cream" aria-hidden="true">
              {hoverText ?? liveText}
            </p>
            <p className="sr-only" aria-live="polite">
              {liveText}
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:gap-6">
          {mode === "territory"
            ? asideSection("floor-plan-legend", t("modes.territory"), <TerritoryLegend labels={legendLabels} detail={legendDetail} />)
            : asideSection(
                "floor-plan-layers",
                t("layers.title"),
                <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1.5 p-0 lg:grid-cols-1">
                  {LAYER_KEYS.map((k) => (
                    <li key={k}>
                      <label className="flex items-center gap-2 text-[0.85rem] text-oh-cream">
                        <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} className="accent-[#C1502E]" />
                        {t(`layers.${k}`)}
                      </label>
                    </li>
                  ))}
                </ul>,
                false,
              )}

          {asideSection(
            "floor-plan-areas",
            t("areas.title"),
            <div>
              <table className="w-full border-collapse text-[0.85rem]">
                <tbody>
                  {AREAS.map((a) => (
                    <tr key={a.key} className="border-b border-oh-stone/60">
                      <th scope="row" className="flex items-center gap-2 py-1.5 text-left font-normal text-oh-cream">
                        <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${a.territory === "staff" ? "bg-oh-ember" : "bg-oh-gold"}`} />
                        {t(`areas.${a.key as AreaKey}`)}
                      </th>
                      <td className="py-1.5 text-right tabular-nums text-oh-cream">{t("areas.sqft", { value: fmtInteger(a.sqft, locale) })}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums text-oh-mute">{fmtPercent(a.sqft / TOTAL_SQFT, locale, 0)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-oh-stone/60 text-oh-mute">
                    <th scope="row" className="py-1.5 text-left font-normal">{t("areas.staffTotal")}</th>
                    <td className="py-1.5 text-right tabular-nums">{t("areas.sqft", { value: fmtInteger(TERRITORY_TOTALS.staff, locale) })}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{fmtPercent(TERRITORY_TOTALS.staff / TOTAL_SQFT, locale, 0)}</td>
                  </tr>
                  <tr className="border-b border-oh-stone/60 text-oh-mute">
                    <th scope="row" className="py-1.5 text-left font-normal">{t("areas.guestTotal")}</th>
                    <td className="py-1.5 text-right tabular-nums">{t("areas.sqft", { value: fmtInteger(TERRITORY_TOTALS.guest, locale) })}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{fmtPercent(TERRITORY_TOTALS.guest / TOTAL_SQFT, locale, 0)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-1.5 text-left font-normal text-oh-cream">{t("areas.total")}</th>
                    <td className="py-1.5 text-right tabular-nums text-oh-cream">{t("areas.sqft", { value: fmtInteger(TOTAL_SQFT, locale) })}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-oh-mute">{fmtPercent(1, locale, 0)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="m-0 mt-2 text-[0.75rem] leading-snug text-oh-mute">{t("areas.landlordLine", { w: BUILDING.w, d: BUILDING.h })}</p>
            </div>,
            false,
          )}

          {asideSection(
            "floor-plan-journey",
            t("journey.title"),
            <JourneyTimeline
              progress={progress}
              actorLabel={actorLabel}
              stepText={stepText}
              fmtClock={fmtClock}
              after={t("journey.after")}
              note={t("journey.note", { real: fmtClock(JOURNEY_REAL_SECONDS), anim: JOURNEY_SECONDS })}
            />,
            true,
          )}
        </aside>
      </div>

      <ShellFacts
        title={t("facts.title")}
        note={t("facts.note")}
        facts={[
          { label: t("facts.footprint"), value: t("facts.footprintValue", { w: SHELL_FACTS.w, d: SHELL_FACTS.d }) },
          { label: t("facts.area"), value: t("facts.areaValue", { sqft: fmtInteger(SHELL_FACTS.sqft, locale) }) },
          { label: t("facts.front"), value: t("facts.frontValue", { w: SHELL_FACTS.frontFt }) },
          { label: t("facts.doors"), value: t("facts.doorsValue", { count: SHELL_FACTS.doors }) },
          { label: t("facts.kitchen"), value: t("facts.kitchenValue", { depth: SHELL_FACTS.kitchenDepth }) },
          { label: t("facts.widths"), value: t("facts.widthsValue", { corridor: SHELL_FACTS.corridorW, aisle: SHELL_FACTS.aisleW, cross: SHELL_FACTS.crossAisle }) },
          { label: t("facts.fixtures"), value: t("facts.fixturesValue", { pods: SHELL_FACTS.pods, kiosks: SHELL_FACTS.kiosks, restrooms: SHELL_FACTS.restrooms }) },
        ]}
      />

      <ServiceExplainer
        title={t("explainer.title")}
        lede={t("explainer.lede")}
        steps={[
          { key: "kitchen", title: t("explainer.kitchen.title"), body: t("explainer.kitchen.body") },
          { key: "corridor", title: t("explainer.corridor.title"), body: t("explainer.corridor.body") },
          { key: "hatch", title: t("explainer.hatch.title"), body: t("explainer.hatch.body") },
        ]}
      />

      <section aria-labelledby="floor-plan-blueprint" className="mt-12 md:mt-16">
        <h2 id="floor-plan-blueprint" className="m-0 mb-1 font-display text-[1.5rem] leading-tight text-oh-cream md:text-[1.8rem]">
          {t("blueprint.title")}
        </h2>
        <p className="m-0 mb-5 max-w-3xl text-[0.95rem] leading-relaxed text-oh-mute">{t("blueprint.lede")}</p>
        <figure className="m-0 max-w-3xl">
          <Lightbox
            src="/plan/blueprint-comb-900.webp"
            fullSrc="/plan/blueprint-comb-full.jpg"
            alt={t("blueprint.alt")}
            width={1086}
            height={1448}
            labels={{ open: t("blueprint.open"), close: t("blueprint.close"), fullSize: t("blueprint.fullSize") }}
          />
          <figcaption className="mt-3 text-[0.82rem] leading-snug text-oh-mute">{t("blueprint.caption")}</figcaption>
        </figure>
      </section>

      <div className="mt-12 md:mt-16">
        <BenchmarkCallout
          eyebrow={t("honesty.eyebrow")}
          claim={t("honesty.claim", { pods: PODS.length, sqft: fmtInteger(TOTAL_SQFT, locale), perPod: fmtInteger(Math.round(DINING_SQFT_PER_POD), locale) })}
          benchmark={t("honesty.text", { w: POD.w.toFixed(2), d: POD.d.toFixed(1), corridor: DIMS.corridorW, aisle: DIMS.aisleW })}
        />
      </div>
    </div>
  );
}
