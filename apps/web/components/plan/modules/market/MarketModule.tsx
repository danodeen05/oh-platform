"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BASE, OPENING_SCHEDULE, computePortfolio, fmtCompact, fmtCurrency, fmtInteger, fmtPercent } from "@oh/plan-model";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";
import { CHART } from "@/components/plan/charts/theme";
import { COMPETITORS, SAM_USD, TAM_USD, UTAH_ROWS } from "./marketData";

/**
 * Market Analysis (spec 6.7): TAM / SAM / SOM with SOM deliberately small
 * and said so, Utah trade-area data, the competitive matrix with Oh! in the
 * empty upper right, and the category tailwinds.
 */
export function MarketModule() {
  const t = useTranslations("plan.market");
  const tm = useTranslations("plan.expansion.markets");
  const locale = useLocale();
  const som = useMemo(() => computePortfolio(OPENING_SCHEDULE, BASE, { years: 3 }).years[2]?.revenue ?? 0, []);
  const money = (v: number) => fmtCompact(v, { locale });
  const r = (v: number) => Math.sqrt(v / TAM_USD) * 200;
  const somShare = som / TAM_USD;

  return (
    <div data-plan-module="market" className="flex flex-col gap-14">
      <section className="grid items-center gap-8 md:grid-cols-[minmax(260px,420px)_1fr]">
        <svg viewBox="0 0 440 440" className="mx-auto block h-auto w-full max-w-[420px]" role="img" aria-label={t("tam.aria", { tam: money(TAM_USD), sam: money(SAM_USD), som: money(som) })}>
          <circle cx={220} cy={220} r={r(TAM_USD)} fill="rgba(242,237,228,0.04)" stroke={CHART.stone} />
          <circle cx={220} cy={220 + r(TAM_USD) - r(SAM_USD) - 6} r={r(SAM_USD)} fill="rgba(201,162,39,0.14)" stroke={CHART.gold} />
          <circle cx={220} cy={220 + r(TAM_USD) - Math.max(r(som), 4) - 8} r={Math.max(r(som), 4)} fill={CHART.ember} stroke={CHART.cream} strokeWidth={1.5} />
          <text x={220} y={60} textAnchor="middle" fill={CHART.mute} fontSize={12} style={{ letterSpacing: "0.14em" }}>{t("tam.tam")}</text>
          <text x={220} y={84} textAnchor="middle" fill={CHART.cream} fontSize={22} fontFamily="var(--font-display)">{money(TAM_USD)}</text>
          <text x={220} y={330} textAnchor="middle" fill={CHART.gold} fontSize={12} style={{ letterSpacing: "0.14em" }}>{t("tam.sam")}</text>
          <text x={220} y={352} textAnchor="middle" fill={CHART.cream} fontSize={18} fontFamily="var(--font-display)">{money(SAM_USD)}</text>
          <line x1={220} y1={400} x2={300} y2={425} stroke={CHART.ember} strokeWidth={1} />
          <text x={306} y={429} fill="#E07A5A" fontSize={12} style={{ letterSpacing: "0.14em" }}>{t("tam.som")} {money(som)}</text>
        </svg>
        <div>
          <h2 className="m-0 font-display text-[1.6rem] text-oh-cream">{t("tam.title")}</h2>
          <dl className="m-0 mt-4 flex flex-col gap-3 text-[0.9rem]">
            {[
              ["tam", TAM_USD, t("tam.tamDef")],
              ["sam", SAM_USD, t("tam.samDef")],
              ["som", som, t("tam.somDef")],
            ].map(([k, v, def]) => (
              <div key={k as string} className="grid grid-cols-[4rem_6rem_1fr] items-baseline gap-3 border-b border-oh-stone pb-2">
                <dt className="text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t(`tam.${k as string}`)}</dt>
                <dd className="m-0 font-display text-[1.2rem] tabular-nums text-oh-cream">{money(v as number)}</dd>
                <dd className="m-0 text-[0.82rem] text-oh-mute">{def as string}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 mt-3 text-[0.72rem] text-oh-mute">{t("tam.approx")}</p>
        </div>
      </section>

      <BenchmarkCallout eyebrow={t("som.eyebrow")} claim={t("som.claim", { share: fmtPercent(somShare, locale, 2) })} benchmark={t("som.text")} />

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("utah.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("utah.subtitle")}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.85rem]">
            <thead>
              <tr className="border-b border-oh-stone text-oh-mute">
                <th className="py-2 text-left font-normal">{t("utah.cols.market")}</th>
                <th className="py-2 text-right font-normal">{t("utah.cols.population")}</th>
                <th className="py-2 text-right font-normal">{t("utah.cols.growth")}</th>
                <th className="py-2 text-right font-normal">{t("utah.cols.income")}</th>
                <th className="py-2 text-right font-normal">{t("utah.cols.daytime")}</th>
                <th className="py-2 text-right font-normal">{t("utah.cols.asian")}</th>
              </tr>
            </thead>
            <tbody>
              {UTAH_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-oh-stone text-oh-cream">
                  <td className="py-2">{tm(`${row.key}.name`)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtInteger(row.population, locale)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtPercent(row.growth5y, locale, 0)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtCurrency(row.householdIncome, { locale })}</td>
                  <td className="py-2 text-right tabular-nums">{fmtInteger(row.daytimeWorkers, locale)}</td>
                  <td className="py-2 text-right tabular-nums">{money(row.asianDiningSpend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-2 text-[0.72rem] text-oh-mute">{t("utah.approx")}</p>
      </section>

      <section className="grid items-start gap-8 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("matrix.title")}</h2>
          <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("matrix.subtitle")}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.85rem] text-oh-mute">
            {COMPETITORS.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <span className={["inline-block h-2.5 w-2.5 rounded-full", c.oh ? "bg-oh-ember" : "bg-oh-ash"].join(" ")} />
                <span className={c.oh ? "text-oh-cream" : ""}>{t(`matrix.players.${c.key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <svg viewBox="0 0 420 340" className="block h-auto w-full" role="img" aria-label={t("matrix.aria")}>
          <rect x={50} y={10} width={360} height={290} fill="rgba(242,237,228,0.02)" stroke={CHART.stone} />
          <rect x={230} y={10} width={180} height={145} fill="rgba(193,80,46,0.08)" />
          <line x1={230} y1={10} x2={230} y2={300} stroke={CHART.stone} strokeDasharray="3 3" />
          <line x1={50} y1={155} x2={410} y2={155} stroke={CHART.stone} strokeDasharray="3 3" />
          <text x={230} y={322} textAnchor="middle" fill={CHART.mute} fontSize={11} style={{ letterSpacing: "0.12em" }}>{t("matrix.x")}</text>
          <text x={18} y={155} textAnchor="middle" fill={CHART.mute} fontSize={11} transform="rotate(-90 18 155)" style={{ letterSpacing: "0.12em" }}>{t("matrix.y")}</text>
          <text x={400} y={148} textAnchor="end" fill="#E07A5A" fontSize={10} style={{ letterSpacing: "0.12em" }}>{t("matrix.quadrant")}</text>
          {COMPETITORS.map((c) => {
            const x = 50 + c.efficiency * 360;
            const y = 300 - c.experience * 290;
            return (
              <g key={c.key}>
                <circle cx={x} cy={y} r={c.oh ? 9 : 6} fill={c.oh ? CHART.ember : CHART.ash} stroke={c.oh ? CHART.cream : "none"} strokeWidth={1.5} />
                <text x={x} y={y - (c.oh ? 14 : 11)} textAnchor="middle" fill={c.oh ? CHART.cream : CHART.mute} fontSize={10}>{t(`matrix.players.${c.key}`)}</text>
              </g>
            );
          })}
        </svg>
      </section>

      <section>
        <h2 className="m-0 mb-4 font-display text-[1.5rem] text-oh-cream">{t("tailwinds.title")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(["asianFastCasual", "soloDining", "laborCost", "utahGrowth"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-oh-stone bg-oh-ink p-4">
              <h3 className="m-0 font-display text-[1.1rem] text-oh-cream">{t(`tailwinds.items.${k}.title`)}</h3>
              <p className="m-0 mt-2 text-[0.85rem] leading-relaxed text-oh-mute">{t(`tailwinds.items.${k}.body`)}</p>
            </div>
          ))}
        </div>
        <p className="m-0 mt-4 text-[0.9rem] leading-relaxed text-oh-mute">{t("references")}</p>
      </section>
    </div>
  );
}
