import { getLocale, getTranslations } from "next-intl/server";
import type { PlanAudience } from "@/lib/plan/session";
import { getSection, sectionHref } from "@/lib/plan/sections";
import { AssumptionsRegister } from "./AssumptionsRegister";
import { AutomatedChecks } from "./AutomatedChecks";
import { BenchmarkScorecard } from "./BenchmarkScorecard";
import { CertificationHeader } from "./CertificationHeader";
import { ChangeLog } from "./ChangeLog";
import { OpenItems } from "./OpenItems";
import { ReviewerSignoff } from "./ReviewerSignoff";
import { integrityData } from "./data";

/**
 * Model integrity (section 14). The certificate, the assumptions register,
 * the benchmark scorecard, the automated checks, the change log, the open
 * items and the reviewer sign-off, in that order: what we can prove, then
 * what we cannot yet.
 */
export async function IntegrityModule({ audience }: { audience: PlanAudience }) {
  const [t, locale] = await Promise.all([getTranslations("plan.integrity"), getLocale()]);
  const data = integrityData(audience);
  const registryKeys = new Set(data.rows.map((r) => r.key));
  return (
    <div data-plan-module="integrity" className="flex flex-col gap-12">
      <CertificationHeader data={data} />
      <section aria-labelledby="integrity-register">
        <h2 id="integrity-register" className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">
          {t("register.title")}
        </h2>
        <p className="m-0 mb-4 max-w-2xl text-[0.85rem] leading-relaxed text-oh-mute">{t("register.subtitle", { rows: data.rows.length })}</p>
        <AssumptionsRegister rows={data.rows} groups={data.groups} changeDates={data.changeDates} total={data.totalRows} locale={locale} modelHref={sectionHref(locale, getSection("model"))} />
      </section>
      <BenchmarkScorecard rows={data.scorecard.rows} counts={{ pass: data.scorecard.pass, watch: data.scorecard.watch, fail: data.scorecard.fail, pending: data.scorecard.pending }} />
      <AutomatedChecks data={data} />
      <ChangeLog data={data} registryKeys={registryKeys} />
      <OpenItems items={data.openItems} registryKeys={registryKeys} />
      <ReviewerSignoff reviews={data.reviews} />
    </div>
  );
}
