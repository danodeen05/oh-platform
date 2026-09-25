"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { BASE, FRANCHISE_MARKETS, OPENING_SCHEDULE, computeTimeline, fmtCompact, fmtInteger, type TimelineUnit } from "@oh/plan-model";
import { MARKET_PINS, VIEW_ORDER, type MapView, type MarketPin } from "./markets";
import { MAP_H, MAP_W, useMapGeometry } from "./useMapGeometry";

const HORIZON = 72;

function viewForMonth(units: readonly TimelineUnit[], month: number): MapView {
  const open = units.filter((u) => u.openMonth <= month);
  const keys = new Set(open.map((u) => u.marketKey));
  const pins = MARKET_PINS.filter((p) => keys.has(p.key));
  if (pins.some((p) => p.view === "world")) return "world";
  if (pins.some((p) => p.view === "us")) return "us";
  return "utah";
}

/**
 * The Expansion Engine (spec 6.3): a map with a month scrubber. Pins light
 * up as their opening month passes; counters read from the engine's
 * timeline. Phones get a vertical timeline under a sticky map instead of a
 * scrubber. Map data loads lazily per view.
 */
export function ExpansionModule() {
  const t = useTranslations("plan.expansion");
  const tm = useTranslations("plan.expansion.markets");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const timeline = useMemo(() => computeTimeline(OPENING_SCHEDULE, FRANCHISE_MARKETS, BASE, { months: HORIZON }), []);
  const [month, setMonth] = useState(0);
  const [view, setView] = useState<MapView>("utah");
  const [followView, setFollowView] = useState(true);
  const [selected, setSelected] = useState<string | null>("lehi");
  const [playing, setPlaying] = useState(false);
  const geo = useMapGeometry(view);

  useEffect(() => {
    if (followView) setView(viewForMonth(timeline.units, month));
  }, [month, followView, timeline.units]);

  useEffect(() => {
    if (!playing) return;
    if (reduce) {
      setMonth(HORIZON - 1);
      setPlaying(false);
      return;
    }
    const id = window.setInterval(() => {
      setMonth((m) => {
        if (m >= HORIZON - 1) {
          setPlaying(false);
          return m;
        }
        return m + 1;
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [playing, reduce]);

  const state = timeline.months[Math.min(month, timeline.months.length - 1)];
  const openByMarket = useMemo(() => {
    const map = new Map<string, TimelineUnit[]>();
    for (const u of timeline.units) if (u.openMonth <= month) map.set(u.marketKey, [...(map.get(u.marketKey) ?? []), u]);
    return map;
  }, [timeline.units, month]);
  const firstOpen = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of timeline.units) map.set(u.marketKey, Math.min(map.get(u.marketKey) ?? Infinity, u.openMonth));
    return map;
  }, [timeline.units]);
  const pins = MARKET_PINS.filter((p) => p.view === view || (view === "us" && p.view === "utah") || view === "world");
  const selectedPin = MARKET_PINS.find((p) => p.key === selected) ?? null;
  const selectedUnits = selected ? timeline.units.filter((u) => u.marketKey === selected) : [];
  const selectedFirst = selectedUnits[0];
  const yearOf = (m: number): string => t("month", { year: Math.floor(m / 12) + 1, month: (m % 12) + 1 });

  const timelineEntries = useMemo(() => {
    const byMonth = new Map<number, TimelineUnit[]>();
    for (const u of timeline.units) if (u.openMonth < HORIZON) byMonth.set(u.openMonth, [...(byMonth.get(u.openMonth) ?? []), u]);
    return [...byMonth.entries()].sort((a, b) => a[0] - b[0]);
  }, [timeline.units]);

  const counters = state
    ? [
        { key: "locations", value: fmtInteger(state.locationsOpen, locale), sub: t("counters.split", { corporate: state.corporateOpen, franchise: state.franchiseOpen }) },
        { key: "runRate", value: fmtCompact(state.runRateRevenue, { locale }) },
        { key: "pods", value: fmtInteger(state.podsInService, locale) },
        { key: "covers", value: fmtCompact(state.cumulativeCovers, { locale }).replace(/^\$/, "") },
      ]
    : [];

  return (
    <div data-plan-module="expansion">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label={t("views.label")} className="inline-flex rounded-lg border border-oh-stone bg-oh-ink p-1">
              {VIEW_ORDER.map((v) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => { setView(v); setFollowView(false); }} className={["rounded-md px-3 py-1 text-[0.78rem]", view === v ? "bg-oh-charcoal text-oh-cream" : "text-oh-mute hover:text-oh-cream"].join(" ")}>
                  {t(`views.${v}`)}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { if (month >= HORIZON - 1) setMonth(0); setPlaying((p) => !p); setFollowView(true); }} className="rounded-md bg-oh-ember px-3 py-1 text-[0.78rem] font-semibold text-oh-cream hover:bg-oh-clay">
              {playing ? t("pause") : month >= HORIZON - 1 ? t("replay") : t("play")}
            </button>
            <span className="font-display tabular-nums text-[1.05rem] text-oh-gold">{yearOf(month)}</span>
          </div>

          <div className="sticky top-[7.5rem] z-10 overflow-hidden rounded-lg border border-oh-stone bg-oh-charcoal lg:static">
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block h-auto w-full" role="img" aria-label={t("mapAria", { view: t(`views.${view}`), month: yearOf(month) })}>
              <rect width={MAP_W} height={MAP_H} fill="#1C1B19" />
              {geo ? (
                <g>
                  {geo.shapes.map((d, i) => (
                    <path key={i} d={d} fill="#2A2724" stroke="none" />
                  ))}
                  <path d={geo.borders} fill="none" stroke="#3A3632" strokeWidth={0.8} />
                  {geo.outline ? <path d={geo.outline} fill="none" stroke="#8A8178" strokeWidth={1.2} /> : null}
                  {pins.map((p) => {
                    const xy = geo.projection(p.lonLat);
                    if (!xy) return null;
                    const open = openByMarket.get(p.key) ?? [];
                    const isOpen = open.length > 0;
                    const sel = p.key === selected;
                    const first = firstOpen.get(p.key) ?? 0;
                    const soon = !isOpen && first - month <= 6;
                    return (
                      <g key={p.key} transform={`translate(${xy[0]},${xy[1]})`} role="button" tabIndex={0} aria-label={tm(`${p.key}.name`)} onClick={() => setSelected(p.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(p.key); } }} style={{ cursor: "pointer", outline: "none" }}>
                        {isOpen ? <circle r={sel ? 16 : 12} fill="#C1502E" opacity={0.18} /> : null}
                        <circle r={isOpen ? 6 : 4} fill={isOpen ? "#C1502E" : soon ? "#C9A227" : "#3A3632"} stroke={sel ? "#F2EDE4" : "#1C1B19"} strokeWidth={sel ? 2 : 1} />
                        {open.length > 1 ? (
                          <text x={9} y={4} fill="#F2EDE4" fontSize={11} style={{ fontVariantNumeric: "tabular-nums" }}>
                            {open.length}
                          </text>
                        ) : null}
                        {(p.view === view || sel) && (
                          <text x={open.length > 1 ? 20 : 10} y={-8} fill={isOpen ? "#F2EDE4" : "#9A9188"} fontSize={10}>
                            {tm(`${p.key}.name`)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              ) : (
                <text x={MAP_W / 2} y={MAP_H / 2} textAnchor="middle" fill="#9A9188" fontSize={13}>
                  {t("loadingMap")}
                </text>
              )}
            </svg>
          </div>

          <div className="mt-3 hidden md:block">
            <label htmlFor="plan-month" className="mb-1 flex items-baseline justify-between text-[0.75rem] text-oh-mute">
              <span>{t("scrubber")}</span>
              <span className="tabular-nums">{yearOf(month)}</span>
            </label>
            <input id="plan-month" type="range" min={0} max={HORIZON - 1} step={1} value={month} aria-valuetext={yearOf(month)} onChange={(e) => { setMonth(Number(e.target.value)); setPlaying(false); setFollowView(true); }} className="h-6 w-full cursor-pointer appearance-none border-0 bg-transparent p-0 focus:outline-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-oh-cream [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-oh-stone [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-oh-stone [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-oh-cream" />
            <div className="flex justify-between text-[0.68rem] tabular-nums text-oh-ash">
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <span key={y}>{t("yearShort", { year: y })}</span>
              ))}
            </div>
          </div>

          <dl className="m-0 mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {counters.map((c) => (
              <div key={c.key} className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-3">
                <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t(`counters.${c.key}`)}</dt>
                <dd className="m-0 mt-1 font-display text-[1.5rem] leading-none tabular-nums text-oh-cream">{c.value}</dd>
                {"sub" in c && c.sub ? <dd className="m-0 mt-1 text-[0.72rem] text-oh-mute">{c.sub}</dd> : null}
              </div>
            ))}
          </dl>

          <ol className="m-0 mt-6 list-none p-0 md:hidden">
            {timelineEntries.map(([m, units]) => (
              <li key={m}>
                <button type="button" onClick={() => { setMonth(m); setSelected(units[0]?.marketKey ?? null); }} className={["flex w-full gap-3 border-l-2 bg-transparent py-2 pl-3 text-left text-[0.85rem]", m <= month ? "border-oh-ember text-oh-cream" : "border-oh-stone text-oh-mute"].join(" ")}>
                  <span className="w-16 shrink-0 tabular-nums text-oh-mute">{yearOf(m)}</span>
                  <span>{units.map((u) => (u.structure === "corporate" ? tm(`${u.marketKey}.name`) : `${tm(`${u.marketKey}.name`)} ${u.name.split(" ").pop()}`)).join(", ")}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <aside className="self-start rounded-lg border border-oh-stone bg-oh-ink p-5 lg:sticky lg:top-32">
          {selectedPin && selectedFirst ? (
            <>
              <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-oh-gold">{t(`structure.${selectedFirst.structure}`)}</p>
              <h2 className="m-0 mt-1 font-display text-[1.6rem] leading-tight text-oh-cream">{tm(`${selectedPin.key}.name`)}</h2>
              <p className="m-0 mt-1 text-[0.8rem] text-oh-mute">{t("opens", { when: yearOf(selectedFirst.openMonth), count: selectedUnits.length })}</p>
              <dl className="m-0 mt-4 grid grid-cols-2 gap-3 text-[0.8rem]">
                {[
                  ["population", fmtCompact(selectedPin.population, { locale }).replace(/^\$/, "")],
                  ["tradeArea", fmtCompact(selectedPin.tradeArea, { locale }).replace(/^\$/, "")],
                  ["daytime", fmtCompact(selectedPin.daytime, { locale }).replace(/^\$/, "")],
                  ["auv", fmtCompact(selectedFirst.steadyRevenue, { locale })],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">{t(`card.${k}`)}</dt>
                    <dd className="m-0 font-display text-[1.2rem] tabular-nums text-oh-cream">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 mt-4 text-[0.85rem] leading-relaxed text-oh-mute">{tm(`${selectedPin.key}.notes`)}</p>
              <p className="m-0 mt-3 text-[0.68rem] text-oh-ash">{t("card.approx")}</p>
            </>
          ) : (
            <p className="m-0 text-[0.85rem] text-oh-mute">{t("card.hint")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
