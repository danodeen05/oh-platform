import { getLocale, getTranslations } from "next-intl/server";
import type { BenchmarkStatus, ScorecardRow } from "@oh/plan-model";
import { formatBenchmarkBand, formatBenchmarkValue } from "./format";

export const STATUS_CLASS: Readonly<Record<BenchmarkStatus, string>> = {
  pass: "bg-oh-olive-light/15 text-oh-olive-light ring-oh-olive-light/40",
  watch: "bg-oh-gold/15 text-oh-gold ring-oh-gold/40",
  fail: "bg-oh-ember-light/15 text-oh-ember-light ring-oh-ember-light/40",
  pending: "bg-oh-mute/10 text-oh-mute ring-oh-mute/30",
};

export function StatusChip({ status, label }: { status: BenchmarkStatus; label: string }) {
  return (
    <span data-status={status} className={["inline-block rounded-full px-2 py-0.5 text-[0.66rem] uppercase tracking-[0.12em] ring-1", STATUS_CLASS[status]].join(" ")}>
      {label}
    </span>
  );
}

/**
 * Every headline ratio against the public band the engine scores it with.
 * Watch means explainable, and the explanation is in the row's source text;
 * fail means the number is outside anything a reader would accept, and the
 * page says so instead of hiding it.
 */
export async function BenchmarkScorecard({ rows, counts }: { rows: readonly ScorecardRow[]; counts: { pass: number; watch: number; fail: number; pending: number } }) {
  const t = await getTranslations("plan.integrity.scorecard");
  const locale = await getLocale();
  const band = (r: ScorecardRow): string => {
    const parts = [formatBenchmarkBand(r.pass, r.unit, locale, t("to"))];
    if (r.watchLow) parts.unshift(`${t("watchLow")} ${formatBenchmarkBand(r.watchLow, r.unit, locale, t("to"))}`);
    if (r.watchHigh) parts.push(`${t("watchHigh")} ${formatBenchmarkBand(r.watchHigh, r.unit, locale, t("to"))}`);
    return parts.join(" · ");
  };
  return (
    <section aria-labelledby="integrity-scorecard">
      <h2 id="integrity-scorecard" className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">
        {t("title")}
      </h2>
      <p className="m-0 mb-3 text-[0.85rem] text-oh-mute">{t("subtitle")}</p>
      <p className="m-0 mb-4 flex flex-wrap gap-2 text-[0.8rem]" data-scorecard-summary="">
        <StatusChip status="pass" label={t("count.pass", { n: counts.pass })} />
        <StatusChip status="watch" label={t("count.watch", { n: counts.watch })} />
        <StatusChip status="fail" label={t("count.fail", { n: counts.fail })} />
        {counts.pending > 0 ? <StatusChip status="pending" label={t("count.pending", { n: counts.pending })} /> : null}
      </p>
      <div className="overflow-x-auto rounded-lg border border-oh-stone">
        <table className="w-full min-w-[40rem] border-collapse text-[0.82rem]">
          <thead>
            <tr className="border-b border-oh-stone bg-oh-ink text-left text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.metric")}</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">{t("cols.value")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.band")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.status")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.source")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} id={`bm-${r.key}`} data-benchmark={r.key} className="border-b border-oh-stone/60 align-top last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left font-normal text-oh-cream">{r.label}</th>
                <td className="px-3 py-2 text-right font-display text-[1rem] tabular-nums text-oh-cream">{formatBenchmarkValue(r.value, r.unit, locale)}</td>
                <td className="px-3 py-2 tabular-nums text-oh-mute">{band(r)}</td>
                <td className="px-3 py-2"><StatusChip status={r.status} label={t(`status.${r.status}`)} /></td>
                <td className="px-3 py-2 text-oh-mute">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 mt-3 text-[0.78rem] leading-snug text-oh-mute">{t("disclaimer")}</p>
    </section>
  );
}
