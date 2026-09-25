"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CHART } from "@/components/plan/charts/theme";
import { ROADMAP, ROADMAP_END, ROADMAP_START, WORKSTREAMS, type Workstream } from "./roadmapData";

const COLORS: Record<Workstream, string> = { realEstate: CHART.ember, buildout: CHART.clay, legal: CHART.gold, technology: CHART.olive, capital: "#B98C5A", hiring: CHART.ash };
const ROW = 26;
const LEFT = 250;
const W = 1000;

/**
 * Roadmap and Milestones (spec 6.11): a Gantt from a year before the
 * flagship opens to the first franchise opening, filterable by workstream.
 * Months are relative to T0 so the chart never goes stale; done items are
 * checked.
 */
export function RoadmapModule() {
  const t = useTranslations("plan.roadmap");
  const tm = useTranslations("plan.expansion.markets");
  const [filter, setFilter] = useState<Workstream | "all">("all");
  const items = ROADMAP.filter((i) => filter === "all" || i.workstream === filter);
  const span = ROADMAP_END - ROADMAP_START;
  const x = (m: number) => LEFT + ((m - ROADMAP_START) / span) * (W - LEFT - 20);
  const height = 40 + items.length * ROW;
  const label = (key: string, location?: string) => (location && !["lehi"].includes(location) && /-(lease|buildout|open)$/.test(key) ? t(`items.${key.replace(/^.*-/, "opening-")}`, { location: tm(`${location}.name`) }) : t(`items.${key}`));
  const done = ROADMAP.filter((i) => i.done).length;

  return (
    <div data-plan-module="roadmap">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", ...WORKSTREAMS] as const).map((w) => (
          <button key={w} type="button" aria-pressed={filter === w} onClick={() => setFilter(w)} className={["bg-transparent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.78rem]", filter === w ? "border-oh-cream text-oh-cream" : "border-oh-stone text-oh-mute hover:text-oh-cream"].join(" ")}>
            {w !== "all" ? <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[w] }} /> : null}
            {t(`workstreams.${w}`)}
          </button>
        ))}
        <span className="ml-auto text-[0.78rem] text-oh-mute">{t("done", { done, total: ROADMAP.length })}</span>
      </div>
      <p className="m-0 mb-3 text-[0.8rem] text-oh-mute">{t("t0")}</p>
      <div className="overflow-x-auto rounded-lg border border-oh-stone bg-oh-charcoal">
        <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full min-w-[760px]" role="img" aria-label={t("aria")}>
          {Array.from({ length: Math.floor(span / 12) + 1 }, (_, i) => ROADMAP_START + i * 12).map((m) => (
            <g key={m}>
              <line x1={x(m)} y1={24} x2={x(m)} y2={height - 6} stroke={m === 0 ? CHART.cream : CHART.stone} strokeWidth={m === 0 ? 1.2 : 0.8} strokeDasharray={m === 0 ? undefined : "3 4"} />
              <text x={x(m) + 4} y={16} fill={m === 0 ? CHART.cream : CHART.mute} fontSize={10} style={{ fontVariantNumeric: "tabular-nums" }}>{m === 0 ? t("t0Label") : t("yearLabel", { n: m / 12 })}</text>
            </g>
          ))}
          {items.map((it, i) => {
            const y = 34 + i * ROW;
            const color = COLORS[it.workstream];
            return (
              <g key={it.key}>
                <text x={LEFT - 10} y={y + 13} textAnchor="end" fill={it.done ? CHART.cream : CHART.mute} fontSize={11}>
                  {it.done ? "✓ " : ""}
                  {label(it.key, it.location)}
                </text>
                {it.milestone ? (
                  <polygon points={`${x(it.start)},${y + 2} ${x(it.start) + 8},${y + 10} ${x(it.start)},${y + 18} ${x(it.start) - 8},${y + 10}`} fill={it.done ? CHART.cream : color} />
                ) : (
                  <rect x={x(it.start)} y={y + 3} width={Math.max(4, x(it.end) - x(it.start))} height={14} rx={3} fill={color} opacity={it.done ? 1 : 0.85} />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="m-0 mt-3 text-[0.75rem] text-oh-mute">{t("note")}</p>
    </div>
  );
}
