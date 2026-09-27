import { getFormatter, getTranslations } from "next-intl/server";
import { FloorPlanSvg, type LabelKey } from "./FloorPlanSvg";
import {
  AREAS,
  BUILDING,
  DIMS,
  DINING_SQFT_PER_POD,
  JOURNEY_POD,
  JOURNEY_REAL_SECONDS,
  JOURNEY_SECONDS,
  JOURNEY_STEPS,
  LAYER_KEYS,
  POD,
  PODS,
  SHELL_FACTS,
  TERRITORY_TOTALS,
  TOTAL_SQFT,
  journeyMarkers,
  type Actor,
  type JourneyStep,
  type LayerKey,
} from "./layout";

function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Print version (spec 7.5): flat on paper, no controls. The blueprint with
 * territory tints and both flow loops, the areas table, the shell facts, the
 * three service moves, the journey as a table, the honesty line, then the
 * concept sketch on its own page.
 */
export async function FloorPlanPrint({ locale }: { locale: string }) {
  void locale;
  const t = await getTranslations("plan.floorPlan");
  const fmt = await getFormatter();
  const labelKeys: LabelKey[] = ["title", "kitchen", "dish", "boh", "restroomHall", "restroomMen", "restroomWomen", "store", "lobby", "kiosk", "corridor", "aisle", "crossAisle", "pass", "entry", "exit", "staffDoor", "receiving", "ft"];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(`zones.${k}`)])) as Record<LabelKey, string>;
  const layers = Object.fromEntries(LAYER_KEYS.map((k) => [k, true])) as Record<LayerKey, boolean>;
  const end = journeyMarkers(0.76);
  const actorLabel = (a: Actor): string => t(`journey.actors.${a}`);
  const stepText = (key: JourneyStep["key"]): string => t(`journey.steps.${key}`, { pod: JOURNEY_POD });
  const th = "border-b border-oh-charcoal/20 py-1.5 text-left text-[0.7rem] font-normal uppercase tracking-[0.12em] text-oh-clay";
  const td = "border-b border-oh-charcoal/10 py-1.5 align-top text-[0.85rem] text-oh-charcoal";

  return (
    <div className="flex flex-col gap-8">
      <figure className="m-0">
        <FloorPlanSvg theme="light" mode="territory" layers={layers} labels={labels} activePod={JOURNEY_POD} guest={end.guest} bowl={end.bowl} idPrefix="print" className="block h-auto w-full rounded border border-oh-ash/40" />
        <figcaption className="mt-2 text-[0.8rem] text-oh-stone">
          {t("legend.staff")} · {t("legend.guest")} · {t("legend.hatch")}. {t("legend.touch", { hatches: SHELL_FACTS.hatches })}
        </figcaption>
      </figure>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="m-0 mb-2 font-display text-[1.2rem] text-oh-charcoal">{t("areas.title")}</h3>
          <table className="w-full border-collapse">
            <tbody>
              {AREAS.map((a) => (
                <tr key={a.key}>
                  <th scope="row" className={`${td} font-normal`}>{t(`areas.${a.key}`)}</th>
                  <td className={`${td} text-right tabular-nums`}>{t("areas.sqft", { value: fmt.number(a.sqft) })}</td>
                  <td className={`${td} text-right tabular-nums text-oh-stone`}>{fmt.number(a.sqft / TOTAL_SQFT, { style: "percent" })}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className={`${td} font-normal text-oh-stone`}>{t("areas.staffTotal")}</th>
                <td className={`${td} text-right tabular-nums text-oh-stone`}>{t("areas.sqft", { value: fmt.number(TERRITORY_TOTALS.staff) })}</td>
                <td className={`${td} text-right tabular-nums text-oh-stone`}>{fmt.number(TERRITORY_TOTALS.staff / TOTAL_SQFT, { style: "percent" })}</td>
              </tr>
              <tr>
                <th scope="row" className={`${td} font-normal text-oh-stone`}>{t("areas.guestTotal")}</th>
                <td className={`${td} text-right tabular-nums text-oh-stone`}>{t("areas.sqft", { value: fmt.number(TERRITORY_TOTALS.guest) })}</td>
                <td className={`${td} text-right tabular-nums text-oh-stone`}>{fmt.number(TERRITORY_TOTALS.guest / TOTAL_SQFT, { style: "percent" })}</td>
              </tr>
              <tr>
                <th scope="row" className={`${td} font-normal`}>{t("areas.total")}</th>
                <td className={`${td} text-right tabular-nums`}>{t("areas.sqft", { value: fmt.number(TOTAL_SQFT) })}</td>
                <td className={`${td} text-right tabular-nums text-oh-stone`}>{fmt.number(1, { style: "percent" })}</td>
              </tr>
            </tbody>
          </table>
          <p className="m-0 mt-2 text-[0.8rem] text-oh-stone">{t("areas.landlordLine", { w: BUILDING.w, d: BUILDING.h })}</p>
        </div>
        <div>
          <h3 className="m-0 mb-2 font-display text-[1.2rem] text-oh-charcoal">{t("facts.title")}</h3>
          <table className="w-full border-collapse">
            <tbody>
              {[
                [t("facts.footprint"), t("facts.footprintValue", { w: SHELL_FACTS.w, d: SHELL_FACTS.d })],
                [t("facts.area"), t("facts.areaValue", { sqft: fmt.number(SHELL_FACTS.sqft) })],
                [t("facts.front"), t("facts.frontValue", { w: SHELL_FACTS.frontFt })],
                [t("facts.doors"), t("facts.doorsValue", { count: SHELL_FACTS.doors })],
                [t("facts.kitchen"), t("facts.kitchenValue", { depth: SHELL_FACTS.kitchenDepth })],
                [t("facts.widths"), t("facts.widthsValue", { corridor: SHELL_FACTS.corridorW, aisle: SHELL_FACTS.aisleW, cross: SHELL_FACTS.crossAisle })],
                [t("facts.fixtures"), t("facts.fixturesValue", { pods: SHELL_FACTS.pods, kiosks: SHELL_FACTS.kiosks, restrooms: SHELL_FACTS.restrooms })],
              ].map(([k, v]) => (
                <tr key={k}>
                  <th scope="row" className={`${td} w-[38%] font-normal text-oh-stone`}>{k}</th>
                  <td className={`${td} tabular-nums`}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-2 text-[0.75rem] text-oh-stone">{t("facts.note")}</p>
        </div>
      </div>

      <div>
        <h3 className="m-0 mb-1 font-display text-[1.2rem] text-oh-charcoal">{t("explainer.title")}</h3>
        <p className="m-0 mb-3 text-[0.9rem] text-oh-stone">{t("explainer.lede")}</p>
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {(["kitchen", "corridor", "hatch"] as const).map((k, i) => (
            <li key={k}>
              <p className="m-0 font-display text-[0.8rem] tracking-[0.2em] text-oh-clay">{String(i + 1).padStart(2, "0")}</p>
              <h4 className="m-0 font-display text-[1.05rem] text-oh-charcoal">{t(`explainer.${k}.title`)}</h4>
              <p className="m-0 text-[0.85rem] leading-snug text-oh-stone">{t(`explainer.${k}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="m-0 mb-2 font-display text-[1.2rem] text-oh-charcoal">{t("journey.title")}</h3>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={`${th} w-[4.5rem]`}>{fmtClock(0)}</th>
              <th scope="col" className={th}>{actorLabel("guest")}</th>
              <th scope="col" className={th}>{actorLabel("kitchen")}</th>
            </tr>
          </thead>
          <tbody>
            {JOURNEY_STEPS.map((s) => (
              <tr key={s.key} className={s.at === null ? "text-oh-stone" : ""}>
                <th scope="row" className={`${td} font-display font-normal tabular-nums`}>{fmtClock(s.realSeconds)}</th>
                <td className={td}>{s.actor === "guest" || s.actor === "both" ? stepText(s.key) : ""}</td>
                <td className={td}>{s.actor === "kitchen" ? stepText(s.key) : s.actor === "both" ? "↔" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 mt-2 text-[0.75rem] text-oh-stone">
          {t("journey.note", { real: fmtClock(JOURNEY_REAL_SECONDS), anim: JOURNEY_SECONDS })}
        </p>
      </div>

      <div className="border-l-2 border-oh-clay pl-4">
        <p className="m-0 font-display text-[1.15rem] leading-snug text-oh-charcoal">
          {t("honesty.claim", { pods: PODS.length, sqft: fmt.number(TOTAL_SQFT), perPod: Math.round(DINING_SQFT_PER_POD) })}
        </p>
        <p className="m-0 mt-2 text-[0.9rem] leading-relaxed text-oh-stone">{t("honesty.text", { w: POD.w.toFixed(2), d: POD.d.toFixed(1), corridor: DIMS.corridorW, aisle: DIMS.aisleW })}</p>
      </div>

      <figure className="m-0 break-before-page">
        <h3 className="m-0 mb-2 font-display text-[1.2rem] text-oh-charcoal">{t("blueprint.title")}</h3>
        <p className="m-0 mb-3 text-[0.85rem] text-oh-stone">{t("blueprint.lede")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/plan/blueprint-comb-900.webp" width={900} height={1200} alt={t("blueprint.alt")} className="mx-auto block h-auto max-h-[8.5in] w-auto max-w-full rounded border border-oh-ash/40" />
        <figcaption className="mt-2 text-[0.8rem] text-oh-stone">{t("blueprint.caption")}</figcaption>
      </figure>
    </div>
  );
}
