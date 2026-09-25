"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { BASE_ASSUMPTIONS, fmtCurrency, fmtInteger } from "@oh/plan-model";
import { PhotoPlaceholder } from "@/components/plan/primitives/PhotoPlaceholder";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";
import { CHART } from "@/components/plan/charts/theme";

const STATES = ["AVAILABLE", "RESERVED", "OCCUPIED", "CLEANING"] as const;
const ROLES = [
  { key: "brothLead", count: 1, kind: "kitchen" as const, hours: "6:00 to 15:00" },
  { key: "slicer", count: 1, kind: "kitchen" as const, hours: "9:00 to 18:00" },
  { key: "noodle", count: 1, kind: "kitchen" as const, hours: "10:00 to 21:00" },
  { key: "assembly", count: 2, kind: "kitchen" as const, hours: "10:30 to 21:30" },
  { key: "runner", count: 2, kind: "kitchen" as const, hours: "10:30 to 21:30" },
  { key: "gm", count: 1, kind: "management" as const, hours: "salaried" },
  { key: "agm", count: 1, kind: "management" as const, hours: "salaried" },
];
const HOURS = Array.from({ length: 16 }, (_, i) => 6 + i);
const COVERAGE: Record<string, [number, number]> = { brothLead: [6, 15], slicer: [9, 18], noodle: [10, 21], assembly: [10.5, 21.5], runner: [10.5, 21.5], gm: [8, 18], agm: [12, 22] };

const NODES = [
  { key: "web", x: 20, y: 20, w: 150, h: 46 },
  { key: "kiosk", x: 190, y: 20, w: 150, h: 46 },
  { key: "admin", x: 360, y: 20, w: 150, h: 46 },
  { key: "api", x: 130, y: 120, w: 270, h: 52 },
  { key: "db", x: 20, y: 220, w: 170, h: 46 },
  { key: "stripe", x: 210, y: 220, w: 130, h: 46 },
  { key: "clerk", x: 360, y: 220, w: 150, h: 46 },
] as const;

/**
 * Operations and Technology (spec 6.8): the platform in plain words, the
 * pod lifecycle, the kitchen display slot, the labor model hour by hour,
 * commissary and broth consistency, and the food-safety pathway.
 */
