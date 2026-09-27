import { getFormatter, getTranslations } from "next-intl/server";
import { MODEL_VERSION, MODEL_VERSION_LABEL } from "@oh/plan-model";
import { PLAN_BUILD } from "@/lib/plan/build";
import type { IntegrityData } from "./data";

/**
 * The certificate: what the model can vouch for by itself (consistency,
 * provenance, tests) and what only an outside party can (audit, quotes,
 * forecasts). Version, build date, test totals and the reviewed-by slot.
 */
export async function CertificationHeader({ data }: { data: IntegrityData }) {
  const t = await getTranslations("plan.integrity.cert");
  const fmt = await getFormatter();
  const builtAt = PLAN_BUILD.builtAt ? new Date(PLAN_BUILD.builtAt) : null;
  const built = builtAt && !Number.isNaN(builtAt.getTime()) ? fmt.dateTime(builtAt, { year: "numeric", month: "long", day: "numeric", timeZone: "America/Denver" }) : null;
  const generated = fmt.dateTime(new Date(data.manifest.generatedAt), { year: "numeric", month: "long", day: "numeric", timeZone: "America/Denver" });
  const failing = data.invariants.filter((i) => !i.pass).length;
  const signed = data.reviews.filter((r) => r.status === "signed");

  return (
    <section aria-labelledby="integrity-cert" className="rounded-lg border border-oh-stone bg-oh-ink">
      <div className="grid gap-6 border-b border-oh-stone px-5 py-5 md:grid-cols-[1fr_auto] md:px-6">
        <div>
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.16em] text-oh-ember-light">{t("eyebrow")}</p>
          <h2 id="integrity-cert" className="m-0 mt-1 font-display text-[1.6rem] leading-tight text-oh-cream">
            {t("title", { version: MODEL_VERSION })}
          </h2>
          <p className="m-0 mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-oh-mute">{MODEL_VERSION_LABEL}</p>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.8rem] md:min-w-[18rem]">
          <div>
            <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t("built")}</dt>
            <dd className="m-0 mt-0.5 text-oh-cream">{built ?? t("builtDev")}</dd>
          </div>
          <div>
            <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t("testsRun")}</dt>
            <dd className="m-0 mt-0.5 text-oh-cream">{generated}</dd>
          </div>
          <div>
            <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t("tests")}</dt>
            <dd className="m-0 mt-0.5 tabular-nums text-oh-cream">{t("testsValue", { tests: data.manifest.totalTests, files: data.manifest.files.length, failed: data.manifest.failed })}</dd>
          </div>
          <div>
            <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t("coverage")}</dt>
            <dd className="m-0 mt-0.5 tabular-nums text-oh-cream">{t("coverageValue", { lines: data.manifest.coverage.lines, branches: data.manifest.coverage.branches })}</dd>
          </div>
          <div>
            <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t("invariants")}</dt>
            <dd className={["m-0 mt-0.5 tabular-nums", failing === 0 ? "text-oh-olive-light" : "text-oh-ember-light"].join(" ")}>{t("invariantsValue", { total: data.invariants.length, failing })}</dd>
          </div>
          <div>
            <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t("reviewedBy")}</dt>
            <dd className="m-0 mt-0.5 text-oh-cream">{signed.length > 0 ? signed.map((r) => `${r.reviewer}, ${r.firm}`).join("; ") : <span className="text-oh-mute">{t("noReview")}</span>}</dd>
          </div>
        </dl>
      </div>
      <div className="grid gap-6 px-5 py-5 md:grid-cols-2 md:px-6">
        <div>
          <p className="m-0 mb-2 text-[0.68rem] uppercase tracking-[0.14em] text-oh-olive-light">{t("certifies.title")}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.9rem] leading-snug text-oh-cream">
            {([0, 1, 2, 3] as const).map((i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-oh-olive-light" />
                <span>{t(`certifies.items.${i}`, { rows: data.totalRows, tests: data.manifest.totalTests, checks: data.invariants.length })}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="m-0 mb-2 text-[0.68rem] uppercase tracking-[0.14em] text-oh-gold">{t("excludes.title")}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.9rem] leading-snug text-oh-cream">
            {([0, 1, 2, 3] as const).map((i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-oh-gold" />
                <span>{t(`excludes.items.${i}`, { open: data.openItems.filter((o) => o.status !== "validated").length })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
