"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  NO_DEBT,
  SCENARIOS,
  compareToTraditional,
  computeUnit,
  encodeScenario,
  fmtCompact,
  fmtCurrency,
  fmtInteger,
  fmtPercent,
  fmtYears,
  type LeverKey,
  type ScenarioKey,
} from "@oh/plan-model";
import { AssumptionSlider } from "@/components/plan/controls/AssumptionSlider";
import { ScenarioToggle } from "@/components/plan/controls/ScenarioToggle";
import { Waterfall, type WaterfallStep } from "@/components/plan/charts/Waterfall";
import { DataTableToggle } from "@/components/plan/primitives/DataTableToggle";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";
import { MODEL_LEVERS, type LeverFormat } from "./levers";

type Overrides = Partial<Record<LeverKey, number>>;

interface Props {
  initialScenario: ScenarioKey;
  initialOverrides: Overrides;
  /** The code's default scenario; "Reset" returns here. */
  homeScenario: ScenarioKey;
}

const PUBLIC_EBITDA_TARGET = 0.25;

/**
 * The Model (spec 6.1). Every figure on screen is recomputed from the
 * engine on each slider move; nothing is typed in. State is just the
 * scenario key plus lever overrides, which is also what a share link holds.
 */
export function ModelModule({ initialScenario, initialOverrides, homeScenario }: Props) {
  const t = useTranslations("plan.model");
  const locale = useLocale();
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>(initialScenario);
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const scenario = SCENARIOS[scenarioKey];
  const custom = Object.keys(overrides).length > 0;
  const assumptions = useMemo(() => ({ ...scenario.assumptions, ...overrides }), [scenario, overrides]);
  const unit = useMemo(() => computeUnit(scenario, { loan: NO_DEBT, assumptions }), [scenario, assumptions]);
  const loc = unit.location;

  const money = useCallback((v: number) => fmtCompact(v, { locale }), [locale]);
  const fmtLever = useCallback(
    (format: LeverFormat, v: number): string => {
      switch (format) {
        case "percent":
          return fmtPercent(v, locale, 0);
        case "currency":
          return fmtCurrency(v, { locale });
        case "currency2":
          return fmtCurrency(v, { locale, fractionDigits: 2 });
        case "minutes":
          return t("minutes", { value: fmtInteger(v, locale) });
        case "integer":
          return fmtInteger(v, locale);
      }
    },
    [locale, t],
  );

  const setLever = (key: LeverKey, value: number): void => {
    setOverrides((prev) => {
      const next: Overrides = { ...prev };
      if (Math.abs(value - scenario.assumptions[key]) < 1e-9) delete next[key];
      else next[key] = value;
      return next;
    });
  };
  const pickScenario = (key: ScenarioKey): void => {
    setScenarioKey(key);
    setOverrides({});
  };
  const reset = (): void => pickScenario(homeScenario);
  const share = async (): Promise<void> => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", encodeScenario({ base: scenarioKey, overrides }));
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt(t("actions.copyManually"), url.toString());
    }
  };

  const otherOpex = loc.totalOpex - loc.labor - loc.occupancy;
  const steps: WaterfallStep[] = [
    { key: "revenue", label: t("waterfall.revenue"), amount: loc.annualRevenue, kind: "total" },
    { key: "cogs", label: t("waterfall.cogs"), amount: -(loc.foodCost + loc.packaging), kind: "cost" },
    { key: "labor", label: t("waterfall.labor"), amount: -loc.labor, kind: "cost" },
    { key: "occupancy", label: t("waterfall.occupancy"), amount: -loc.occupancy, kind: "cost" },
    { key: "other", label: t("waterfall.otherOpex"), amount: -otherOpex, kind: "cost" },
    { key: "ebitda", label: t("waterfall.ebitda"), amount: loc.ebitda, kind: "result" },
  ];
  const comparison = compareToTraditional(loc);

  const results = [
    { key: "revenue", value: money(loc.annualRevenue), accent: true },
    { key: "ebitda", value: money(loc.ebitda), sub: fmtPercent(loc.ebitdaMarginPct, locale, 1) },
    { key: "payback", value: fmtYears(unit.ramp.payback.fromOpening, locale) },
    { key: "breakEven", value: fmtInteger(loc.breakEvenCoversPerDay, locale), sub: t("results.ofCovers", { covers: fmtInteger(loc.actualCoversPerDay, locale) }) },
    { key: "revPerSqFt", value: fmtCurrency(loc.revenuePerSqFt, { locale }) },
    { key: "avgCheck", value: fmtCurrency(loc.avgCheck, { locale, fractionDigits: 2 }) },
  ];

  const controls = (
    <div className="flex flex-col gap-1">
      {MODEL_LEVERS.map((l) => (
        <AssumptionSlider
          key={l.key}
          lever={l.key}
          label={t(`levers.${l.key}`)}
          value={assumptions[l.key]}
          baseline={scenario.assumptions[l.key]}
          display={fmtLever(l.format, assumptions[l.key])}
          onChange={(v) => setLever(l.key, v)}
          {...(l.min !== undefined ? { min: l.min } : {})}
          {...(l.max !== undefined ? { max: l.max } : {})}
          {...(l.step !== undefined ? { step: l.step } : {})}
        />
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="rounded-md border border-oh-stone bg-transparent px-3 py-1.5 text-[0.8rem] text-oh-mute hover:text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember">
          {t("actions.reset")}
        </button>
        <button type="button" onClick={() => void share()} className="rounded-md bg-oh-ember px-3 py-1.5 text-[0.8rem] font-semibold text-oh-cream hover:bg-oh-clay focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-cream">
          {copied ? t("actions.copied") : t("actions.share")}
        </button>
      </div>
    </div>
  );

  return (
    <div data-plan-module="model">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ScenarioToggle
          value={scenarioKey}
          custom={custom}
          labels={{ conservative: t("scenario.conservative"), base: t("scenario.base"), aggressive: t("scenario.aggressive"), custom: t("scenario.custom") }}
          onChange={pickScenario}
        />
        <p className="m-0 text-[0.8rem] text-oh-mute">{t("hint")}</p>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(260px,320px)_1fr]">
        <aside className="hidden self-start md:sticky md:top-32 md:block">
          <h2 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("leversTitle")}</h2>
          {controls}
        </aside>

        <div>
          <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {results.map((r) => (
              <div key={r.key} className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-4">
                <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-oh-mute">{t(`results.${r.key}`)}</dt>
                <dd className={["m-0 mt-1 font-display text-[1.7rem] leading-none tabular-nums", r.accent ? "text-oh-ember" : "text-oh-cream"].join(" ")}>{r.value}</dd>
                {r.sub ? <dd className="m-0 mt-1 text-[0.75rem] tabular-nums text-oh-mute">{r.sub}</dd> : null}
              </div>
            ))}
          </dl>
          <p className="m-0 mt-3 text-[0.8rem] text-oh-mute">
            {t("publicTarget", { target: fmtPercent(PUBLIC_EBITDA_TARGET, locale, 0), margin: fmtPercent(loc.ebitdaMarginPct, locale, 1) })}
          </p>

          <section className="mt-10">
            <h2 className="m-0 mb-3 font-display text-[1.4rem] text-oh-cream">{t("waterfall.title")}</h2>
            <DataTableToggle
              labels={{ showTable: t("table.show"), showChart: t("table.hide") }}
              chart={<Waterfall steps={steps} format={money} />}
              table={
                <table className="w-full border-collapse text-[0.9rem]">
                  <tbody>
                    {steps.map((s) => (
                      <tr key={s.key} className="border-b border-oh-stone">
                        <th scope="row" className="py-2 text-left font-normal text-oh-mute">{s.label}</th>
                        <td className="py-2 text-right tabular-nums text-oh-cream">{fmtCurrency(s.amount, { locale })}</td>
                        <td className="py-2 pl-4 text-right tabular-nums text-oh-mute">{loc.annualRevenue > 0 ? fmtPercent(Math.abs(s.amount) / loc.annualRevenue, locale, 1) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
          </section>

          <section className="mt-10">
            <h2 className="m-0 mb-1 font-display text-[1.4rem] text-oh-cream">{t("compare.title")}</h2>
            <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("compare.subtitle")}</p>
            <div className="flex flex-col gap-3">
              {comparison.map((row) => (
                <div key={row.key} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-[0.8rem] sm:grid-cols-[9rem_1fr]">
                  <span className="text-oh-mute">{t(`compare.rows.${row.key}`)}</span>
                  <div className="flex flex-col gap-1">
                    {[
                      { label: t("compare.traditional"), v: row.traditional, color: "bg-oh-stone" },
                      { label: t("compare.oh"), v: row.oh, color: row.key === "ebitda" ? "bg-oh-olive" : "bg-oh-ember" },
                    ].map((b) => (
                      <div key={b.label} className="flex items-center gap-2">
                        <div className="h-3 flex-1 rounded-sm bg-oh-ink">
                          <div className={`h-3 rounded-sm ${b.color}`} style={{ width: `${Math.min(100, Math.max(0, b.v) * 200)}%` }} />
                        </div>
                        <span className="w-14 text-right tabular-nums text-oh-cream">{fmtPercent(b.v, locale, 1)}</span>
                        <span className="w-16 text-oh-mute">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <BenchmarkCallout eyebrow={t("benchmark.eyebrow")} claim={t("benchmark.claim", { value: fmtCurrency(loc.revenuePerSqFt, { locale }) })} benchmark={t("benchmark.text")} />
        </div>
      </div>

      {/* Phone: assumptions live in a bottom sheet above the section nav; results stay on top. */}
      <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-30 md:hidden">
        {sheetOpen ? (
          <div className="max-h-[52vh] overflow-y-auto border-t border-oh-stone bg-oh-charcoal/98 px-4 pb-4 pt-3 shadow-[0_-12px_30px_rgba(0,0,0,0.5)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("leversTitle")}</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="rounded-md border border-oh-stone bg-transparent px-2 py-1 text-[0.75rem] text-oh-mute">
                {t("actions.close")}
              </button>
            </div>
            {controls}
          </div>
        ) : (
          <div className="flex justify-center pb-2">
            <button type="button" onClick={() => setSheetOpen(true)} className="rounded-full bg-oh-ember px-4 py-2 text-[0.8rem] font-semibold text-oh-cream shadow-lg">
              {t("actions.adjust")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
