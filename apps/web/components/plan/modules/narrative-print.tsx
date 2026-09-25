import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BASE, BASE_ASSUMPTIONS, FRANCHISE_MARKETS, FRANCHISE_TERMS, OPENING_SCHEDULE, PARTNERSHIP_TERMS, computeOwnership, computePortfolio } from "@oh/plan-model";
import { SAM_USD, TAM_USD, UTAH_ROWS } from "./market/marketData";
import { ROADMAP } from "./roadmap/roadmapData";

/** Print variants for the narrative sections: the copy, flat, on paper. */

export async function ExperiencePrint() {
  const t = await getTranslations("plan.experience");
  const steps = ["arrive", "order", "walk", "settle", "panel", "taste", "leave"] as const;
  return (
    <div className="mt-6 flex flex-col gap-4 text-[0.9rem] text-oh-charcoal">
      <p className="m-0 font-display text-[1.15rem] leading-snug">{t("intro")}</p>
      {steps.map((s, i) => (
        <div key={s}>
          <p className="m-0 font-display text-[1.05rem]">{String(i + 1).padStart(2, "0")} {t(`steps.${s}.title`)}</p>
          <p className="m-0 mt-1 leading-relaxed text-oh-stone">{t(`steps.${s}.body`)}</p>
        </div>
      ))}
    </div>
  );
}

