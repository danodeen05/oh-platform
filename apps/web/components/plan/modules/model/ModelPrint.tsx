import { getFormatter, getTranslations } from "next-intl/server";
import { NO_DEBT, SCENARIOS, SCENARIO_KEYS, computeUnit, fmtYears } from "@oh/plan-model";

/** Print variant of The Model: the three preset scenarios side by side, no interactivity (spec 7.5). */
export async function ModelPrint({ locale }: { locale: string }) {
  const t = await getTranslations("plan.model");
  const fmt = await getFormatter();
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct = (v: number) => fmt.number(v, { style: "percent", maximumFractionDigits: 1 });
  const units = SCENARIO_KEYS.map((k) => ({ key: k, unit: computeUnit(SCENARIOS[k], { loan: NO_DEBT }) }));
  const rows: { label: string; cells: string[]; strong?: boolean }[] = [
    { label: t("print.coversPerDay"), cells: units.map(({ unit }) => fmt.number(unit.location.actualCoversPerDay, { maximumFractionDigits: 0 })) },
    { label: t("results.avgCheck"), cells: units.map(({ unit }) => fmt.number(unit.location.avgCheck, { style: "currency", currency: "USD" })) },
    { label: t("waterfall.revenue"), cells: units.map(({ unit }) => money(unit.location.annualRevenue)), strong: true },
    { label: t("waterfall.cogs"), cells: units.map(({ unit }) => money(unit.location.foodCost + unit.location.packaging)) },
    { label: t("print.grossProfit"), cells: units.map(({ unit }) => money(unit.location.grossProfit)) },
    { label: t("waterfall.labor"), cells: units.map(({ unit }) => money(unit.location.labor)) },
    { label: t("waterfall.occupancy"), cells: units.map(({ unit }) => money(unit.location.occupancy)) },
    { label: t("waterfall.otherOpex"), cells: units.map(({ unit }) => money(unit.location.totalOpex - unit.location.labor - unit.location.occupancy)) },
    { label: t("waterfall.ebitda"), cells: units.map(({ unit }) => money(unit.location.ebitda)), strong: true },
    { label: t("results.margin"), cells: units.map(({ unit }) => pct(unit.location.ebitdaMarginPct)) },
    { label: t("results.revPerSqFt"), cells: units.map(({ unit }) => money(unit.location.revenuePerSqFt)) },
    { label: t("results.breakEven"), cells: units.map(({ unit }) => fmt.number(unit.location.breakEvenCoversPerDay, { maximumFractionDigits: 0 })) },
    { label: t("results.payback"), cells: units.map(({ unit }) => fmtYears(unit.ramp.payback.fromOpening, locale)) },
  ];
  return (
    <table className="mt-6 w-full border-collapse text-[0.85rem]">
      <thead>
        <tr className="border-b border-oh-charcoal/30">
          <th className="py-2 text-left font-normal text-oh-ash">{t("print.line")}</th>
          {units.map(({ key }) => (
            <th key={key} className="py-2 text-right font-normal text-oh-ash">
              {t(`scenario.${key}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={["border-b border-oh-charcoal/10", r.strong ? "font-semibold" : ""].join(" ")}>
            <th scope="row" className="py-1.5 text-left font-inherit text-oh-charcoal">{r.label}</th>
            {r.cells.map((c, i) => (
              <td key={i} className="py-1.5 text-right tabular-nums text-oh-charcoal">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
