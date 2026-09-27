import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { MODEL_VERSION, MODEL_VERSION_LABEL, type ModelSnapshot } from "@oh/plan-model";
import { getPlanSession } from "@/lib/plan/session.server";
import { CHECK_AREAS, integrityData, suitesByArea } from "./data";
import { formatBenchmarkBand, formatBenchmarkValue, formatRegistryValue, type UnitLabels } from "./format";

const STATIC_GROUPS = new Set(["physical", "throughput", "revenue", "menu", "cogs", "labor", "occupancy", "otherOpex", "escalation", "ramp", "capexFlagship", "capexSubsequent", "franchise", "partnership", "loan", "fx"]);

/**
 * Print variant: the certificate, the scorecard, the checks, the headline
 * change cards, the open items, and the static register groups in full.
 * The dynamic groups (markets, structures, overhead roles, rounds) print as
 * counts; they are on the interactive page and in the diligence package.
 */
export async function IntegrityPrint() {
  const [t, tr, locale, fmt, claims] = await Promise.all([getTranslations("plan.integrity"), getTranslations("plan.integrity.register"), getLocale(), getFormatter(), getPlanSession()]);
  const data = integrityData(claims?.aud ?? "INVESTOR");
  const units: UnitLabels = { hours: tr("units.hours"), days: tr("units.days"), minutes: tr("units.minutes"), months: tr("units.months"), years: tr("units.years"), oz: tr("units.oz"), perYear: tr("units.perYear"), perMonth: tr("units.perMonth"), perHour: tr("units.perHour"), perSqFt: tr("units.perSqFt"), perLb: tr("units.perLb"), yes: tr("units.yes"), no: tr("units.no") };
  const areas = suitesByArea(data.manifest);
  const latest = data.snapshots[data.snapshots.length - 1] as ModelSnapshot;
  const previous = (data.snapshots[0] as ModelSnapshot | undefined) ?? latest;
  const versionLabel = (s: ModelSnapshot): string => {
    const key = `changelog.versions.v${s.version.replace(/\./g, "_")}`;
    return t.has(key) ? t(key) : s.label;
  };
  const STEP_KEYS = ["ebitdaMargin", "paybackFromOpening", "partnerPct", "totalCapital"] as const;
  const staticRows = data.rows.filter((r) => STATIC_GROUPS.has(r.group));
  const dynamicRows = data.rows.filter((r) => !STATIC_GROUPS.has(r.group));
  const dynamicCounts = [...new Set(dynamicRows.map((r) => r.group))].map((g) => `${tr(`groups.${g}`)} ${dynamicRows.filter((r) => r.group === g).length}`);
  const date = (iso: string) => fmt.dateTime(new Date(`${iso}T12:00:00Z`), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const showDelta = (key: string, v: number | null): string => {
    if (v === null) return "–";
    if (key === "ebitdaMargin" || key === "partnerPct") return fmt.number(v, { style: "percent", maximumFractionDigits: 1 });
    if (key === "paybackFromOpening") return fmt.number(v, { maximumFractionDigits: 1 });
    return fmt.number(v, { style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  const head = "border-b border-oh-charcoal/30 text-left text-[0.62rem] uppercase tracking-[0.12em] text-oh-clay";
  const cell = "border-b border-oh-charcoal/10 py-1 align-top";

  return (
    <div className="mt-6 flex flex-col gap-6 text-[0.8rem] text-oh-charcoal">
      <div className="rounded border border-oh-charcoal/20 px-4 py-3">
        <p className="m-0 font-display text-[1.15rem]">{t("cert.title", { version: MODEL_VERSION })}</p>
        <p className="m-0 text-oh-stone">{MODEL_VERSION_LABEL}</p>
        <p className="m-0 mt-1 text-oh-stone">
          {t("cert.testsValue", { tests: data.manifest.totalTests, files: data.manifest.files.length, failed: data.manifest.failed })} · {t("cert.coverageValue", { lines: data.manifest.coverage.lines, branches: data.manifest.coverage.branches })} · {t("cert.invariantsValue", { total: data.invariants.length, failing: data.invariants.filter((i) => !i.pass).length })}
        </p>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <ul className="m-0 list-disc pl-4">
            {([0, 1, 2, 3] as const).map((i) => (
              <li key={i}>{t(`cert.certifies.items.${i}`, { rows: data.totalRows, tests: data.manifest.totalTests, checks: data.invariants.length })}</li>
            ))}
          </ul>
          <ul className="m-0 list-disc pl-4 text-oh-stone">
            {([0, 1, 2, 3] as const).map((i) => (
              <li key={i}>{t(`cert.excludes.items.${i}`, { open: data.openItems.filter((o) => o.status !== "validated").length })}</li>
            ))}
          </ul>
        </div>
        <p className="m-0 mt-2 text-oh-stone">
          {t("cert.reviewedBy")}: {data.reviews.length === 0 ? t("cert.noReview") : data.reviews.map((r) => `${r.reviewer}, ${r.firm}`).join("; ")}
        </p>
      </div>

      <div>
        <p className="m-0 mb-1 font-display text-[1.05rem]">{t("scorecard.title")}</p>
        <table className="w-full border-collapse">
          <thead><tr className={head}><th className="py-1 font-normal">{t("scorecard.cols.metric")}</th><th className="py-1 text-right font-normal">{t("scorecard.cols.value")}</th><th className="py-1 pl-3 font-normal">{t("scorecard.cols.band")}</th><th className="py-1 pl-3 font-normal">{t("scorecard.cols.status")}</th></tr></thead>
          <tbody>
            {data.scorecard.rows.map((r) => (
              <tr key={r.key}><td className={cell}>{r.label}</td><td className={[cell, "text-right tabular-nums"].join(" ")}>{formatBenchmarkValue(r.value, r.unit, locale)}</td><td className={[cell, "pl-3 tabular-nums text-oh-stone"].join(" ")}>{formatBenchmarkBand(r.pass, r.unit, locale, t("scorecard.to"))}</td><td className={[cell, "pl-3 uppercase tracking-[0.1em]", r.status === "fail" ? "text-oh-ember-deep" : r.status === "watch" ? "text-oh-clay" : "text-oh-olive"].join(" ")}>{t(`scorecard.status.${r.status}`)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 mt-1 text-[0.72rem] text-oh-clay">{t("scorecard.disclaimer")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="m-0 mb-1 font-display text-[1.05rem]">{t("checks.title")}</p>
          <table className="w-full border-collapse">
            <thead><tr className={head}><th className="py-1 font-normal">{t("checks.cols.area")}</th><th className="py-1 text-right font-normal">{t("checks.cols.tests")}</th><th className="py-1 text-right font-normal">{t("checks.cols.passed")}</th></tr></thead>
            <tbody>{CHECK_AREAS.map((a) => (<tr key={a}><td className={cell}>{t(`checks.areas.${a}`)}</td><td className={[cell, "text-right tabular-nums"].join(" ")}>{areas[a].tests}</td><td className={[cell, "text-right tabular-nums"].join(" ")}>{areas[a].passed}</td></tr>))}</tbody>
          </table>
          <ul className="m-0 mt-2 list-disc pl-4 text-oh-stone">{data.invariants.map((i) => (<li key={i.key}>{i.label}: {i.pass ? t("checks.pass") : t("checks.fail")}</li>))}</ul>
        </div>
        <div>
          <p className="m-0 mb-1 font-display text-[1.05rem]">{t("changelog.title")}</p>
          <p className="m-0 mb-1 text-oh-stone">{t("changelog.subtitle", { from: previous.version, to: latest.version })}</p>
          <table className="w-full border-collapse">
            <tbody>
              {data.deltas.filter((d) => ["ebitdaMargin", "paybackFromOpening", "partnerPct", "totalCapital"].includes(d.key)).map((d) => (
                <tr key={d.key}><td className={cell}>{t(`changelog.cards.${d.key}`)}</td><td className={[cell, "text-right tabular-nums text-oh-stone"].join(" ")}>{showDelta(d.key, d.before)}</td><td className={[cell, "text-right tabular-nums font-semibold"].join(" ")}>{showDelta(d.key, d.after)}</td></tr>
              ))}
            </tbody>
          </table>
          <table className="mt-2 w-full border-collapse">
            <thead><tr className={head}><th className="py-1 font-normal">{t("changelog.steps.cols.version")}</th>{STEP_KEYS.map((k) => (<th key={k} className="py-1 text-right font-normal">{t(`changelog.cards.${k}`)}</th>))}</tr></thead>
            <tbody>
              {data.steps.map((s) => (
                <tr key={s.to.version}><td className={cell}>{s.to.version} <span className="text-oh-stone">{versionLabel(s.to)}</span></td>{STEP_KEYS.map((k) => { const d = s.deltas.find((x) => x.key === k); return (<td key={k} className={[cell, "text-right tabular-nums"].join(" ")}>{d ? `${showDelta(k, d.before)} → ${showDelta(k, d.after)}` : "–"}</td>); })}</tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-2 text-oh-stone">{t("print.changes", { n: data.changelog.length })}</p>
        </div>
      </div>

      <div>
        <p className="m-0 mb-1 font-display text-[1.05rem]">{t("openItems.title")}</p>
        <ul className="m-0 list-disc pl-4">{data.openItems.map((o) => (<li key={o.key}><span className="font-semibold">{t(`openItems.items.${o.key}.title`)}</span> <span className="text-oh-stone">({t(`openItems.status.${o.status}`)}, {t(`openItems.owners.${o.owner}`)})</span></li>))}</ul>
      </div>

      <div>
        <p className="m-0 mb-1 font-display text-[1.05rem]">{t("register.title")}</p>
        <p className="m-0 mb-2 text-oh-stone">{t("print.register", { shown: staticRows.length, total: data.rows.length })} {dynamicCounts.join(", ")}.</p>
        <table className="w-full border-collapse text-[0.72rem]">
          <thead><tr className={head}><th className="py-1 font-normal">{tr("cols.assumption")}</th><th className="py-1 text-right font-normal">{tr("cols.value")}</th><th className="py-1 pl-3 font-normal">{tr("cols.source")}</th><th className="py-1 pl-3 font-normal">{tr("cols.asOf")}</th><th className="py-1 pl-3 font-normal">{tr("cols.confidence")}</th></tr></thead>
          <tbody>
            {staticRows.map((r) => (
              <tr key={r.key}><td className={cell}>{r.label} <span className="text-oh-clay">{r.key}</span></td><td className={[cell, "text-right tabular-nums"].join(" ")}>{formatRegistryValue(r.value, r.unit, locale, units)}</td><td className={[cell, "pl-3 text-oh-stone"].join(" ")}>{tr(`sources.${r.source.kind}`)}: {r.source.detail}</td><td className={[cell, "whitespace-nowrap pl-3 tabular-nums text-oh-stone"].join(" ")}>{date(r.source.asOf)}</td><td className={[cell, "pl-3 uppercase tracking-[0.1em] text-oh-stone"].join(" ")}>{tr(`confidence.${r.source.confidence}`)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
