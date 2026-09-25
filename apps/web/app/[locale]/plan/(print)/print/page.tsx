import { getFormatter, getTranslations } from "next-intl/server";
import { BASE, BASE_ASSUMPTIONS, NO_DEBT, computeUnit } from "@oh/plan-model";
import { getPlanSession } from "@/lib/plan/session.server";
import { visibleSections } from "@/lib/plan/sections";
import { redirect } from "next/navigation";
import { PrintButton } from "./PrintButton";
import { PRINT_MODULES } from "@/components/plan/modules/print-registry";
import "../../print.css";

/**
 * Flat, paginated version of every section this code may see (spec 7.5).
 * Cover, contents, one section per page, running footer with the code label
 * and generation date so a photocopy stays traceable. Phase 3 ships the
 * skeleton; modules render their print variants here in Phase 4.
 */
export default async function PlanPrintPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const claims = await getPlanSession();
  if (!claims) redirect(`/${locale}/plan/gate?next=/${locale}/plan/print`);
  const t = await getTranslations("plan.print");
  const ts = await getTranslations("plan.sections");
  const tShell = await getTranslations("plan.shell");
  const fmt = await getFormatter();
  const sections = visibleSections(claims);
  const generated = fmt.dateTime(new Date(), { year: "numeric", month: "long", day: "numeric" });
  const unit = computeUnit(BASE, { loan: NO_DEBT });
  const values = { pods: BASE_ASSUMPTIONS.pods, sqft: BASE_ASSUMPTIONS.squareFeet.toLocaleString(locale) };
  const footer = t("footer", { label: claims.lbl, date: generated });

  return (
    <article className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      <div className="plan-print-noprint mb-8 flex items-center justify-between gap-4 text-[0.8rem] text-oh-clay">
        <a href={`/${locale}/plan`} className="text-oh-clay underline-offset-2 hover:underline">
          {t("backToPlan")}
        </a>
        <PrintButton label={t("printButton")} />
      </div>

      <section className="plan-print-cover flex min-h-[80vh] flex-col justify-between">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/plan/mark-web-128.png" alt="Oh!" width={64} height={64} className="mb-10 h-16 w-auto" />
          <p className="m-0 mb-4 text-[0.75rem] uppercase tracking-[0.2em] text-oh-clay">{tShell("brand")}</p>
          <h1 className="m-0 font-display text-[3.4rem] font-normal leading-[1.02] text-oh-charcoal">{t("cover.title")}</h1>
          <p className="m-0 mt-5 max-w-xl text-[1.15rem] leading-relaxed text-oh-stone">{t("cover.subtitle")}</p>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-6 border-t border-oh-charcoal/15 pt-6 text-[0.9rem]">
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-oh-clay">{t("cover.preparedFor")}</dt>
            <dd className="m-0 mt-1 text-oh-charcoal">{claims.lbl}</dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-oh-clay">{t("cover.generated")}</dt>
            <dd className="m-0 mt-1 text-oh-charcoal">{generated}</dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-oh-clay">{t("cover.baseRevenue")}</dt>
            <dd className="m-0 mt-1 tabular-nums text-oh-charcoal">{fmt.number(unit.location.annualRevenue, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-oh-clay">{t("cover.confidential")}</dt>
            <dd className="m-0 mt-1 text-oh-charcoal">{t("cover.confidentialText")}</dd>
          </div>
        </dl>
      </section>

      <section className="plan-print-section">
        <h2 className="m-0 mb-6 font-display text-[2rem] font-normal text-oh-charcoal">{t("toc")}</h2>
        <ol className="m-0 list-none p-0">
          {sections.map((s) => (
            <li key={s.key} className="flex items-baseline gap-4 border-b border-oh-charcoal/10 py-2 text-[1rem]">
              <span className="w-8 shrink-0 font-display tabular-nums text-oh-clay">{String(s.order).padStart(2, "0")}</span>
              <span className="text-oh-charcoal">{ts(`${s.titleKey}.title`)}</span>
            </li>
          ))}
        </ol>
      </section>

      {sections.map((s) => (
        <section key={s.key} className="plan-print-section" data-section={s.key}>
          <p className="m-0 mb-2 font-display text-[0.9rem] tabular-nums tracking-[0.2em] text-oh-clay">{String(s.order).padStart(2, "0")}</p>
          <h2 className="m-0 font-display text-[2.4rem] font-normal leading-[1.05] text-oh-charcoal">{ts(`${s.titleKey}.title`)}</h2>
          <p className="m-0 mt-3 text-[1.05rem] leading-relaxed text-oh-stone">{ts(`${s.titleKey}.subtitle`, values)}</p>
          {PRINT_MODULES[s.key] ? (
            (() => {
              const Module = PRINT_MODULES[s.key] as NonNullable<(typeof PRINT_MODULES)[typeof s.key]>;
              return <Module locale={locale} />;
            })()
          ) : (
            <p className="mt-8 rounded border border-dashed border-oh-ash/50 px-4 py-6 text-center text-[0.85rem] text-oh-clay">{t("placeholder")}</p>
          )}
        </section>
      ))}

      <footer className="plan-print-footer text-[0.7rem] text-oh-clay" aria-hidden="true">
        {footer}
      </footer>
    </article>
  );
}
