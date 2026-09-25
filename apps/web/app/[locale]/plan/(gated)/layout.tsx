import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getPlanSession } from "@/lib/plan/session.server";
import { sectionHref, visibleSections } from "@/lib/plan/sections";
import { planFontVariables } from "@/lib/plan/fonts";
import { PlanNav, type NavSection } from "@/components/plan/shell/PlanNav";
import { ProgressRail } from "@/components/plan/shell/ProgressRail";
import { AudienceBadge } from "@/components/plan/shell/AudienceBadge";
import { AnalyticsBeacon } from "@/components/plan/shell/AnalyticsBeacon";
import { PlanLocaleSwitcher } from "@/components/plan/shell/PlanLocaleSwitcher";
import { ClosePlanButton } from "./ClosePlanButton";

/**
 * Gated plan shell: top bar, section nav, progress rail, analytics beacon.
 * Middleware already redirects unauthenticated visitors; the session check
 * here is defense in depth and also filters the nav to what this code may
 * see. Full-bleed charcoal with flex-shrink:0 because the site body is a
 * fixed-height flex column (see memory: web-fullpage-dark-bg).
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PlanLayout({ children, params }: Props) {
  const { locale } = await params;
  const claims = await getPlanSession();
  if (!claims) redirect(`/${locale}/plan/gate?next=/${locale}/plan`);
  const t = await getTranslations("plan.shell");
  const ts = await getTranslations("plan.sections");
  const sections: NavSection[] = visibleSections(claims).map((s) => ({ key: s.key, slug: s.slug, icon: s.icon, title: ts(`${s.titleKey}.short`) }));
  const printHref = `/${locale}/plan/print`;

  return (
    <div className={`${planFontVariables} ${locale.startsWith("zh") ? "font-cjk" : ""} plan-root flex min-h-screen shrink-0 flex-col bg-oh-charcoal text-oh-cream`}>
      <a href="#plan-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-oh-ember focus:px-3 focus:py-2 focus:text-oh-cream">
        {t("skipToContent")}
      </a>
      <ProgressRail label={t("progress")} />

      <header className="sticky top-0 z-40 border-b border-oh-stone bg-oh-charcoal/95 backdrop-blur supports-[backdrop-filter]:bg-oh-charcoal/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <a href={sectionHref(locale, { slug: "" })} className="flex items-center gap-3 text-oh-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/plan/mark-light-56.png" alt="" width={28} height={28} className="h-7 w-auto" />
            <span className="hidden font-display text-[1.05rem] tracking-wide sm:inline">{t("planTitle")}</span>
          </a>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="hidden md:inline-flex">
              <AudienceBadge audience={t(`audience.${claims.aud}`)} label={claims.lbl} />
            </span>
            <PlanLocaleSwitcher locale={locale} label={t("language")} />
            <a href={printHref} className="hidden rounded-md border border-oh-stone px-3 py-1 text-[0.75rem] text-oh-mute hover:text-oh-cream md:inline-block">
              {t("print")}
            </a>
            <ClosePlanButton label={t("signOut")} locale={locale} />
          </div>
        </div>
        <div className="mx-auto hidden max-w-7xl px-4 pb-2 md:block md:px-8">
          <PlanNav locale={locale} sections={sections} labels={{ sections: t("sections") }} />
        </div>
      </header>

      <main id="plan-content" className="flex-1">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-oh-stone bg-oh-charcoal/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
        <PlanNav locale={locale} sections={sections} labels={{ sections: t("sections") }} />
      </div>

      <AnalyticsBeacon />
    </div>
  );
}
