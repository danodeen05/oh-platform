import { getFormatter, getTranslations } from "next-intl/server";
import { BASE, FRANCHISE_MARKETS, OPENING_SCHEDULE, computeTimeline } from "@oh/plan-model";

/** Print variant: the opening schedule and year-end counters, no map. */
export async function ExpansionPrint({ locale }: { locale: string }) {
  const t = await getTranslations("plan.expansion");
  const tm = await getTranslations("plan.expansion.markets");
  const fmt = await getFormatter();
  void locale;
  const timeline = computeTimeline(OPENING_SCHEDULE, FRANCHISE_MARKETS, BASE, { months: 72 });
  const yearEnds = [11, 23, 35, 47, 59, 71].map((m) => timeline.months[m]).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const corporate = timeline.units.filter((u) => u.structure === "corporate");
  return (
    <div className="mt-6 text-[0.85rem]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-oh-charcoal/30 text-oh-ash">
            <th className="py-1.5 text-left font-normal">{t("print.location")}</th>
            <th className="py-1.5 text-left font-normal">{t("print.structure")}</th>
            <th className="py-1.5 text-right font-normal">{t("print.opens")}</th>
            <th className="py-1.5 text-right font-normal">{t("card.auv")}</th>
          </tr>
        </thead>
        <tbody>
          {corporate.map((u) => (
            <tr key={u.key} className="border-b border-oh-charcoal/10 text-oh-charcoal">
              <td className="py-1.5">{tm(`${u.marketKey}.name`)}</td>
              <td className="py-1.5">{t(`structure.${u.structure}`)}</td>
              <td className="py-1.5 text-right tabular-nums">{t("month", { year: Math.floor(u.openMonth / 12) + 1, month: (u.openMonth % 12) + 1 })}</td>
              <td className="py-1.5 text-right tabular-nums">{fmt.number(u.steadyRevenue, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
            </tr>
          ))}
          {FRANCHISE_MARKETS.map((m) => {
            const units = timeline.units.filter((u) => u.marketKey === m.key);
            const first = units[0];
            return first ? (
              <tr key={m.key} className="border-b border-oh-charcoal/10 text-oh-charcoal">
                <td className="py-1.5">{tm(`${m.key}.name`)} ({units.length})</td>
                <td className="py-1.5">{t(`structure.${m.structure}`)}</td>
                <td className="py-1.5 text-right tabular-nums">{t("month", { year: Math.floor(first.openMonth / 12) + 1, month: (first.openMonth % 12) + 1 })}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt.number(first.steadyRevenue, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
              </tr>
            ) : null;
          })}
        </tbody>
      </table>
      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b border-oh-charcoal/30 text-oh-ash">
            <th className="py-1.5 text-left font-normal">{t("print.yearEnd")}</th>
            {yearEnds.map((m) => (
              <th key={m.month} className="py-1.5 text-right font-normal">{t("yearShort", { year: Math.floor(m.month / 12) + 1 })}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["locations", (m: (typeof yearEnds)[number]) => fmt.number(m.locationsOpen)],
            ["pods", (m: (typeof yearEnds)[number]) => fmt.number(m.podsInService)],
            ["runRate", (m: (typeof yearEnds)[number]) => fmt.number(m.runRateRevenue, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 })],
            ["covers", (m: (typeof yearEnds)[number]) => fmt.number(m.cumulativeCovers, { notation: "compact", maximumFractionDigits: 1 })],
          ].map(([k, f]) => (
            <tr key={k as string} className="border-b border-oh-charcoal/10 text-oh-charcoal">
              <th scope="row" className="py-1.5 text-left font-normal">{t(`counters.${k as string}`)}</th>
              {yearEnds.map((m) => (
                <td key={m.month} className="py-1.5 text-right tabular-nums">{(f as (m: (typeof yearEnds)[number]) => string)(m)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