export async function MarketPrint() {
  const t = await getTranslations("plan.market");
  const tm = await getTranslations("plan.expansion.markets");
  const fmt = await getFormatter();
  const som = computePortfolio(OPENING_SCHEDULE, BASE, { years: 3 }).years[2]?.revenue ?? 0;
  const compact = (v: number) => fmt.number(v, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
  return (
    <div className="mt-6 flex flex-col gap-6 text-[0.85rem] text-oh-charcoal">
      <table className="w-full border-collapse"><tbody>
        {[["tam", TAM_USD, t("tam.tamDef")], ["sam", SAM_USD, t("tam.samDef")], ["som", som, t("tam.somDef")]].map(([k, v, d]) => (
          <tr key={k as string} className="border-b border-oh-charcoal/10"><td className="py-1.5 uppercase tracking-[0.12em] text-oh-clay">{t(`tam.${k as string}`)}</td><td className="py-1.5 text-right tabular-nums font-semibold">{compact(v as number)}</td><td className="py-1.5 pl-4 text-oh-stone">{d as string}</td></tr>
        ))}
      </tbody></table>
      <p className="m-0 leading-relaxed">{t("som.claim", { share: fmt.number(som / TAM_USD, { style: "percent", maximumFractionDigits: 2 }) })} {t("som.text")}</p>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-oh-charcoal/30 text-oh-clay"><th className="py-1.5 text-left font-normal">{t("utah.cols.market")}</th><th className="py-1.5 text-right font-normal">{t("utah.cols.population")}</th><th className="py-1.5 text-right font-normal">{t("utah.cols.growth")}</th><th className="py-1.5 text-right font-normal">{t("utah.cols.income")}</th><th className="py-1.5 text-right font-normal">{t("utah.cols.daytime")}</th><th className="py-1.5 text-right font-normal">{t("utah.cols.asian")}</th></tr></thead>
        <tbody>{UTAH_ROWS.map((r) => (<tr key={r.key} className="border-b border-oh-charcoal/10"><td className="py-1.5">{tm(`${r.key}.name`)}</td><td className="py-1.5 text-right tabular-nums">{fmt.number(r.population)}</td><td className="py-1.5 text-right tabular-nums">{fmt.number(r.growth5y, { style: "percent" })}</td><td className="py-1.5 text-right tabular-nums">{fmt.number(r.householdIncome, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td><td className="py-1.5 text-right tabular-nums">{fmt.number(r.daytimeWorkers)}</td><td className="py-1.5 text-right tabular-nums">{compact(r.asianDiningSpend)}</td></tr>))}</tbody>
      </table>
      <p className="m-0 text-[0.75rem] text-oh-clay">{t("utah.approx")}</p>
    </div>
  );
}

export async function OperationsPrint() {
  const t = await getTranslations("plan.operations");
  const a = BASE_ASSUMPTIONS;
  const fmt = await getFormatter();
  return (
    <div className="mt-6 flex flex-col gap-5 text-[0.85rem] text-oh-charcoal">
      <p className="m-0 leading-relaxed text-oh-stone">{t("platform.body")}</p>
      <p className="m-0 leading-relaxed">{t("labor.subtitle", { kitchen: a.kitchenFTE, mgmt: a.managerFTE, wage: fmt.number(a.avgKitchenWage, { style: "currency", currency: "USD" }), salary: fmt.number(a.avgManagerSalary, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), kitchenAnnual: fmt.number(a.kitchenFTE * a.avgKitchenWage * a.annualHoursPerFTE, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), mgmtAnnual: fmt.number(a.managerFTE * a.avgManagerSalary, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), burden: Math.round(a.payrollBurdenPct * 100) })}</p>
      <div><p className="m-0 font-display text-[1.05rem]">{t("commissary.claim")}</p><p className="m-0 mt-1 leading-relaxed text-oh-stone">{t("commissary.text")}</p></div>
      <ol className="m-0 list-decimal pl-5">{(["planReview", "haccp", "manager", "inspection", "fireMarshal", "occupancy"] as const).map((k) => (<li key={k} className="py-0.5"><span className="font-semibold">{t(`safety.steps.${k}.title`)}.</span> <span className="text-oh-stone">{t(`safety.steps.${k}.body`)}</span></li>))}</ol>
    </div>
  );
}

export async function TeamPrint() {
  const t = await getTranslations("plan.team");
  const locale = await getLocale();
  const own = computeOwnership({ scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });
  const pct = (v: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(v);
  return (
    <div className="mt-6 flex flex-col gap-4 text-[0.85rem] text-oh-charcoal">
      <div><p className="m-0 text-[0.7rem] uppercase tracking-[0.14em] text-oh-clay">{t("founder.role", { pct: pct(own.founderPct) })}</p><p className="m-0 font-display text-[1.3rem]">{t("founder.name")}</p><p className="m-0 mt-1 leading-relaxed text-oh-stone">{t("founder.bio")}</p></div>
      <div><p className="m-0 text-[0.7rem] uppercase tracking-[0.14em] text-oh-clay">{t("partner.role", { pct: pct(own.partnerPct) })}</p><p className="m-0 leading-relaxed text-oh-stone">{t("partner.body", { capital: new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(PARTNERSHIP_TERMS.partnerCapital), cap: pct(PARTNERSHIP_TERMS.partnerPctCap) })}</p></div>
      <p className="m-0 text-oh-stone">Oh! Beef Noodle Soup, LLC. {t("entity.number")} 14642519-0160. {t("entity.structureValue")}. {t("entity.note")}</p>
      <ul className="m-0 list-disc pl-5">{(["operator", "culinary", "franchise"] as const).map((k) => (<li key={k}>{t(`advisory.seats.${k}.title`)}: <span className="text-oh-stone">{t(`advisory.seats.${k}.why`)}</span></li>))}</ul>
    </div>
  );
}

export async function RoadmapPrint() {
  const t = await getTranslations("plan.roadmap");
  const tm = await getTranslations("plan.expansion.markets");
  const label = (key: string, location?: string) => (location && location !== "lehi" && /-(lease|buildout|open)$/.test(key) ? t(`items.${key.replace(/^.*-/, "opening-")}`, { location: tm(`${location}.name`) }) : t(`items.${key}`));
  const fmtM = (m: number) => (m === 0 ? t("t0Label") : `T0 ${m > 0 ? "+" : "−"} ${Math.abs(m).toFixed(m % 1 === 0 ? 0 : 1)}`);
  return (
    <div className="mt-6 text-[0.85rem] text-oh-charcoal">
      <p className="m-0 mb-3 text-oh-stone">{t("t0")}</p>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-oh-charcoal/30 text-oh-clay"><th className="py-1.5 text-left font-normal">{t("workstreams.all")}</th><th className="py-1.5 text-left font-normal"></th><th className="py-1.5 text-right font-normal">{t("t0Label")}</th></tr></thead>
        <tbody>{[...ROADMAP].sort((a, b) => a.start - b.start).map((it) => (<tr key={it.key} className="border-b border-oh-charcoal/10"><td className="py-1">{it.done ? "✓ " : ""}{label(it.key, it.location)}</td><td className="py-1 text-oh-clay">{t(`workstreams.${it.workstream}`)}</td><td className="py-1 text-right tabular-nums">{it.milestone ? fmtM(it.start) : `${fmtM(it.start)} → ${fmtM(it.end)}`}</td></tr>))}</tbody>
      </table>
    </div>
  );
}
