import { getTranslations } from "next-intl/server";
import type { InvariantResult } from "@oh/plan-model";
import { CHECK_AREAS, suitesByArea, type IntegrityData } from "./data";

/**
 * Two layers of checks. The committed test manifest is what the engine's
 * suite proved at the version stamp; the invariants run again on every
 * request against the presets this page is reading, plus the floor plan's
 * own area check, so a broken preset shows up here before it shows up in
 * a meeting.
 */
export async function AutomatedChecks({ data }: { data: IntegrityData }) {
  const t = await getTranslations("plan.integrity.checks");
  const areas = suitesByArea(data.manifest);
  const failing = data.invariants.filter((i) => !i.pass);
  return (
    <section aria-labelledby="integrity-checks">
      <h2 id="integrity-checks" className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">
        {t("title")}
      </h2>
      <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("subtitle")}</p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <p className="m-0 mb-2 text-[0.68rem] uppercase tracking-[0.14em] text-oh-mute">{t("suites", { version: data.manifest.version })}</p>
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr className="border-b border-oh-stone text-left text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">
                <th scope="col" className="py-1.5 font-normal">{t("cols.area")}</th>
                <th scope="col" className="py-1.5 text-right font-normal">{t("cols.suites")}</th>
                <th scope="col" className="py-1.5 text-right font-normal">{t("cols.tests")}</th>
                <th scope="col" className="py-1.5 text-right font-normal">{t("cols.passed")}</th>
              </tr>
            </thead>
            <tbody>
              {CHECK_AREAS.map((a) => (
                <tr key={a} className="border-b border-oh-stone/60">
                  <th scope="row" className="py-1.5 text-left font-normal text-oh-cream">{t(`areas.${a}`)}</th>
                  <td className="py-1.5 text-right tabular-nums text-oh-mute">{areas[a].files}</td>
                  <td className="py-1.5 text-right tabular-nums text-oh-cream">{areas[a].tests}</td>
                  <td className={["py-1.5 text-right tabular-nums", areas[a].passed === areas[a].tests ? "text-oh-olive-light" : "text-oh-ember-light"].join(" ")}>{areas[a].passed}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-1.5 text-left font-normal text-oh-cream">{t("total")}</th>
                <td className="py-1.5 text-right tabular-nums text-oh-mute">{data.manifest.files.length}</td>
                <td className="py-1.5 text-right tabular-nums text-oh-cream">{data.manifest.totalTests}</td>
                <td className={["py-1.5 text-right tabular-nums", data.manifest.failed === 0 ? "text-oh-olive-light" : "text-oh-ember-light"].join(" ")}>{data.manifest.passed}</td>
              </tr>
            </tbody>
          </table>
          <p className="m-0 mt-2 text-[0.75rem] text-oh-mute">{t("coverage", { lines: data.manifest.coverage.lines, functions: data.manifest.coverage.functions, branches: data.manifest.coverage.branches })}</p>
        </div>
        <div>
          <p className="m-0 mb-2 text-[0.68rem] uppercase tracking-[0.14em] text-oh-mute">{t("live", { n: data.invariants.length })}</p>
          <p className={["m-0 mb-2 text-[0.82rem]", failing.length === 0 ? "text-oh-olive-light" : "text-oh-ember-light"].join(" ")} data-invariants-failing={failing.length}>
            {failing.length === 0 ? t("allPass") : t("someFail", { n: failing.length })}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {data.invariants.map((i: InvariantResult) => (
              <li key={i.key} data-invariant={i.key} data-pass={i.pass} className="grid grid-cols-[1.1rem_1fr] gap-2 text-[0.82rem]">
                <span aria-hidden="true" className={["mt-[0.35rem] h-2.5 w-2.5 rounded-full", i.pass ? "bg-oh-olive-light" : "bg-oh-ember-light"].join(" ")} />
                <span>
                  <span className="text-oh-cream">{i.label}</span>
                  <span className="sr-only">{i.pass ? t("pass") : t("fail")}</span>
                  <span className="block text-[0.75rem] tabular-nums text-oh-mute">{i.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
