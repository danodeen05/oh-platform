import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { registryAnchor, type HeadlineDelta, type ModelSnapshot } from "@oh/plan-model";
import { formatChangeValue } from "./format";
import type { IntegrityData } from "./data";

const CARD_KEYS: readonly HeadlineDelta["key"][] = ["ebitdaMargin", "paybackFromOpening", "partnerPct", "totalCapital"];

/**
 * What moved between model versions and why. Headline cards first (margin,
 * payback, partner stake, capital), then every preset and formula change
 * with the finding it answered, who decided it, and where that is written.
 */
export async function ChangeLog({ data, registryKeys }: { data: IntegrityData; registryKeys: ReadonlySet<string> }) {
  const t = await getTranslations("plan.integrity.changelog");
  const locale = await getLocale();
  const fmt = await getFormatter();
  const latest = data.snapshots[data.snapshots.length - 1] as ModelSnapshot;
  const previous = (data.snapshots[0] as ModelSnapshot | undefined) ?? latest;
  const versionLabel = (s: ModelSnapshot): string => {
    const key = `versions.v${s.version.replace(/\./g, "_")}`;
    return t.has(key) ? t(key) : s.label;
  };
  const pick = (deltas: readonly HeadlineDelta[], key: HeadlineDelta["key"]) => deltas.find((d) => d.key === key);
  const show = (key: HeadlineDelta["key"], v: number | null): string => {
    if (v === null) return "–";
    if (key === "ebitdaMargin" || key === "partnerPct") return fmt.number(v, { style: "percent", maximumFractionDigits: 1 });
    if (key === "paybackFromOpening") return t("years", { n: fmt.number(v, { maximumFractionDigits: 1 }) });
    if (key === "partnerMultiple") return `${fmt.number(v, { maximumFractionDigits: 2 })}x`;
    if (key === "franchiseUnitsY5") return fmt.number(v);
    return fmt.number(v, { style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  const date = (iso: string) => fmt.dateTime(new Date(`${iso}T12:00:00Z`), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section aria-labelledby="integrity-changelog">
      <h2 id="integrity-changelog" className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">
        {t("title")}
      </h2>
      <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("subtitle", { from: previous.version, to: latest.version })}</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.deltas
          .filter((d) => CARD_KEYS.includes(d.key))
          .map((d) => (
            <div key={d.key} className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-4" data-delta={d.key}>
              <p className="m-0 text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t(`cards.${d.key}`)}</p>
              <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[0.85rem] tabular-nums text-oh-mute line-through decoration-oh-mute/60">{show(d.key, d.before)}</span>
                <span className="font-display text-[1.6rem] leading-none tabular-nums text-oh-cream">{show(d.key, d.after)}</span>
              </p>
              <p className="m-0 mt-1 text-[0.72rem] text-oh-mute">{t("beforeAfter", { before: previous.version, after: latest.version })}</p>
            </div>
          ))}
      </div>
      {data.steps.length > 0 ? (
        <div className="mb-6">
          <h3 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("steps.title")}</h3>
          {/* relative: the sr-only "to" labels are absolutely positioned and must stay inside the scroller */}
          <div className="relative overflow-x-auto rounded-lg border border-oh-stone">
            <table className="w-full min-w-[40rem] border-collapse text-[0.78rem]" data-version-steps="">
              <thead>
                <tr className="border-b border-oh-stone bg-oh-ink text-left text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">
                  <th scope="col" className="px-3 py-2 font-normal">{t("steps.cols.version")}</th>
                  {CARD_KEYS.map((k) => (
                    <th key={k} scope="col" className="px-3 py-2 text-right font-normal">{t(`cards.${k}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.steps.map((s) => (
                  <tr key={s.to.version} className="border-b border-oh-stone/60 align-top last:border-b-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <span className="block font-mono text-[0.72rem] text-oh-cream">{s.to.version}</span>
                      <span className="block text-oh-mute">{versionLabel(s.to)}</span>
                    </th>
                    {CARD_KEYS.map((k) => {
                      const d = pick(s.deltas, k);
                      return (
                        <td key={k} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-oh-mute">
                          {d ? (
                            <>
                              {show(k, d.before)} <span aria-hidden="true">→</span>
                              <span className="sr-only">{t("steps.to")}</span> <span className="text-oh-cream">{show(k, d.after)}</span>
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-oh-stone">
        <table className="w-full min-w-[52rem] border-collapse text-[0.78rem]">
          <thead>
            <tr className="border-b border-oh-stone bg-oh-ink text-left text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.date")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.finding")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.key")}</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">{t("cols.before")}</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">{t("cols.after")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.reason")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.decidedBy")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.ref")}</th>
            </tr>
          </thead>
          <tbody>
            {data.changelog.map((c, i) => {
              const anchor = registryAnchor(c.key);
              const linked = registryKeys.has(c.key);
              return (
                <tr key={`${c.key}-${i}`} className="border-b border-oh-stone/60 align-top last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-oh-mute">{date(c.date)}</td>
                  <td className="px-3 py-2 text-oh-mute">{c.finding}</td>
                  <td className="px-3 py-2 font-mono text-[0.72rem] text-oh-cream">{linked ? <a href={`#${anchor}`} className="text-oh-cream underline decoration-oh-stone underline-offset-2 hover:decoration-oh-ember">{c.key}</a> : c.key}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-oh-mute">{formatChangeValue(c.before, c.unit, locale)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-oh-cream">{formatChangeValue(c.after, c.unit, locale)}</td>
                  <td className="px-3 py-2 text-oh-mute">{c.reason}</td>
                  <td className="px-3 py-2 text-oh-mute">{t(`decidedBy.${c.decidedBy}`)}</td>
                  <td className="px-3 py-2 text-oh-mute">{c.ref}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