export function OperationsModule() {
  const t = useTranslations("plan.operations");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % STATES.length), 1800);
    return () => window.clearInterval(id);
  }, [reduce]);
  const a = BASE_ASSUMPTIONS;
  const kitchenAnnual = a.kitchenFTE * a.avgKitchenWage * a.annualHoursPerFTE;
  const mgmtAnnual = a.managerFTE * a.avgManagerSalary;

  return (
    <div data-plan-module="operations" className="flex flex-col gap-14">
      <section className="grid items-start gap-8 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("platform.title")}</h2>
          <p className="m-0 text-[0.9rem] leading-relaxed text-oh-mute">{t("platform.body")}</p>
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0 text-[0.85rem]">
            {NODES.map((n) => (
              <li key={n.key} className="grid grid-cols-[6.5rem_1fr] gap-2 border-b border-oh-stone pb-1.5">
                <span className="text-oh-cream">{t(`platform.nodes.${n.key}.name`)}</span>
                <span className="text-oh-mute">{t(`platform.nodes.${n.key}.role`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <svg viewBox="0 0 530 290" className="block h-auto w-full" role="img" aria-label={t("platform.aria")}>
          {[["web", "api"], ["kiosk", "api"], ["admin", "api"], ["api", "db"], ["api", "stripe"], ["api", "clerk"]].map(([from, to]) => {
            const f = NODES.find((n) => n.key === from) as (typeof NODES)[number];
            const g = NODES.find((n) => n.key === to) as (typeof NODES)[number];
            return <line key={`${from}-${to}`} x1={f.x + f.w / 2} y1={f.y + f.h} x2={g.x + g.w / 2} y2={g.y} stroke={CHART.stone} strokeWidth={1.5} />;
          })}
          {NODES.map((n) => (
            <g key={n.key}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={6} fill={n.key === "api" ? "rgba(193,80,46,0.18)" : CHART.ink} stroke={n.key === "api" ? CHART.ember : CHART.stone} />
              <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} textAnchor="middle" fill={CHART.cream} fontSize={12}>{t(`platform.nodes.${n.key}.name`)}</text>
            </g>
          ))}
        </svg>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("lifecycle.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("lifecycle.subtitle")}</p>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-4" aria-live="off">
          {STATES.map((s, i) => (
            <li key={s} className={["rounded-lg border p-4 transition-colors", i === active ? "border-oh-ember bg-oh-ink" : "border-oh-stone bg-transparent"].join(" ")}>
              <p className={["m-0 text-[0.68rem] uppercase tracking-[0.16em]", i === active ? "text-oh-ember-light" : "text-oh-mute"].join(" ")}>{s}</p>
              <p className="m-0 mt-1 font-display text-[1.1rem] text-oh-cream">{t(`lifecycle.states.${s}.title`)}</p>
              <p className="m-0 mt-1 text-[0.78rem] leading-snug text-oh-mute">{t(`lifecycle.states.${s}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid items-start gap-8 md:grid-cols-[1fr_1fr]">
        <PhotoPlaceholder label={t("kds.label")} needs={t("kds.needs")} />
        <div>
          <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("kds.title")}</h2>
          <p className="m-0 text-[0.9rem] leading-relaxed text-oh-mute">{t("kds.body")}</p>
        </div>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("labor.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("labor.subtitle", { kitchen: a.kitchenFTE, mgmt: a.managerFTE, wage: fmtCurrency(a.avgKitchenWage, { locale, fractionDigits: 2 }), salary: fmtCurrency(a.avgManagerSalary, { locale }), kitchenAnnual: fmtCurrency(kitchenAnnual, { locale }), mgmtAnnual: fmtCurrency(mgmtAnnual, { locale }), burden: fmtInteger(a.payrollBurdenPct * 100, locale) })}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.8rem]">
            <thead>
              <tr className="border-b border-oh-stone text-oh-mute">
                <th className="py-2 pr-3 text-left font-normal">{t("labor.role")}</th>
                <th className="py-2 pr-3 text-right font-normal">{t("labor.count")}</th>
                {HOURS.map((h) => (<th key={h} className="px-0 py-2 text-center font-normal tabular-nums text-[0.65rem]">{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => {
                const [from, to] = COVERAGE[r.key] ?? [0, 0];
                return (
                  <tr key={r.key} className="border-b border-oh-stone">
                    <td className="py-1.5 pr-3 text-oh-cream">{t(`labor.roles.${r.key}`)}<span className="ml-2 text-oh-mute">{r.kind === "management" ? t("labor.salaried") : ""}</span></td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-oh-cream">{r.count}</td>
                    {HOURS.map((h) => (<td key={h} className="p-0.5"><div className={["h-3 rounded-sm", h + 0.5 > from && h < to ? (r.kind === "management" ? "bg-oh-gold/70" : "bg-oh-ember/80") : "bg-oh-ink"].join(" ")} /></td>))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-2 text-[0.75rem] text-oh-mute">{t("labor.note")}</p>
      </section>

      <BenchmarkCallout eyebrow={t("commissary.eyebrow")} claim={t("commissary.claim")} benchmark={t("commissary.text")} />

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("safety.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("safety.subtitle")}</p>
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
          {(["planReview", "haccp", "manager", "inspection", "fireMarshal", "occupancy"] as const).map((k, i) => (
            <li key={k} className="rounded-lg border border-oh-stone bg-oh-ink p-4">
              <p className="m-0 font-display text-[0.9rem] tabular-nums text-oh-ember-light">{String(i + 1).padStart(2, "0")}</p>
              <p className="m-0 mt-1 font-display text-[1.05rem] text-oh-cream">{t(`safety.steps.${k}.title`)}</p>
              <p className="m-0 mt-1 text-[0.8rem] leading-snug text-oh-mute">{t(`safety.steps.${k}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
