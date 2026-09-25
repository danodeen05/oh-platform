import { getFormatter, getTranslations } from "next-intl/server";
import { BASE, FRANCHISE_MARKETS, FRANCHISE_TERMS, OPENING_SCHEDULE, PARTNERSHIP_TERMS, ROUND_ONE, ROUND_TWO, computeCapitalStack, computeOwnership, computeOwnershipImpact } from "@oh/plan-model";

export async function FundingPrint({ locale }: { locale: string }) {
  const t = await getTranslations("plan.funding");
  const fmt = await getFormatter();
  void locale;
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct = (v: number) => fmt.number(v, { style: "percent", maximumFractionDigits: 0 });
  const input = { scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };
  const own = computeOwnership(input);
  const stakes = [0.25, 0.3, 0.35, 0.4, 0.45, 0.49].map((p) => computeOwnershipImpact(input, { partnerPct: p }));
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
      <p className="m-0 text-oh-charcoal">{t("partner.subtitle", { implied: fmt.number(own.partnerPctReturnBased, { style: "percent", maximumFractionDigits: 1 }), headline: pct(own.partnerPct), cap: pct(PARTNERSHIP_TERMS.partnerPctCap) })}</p>
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t("partner.grid", { target: `${PARTNERSHIP_TERMS.targetMultiple}x`, exit: `${PARTNERSHIP_TERMS.exitMultiple}x` })}</caption>
        <thead><tr className="border-b border-oh-charcoal/30"><th className="py-1.5 text-left font-normal text-oh-clay">{t("partner.cols.stake")}</th>{stakes.map((s) => (<th key={s.partnerPct} className="py-1.5 text-right font-normal text-oh-clay">{pct(s.partnerPct)}</th>))}</tr></thead>
        <tbody>
          <tr className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t("partner.gridRows.founderTotal")}</td>{stakes.map((s) => (<td key={s.partnerPct} className={td}>{money(s.founderTotal)}</td>))}</tr>
          <tr className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t("partner.gridRows.partnerMultiple")}</td>{stakes.map((s) => (<td key={s.partnerPct} className={td}>{fmt.number(s.partnerMultipleAtExit, { maximumFractionDigits: 2 })}x</td>))}</tr>
          <tr className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t("partner.gridRows.buyout")}</td>{stakes.map((s) => (<td key={s.partnerPct} className={td}>{money(s.buyoutAtTarget)}</td>))}</tr>
        </tbody>
      </table>
    </div>
  );
}
