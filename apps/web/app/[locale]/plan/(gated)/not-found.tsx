import { getLocale, getTranslations } from "next-intl/server";

/**
 * Rendered inside the gated shell when requireSection() throws notFound():
 * the code is valid but this section is not part of what it may see, or the
 * path does not exist. Deliberately does not say which.
 */
export default async function PlanSectionNotFound() {
  const locale = await getLocale();
  const t = await getTranslations("plan.shell");
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 md:px-8 md:pb-16 md:pt-14">
      <p className="m-0 mb-3 font-display text-[0.95rem] tabular-nums tracking-[0.2em] text-oh-ember-light">404</p>
      <h1 className="m-0 font-display text-[clamp(2rem,5vw,3.2rem)] font-normal leading-[1.05] text-oh-cream">{t("notFoundTitle")}</h1>
      <p className="m-0 mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-oh-mute">{t("notFoundBody")}</p>
      <a href={`/${locale}/plan`} className="mt-8 inline-block rounded-md bg-oh-ember-deep px-4 py-2 text-[0.9rem] font-semibold text-oh-cream hover:bg-oh-ember">
        {t("backToSummary")}
      </a>
    </section>
  );
}
