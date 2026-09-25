import { getFormatter, getTranslations } from "next-intl/server";
import { FloorPlanSvg } from "./FloorPlanSvg";
import { AREAS, DINING_SQFT_PER_POD, PODS, TOTAL_SQFT } from "./layout";

/** Static floor plan and breakdown for the print route. */
export async function FloorPlanPrint({ locale }: { locale: string }) {
  const t = await getTranslations("plan.floorPlan");
  const fmt = await getFormatter();
  const labels = { entry: t("zones.entry"), dining: t("zones.dining"), kitchen: t("zones.kitchen"), boh: t("zones.boh"), restrooms: t("zones.restrooms"), kiosk: t("zones.kiosk"), corridor: t("zones.corridor"), aisle: t("zones.aisle"), pass: t("zones.pass") };
  void locale;
  return (
    <div className="mt-6">
      <FloorPlanSvg theme="light" layers={{ pods: true, corridors: true, kitchen: true, boh: true, restrooms: true, entry: true }} labels={labels} className="block h-auto w-full rounded border border-oh-ash/40" />
      <table className="mt-4 w-full border-collapse text-[0.85rem]">
        <tbody>
          {AREAS.map((a) => (
            <tr key={a.key} className="border-b border-oh-charcoal/10">
              <th scope="row" className="py-1.5 text-left font-normal text-oh-charcoal">{t(`areas.${a.key}`)}</th>
              <td className="py-1.5 text-right tabular-nums text-oh-charcoal">{t("areas.sqft", { value: fmt.number(a.sqft) })}</td>
              <td className="py-1.5 pl-3 text-right tabular-nums text-oh-stone">{fmt.number(a.sqft / TOTAL_SQFT, { style: "percent" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 mt-4 text-[0.9rem] text-oh-stone">{t("honesty.claim", { pods: PODS.length, sqft: fmt.number(TOTAL_SQFT), perPod: fmt.number(Math.round(DINING_SQFT_PER_POD)) })}</p>
    </div>
  );
}
