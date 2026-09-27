import { getFormatter, getTranslations } from "next-intl/server";
import { FRANCHISE_MARKETS, FRANCHISE_TERMS, HYBRID_EXIT_MULTIPLE, OPENING_SCHEDULE, PARTNERSHIP_TERMS, ROUND_ONE, ROUND_TWO, computeCapitalStack, computeOwnership, computeOwnershipImpact, SCENARIOS, type ScenarioKey } from "@oh/plan-model";

export async function FundingPrint({ locale, scenario = "base" }: { locale: string; scenario?: ScenarioKey }) {
  const t = await getTranslations("plan.funding");
  const fmt = await getFormatter();
  void locale;
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct = (v: number, d = 0) => fmt.number(v, { style: "percent", maximumFractionDigits: d });
  const mult = (v: number, d = 2) => `${fmt.number(v, { maximumFractionDigits: d })}x`;
  const input = { scenario: SCENARIOS[scenario], terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };
  const own = computeOwnership(input);
  const stakes = [0.25, 0.3, 0.35, 0.4, 0.45, 0.49].map((p) => computeOwnershipImpact(input, { partnerPct: p }));
  // Owner decision 2026-09-26: year 5 at the restaurant multiple next to year 7 at the hybrid multiple when it qualifies.
  const cases = [
    { key: "y5", own: own },
    { key: "y7", own: computeOwnership(input, { exitYear: 7, hybrid: true }) },
  ];
  const capValues = (o: typeof own) => ({
    implied: pct(o.partnerPctReturnBased, 1),
    headline: pct(o.partnerPct),
    cap: pct(PARTNERSHIP_TERMS.partnerPctCap),
    target: mult(o.terms.targetMultiple, 1),
    multiple: mult(o.partnerMultipleAtHeadline),
    preferred: mult(o.preferred.partnerMultiple),
    year: o.exitYear,
    ebitda: money(o.exitEbitda),
    exitMult: mult(o.exitMultiple, 1),
    exitValue: money(o.exitValue),
  });
  const td = "py-1.5 text-right tabular-nums text-oh-charcoal";
  return (
    <div className="mt-6 flex flex-col gap-8 text-[0.85rem]">
      <div className="grid grid-cols-2 gap-6">
        {[computeCapitalStack(ROUND_ONE), computeCapitalStack(ROUND_TWO)].map((r) => (
          <table key={r.key} className="w-full border-collapse">
            <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t(`rounds.${r.key}.title`)}: {money(r.totalSources)}</caption>
            <tbody>
              {r.sources.map((s) => (<tr key={s.key} className="border-b border-oh-charcoal/10"><td className="py-1 text-oh-stone">{t(`rounds.keys.${s.key}`)}</td><td className={td}>{money(s.amount)}</td></tr>))}
              {r.uses.map((u) => (<tr key={u.key} className="border-b border-oh-charcoal/10"><td className="py-1 pl-4 text-oh-stone">{t(`rounds.keys.${u.key}`)}</td><td className={td}>{money(u.amount)}</td></tr>))}
            </tbody>
          </table>
        ))}
      </div>
      <p className="m-0 text-oh-charcoal">{t("partner.subtitle", { implied: pct(own.partnerPctReturnBased, 1), headline: pct(own.partnerPct), cap: pct(PARTNERSHIP_TERMS.partnerPctCap) })}</p>
      {cases.map((c) => (
        <div key={c.key} className="border-l-2 border-oh-clay pl-3">
          <p className="m-0 text-[0.7rem] uppercase tracking-[0.14em] text-oh-clay">{t(`print.${c.key}`, { mult: mult(c.key === "y7" ? HYBRID_EXIT_MULTIPLE : PARTNERSHIP_TERMS.exitMultiple, 0) })}</p>
          <p className="m-0 mt-1 leading-relaxed text-oh-charcoal">{c.own.cappedByOwner ? t(c.own.partnerPctReturnBased >= 0.999 ? "partner.capBindsAll" : "partner.capBinds", capValues(c.own)) : t("partner.capClear", capValues(c.own))}</p>
          <table className="mt-2 w-full border-collapse">
            <tbody>
              {([
                ["accruedPreference", money(c.own.preferred.accruedPreference)],
                ["preferencePaidFromDistributions", money(c.own.preferred.preferencePaidFromDistributions)],
                ["preferencePaidAtExit", money(c.own.preferred.preferencePaidAtExit)],
                ["liquidationPaid", money(c.own.preferred.liquidationPaid)],
                ["residualExitValue", money(c.own.preferred.residualExitValue)],
                ["commonDistributions", money(c.own.preferred.commonDistributions)],
              ] as const).map(([k, v]) => (<tr key={k} className="border-b border-oh-charcoal/10"><td className="py-1 text-oh-stone">{t(`preferred.rows.${k}`)}</td><td className={td}>{v}</td></tr>))}
              <tr className="border-b border-oh-charcoal/10"><td className="py-1 text-oh-stone">{t("preferred.cards.partnerCommonPct")}</td><td className={td}>{pct(c.own.preferred.partnerCommonPct)}</td></tr>
              <tr className="font-semibold"><td className="py-1 text-oh-charcoal">{t("preferred.cards.partnerMultiple")}</td><td className={td}>{mult(c.own.preferred.partnerMultiple)}</td></tr>
            </tbody>
          </table>
        </div>
      ))}
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t("partner.grid", { target: mult(PARTNERSHIP_TERMS.targetMultiple, 1), exit: mult(PARTNERSHIP_TERMS.exitMultiple, 1) })}</caption>
        <thead><tr className="border-b border-oh-charcoal/30"><th className="py-1.5 text-left font-normal text-oh-clay">{t("partner.cols.stake")}</th>{stakes.map((s) => (<th key={s.partnerPct} className="py-1.5 text-right font-normal text-oh-clay">{pct(s.partnerPct)}</th>))}</tr></thead>
        <tbody>
          <tr className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t("partner.gridRows.founderTotal")}</td>{stakes.map((s) => (<td key={s.partnerPct} className={td}>{money(s.founderTotal)}</td>))}</tr>
          <tr className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t("partner.gridRows.partnerMultiple")}</td>{stakes.map((s) => (<td key={s.partnerPct} className={td}>{mult(s.partnerMultipleAtExit)}</td>))}</tr>
          <tr className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t("partner.gridRows.buyout")}</td>{stakes.map((s) => (<td key={s.partnerPct} className={td}>{money(s.buyoutAtTarget)}</td>))}</tr>
        </tbody>
      </table>
    </div>
  );
}
