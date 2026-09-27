import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPlanSession } from "@/lib/plan/session.server";
import { isSectionKey, sectionHref, visibleSections } from "@/lib/plan/sections";
import { PLAN_VERSION_LABEL } from "@/lib/plan/version";
import { PLAN_BUILD } from "@/lib/plan/build";
import { planFontVariables } from "@/lib/plan/fonts";
import { PlanNav, type NavSection } from "@/components/plan/shell/PlanNav";
import { ProgressRail } from "@/components/plan/shell/ProgressRail";
import { AudienceBadge } from "@/components/plan/shell/AudienceBadge";
import { AnalyticsBeacon } from "@/components/plan/shell/AnalyticsBeacon";
import { PlanChappy, type PlanChappyLabels } from "@/components/plan/chappy/PlanChappy";
import { PlanLocaleSwitcher } from "@/components/plan/shell/PlanLocaleSwitcher";
import { PlanPalette, type PaletteSection } from "@/components/plan/shell/PlanPalette";
import { PlanScenarioSwitch } from "@/components/plan/shell/PlanScenarioSwitch";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { homeScenario } from "@/lib/plan/scenario";
import { ClosePlanButton } from "./ClosePlanButton";

/**
 * Gated plan shell: top bar, section nav, progress rail, analytics beacon,
 * and Chappy (bottom right, in the margin).
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
  const tc = await getTranslations("plan.chappy");
  const visible = visibleSections(claims);
  const sections: NavSection[] = visible.map((s) => ({ key: s.key, slug: s.slug, icon: s.icon, order: s.order, title: ts(`${s.titleKey}.short`) }));
  const paletteSections: PaletteSection[] = visible.map((s) => ({ key: s.key, slug: s.slug, icon: s.icon, order: s.order, title: ts(`${s.titleKey}.title`), subtitle: ts(`${s.titleKey}.short`) }));
  const printHref = `/${locale}/plan/print`;
  const builtAt = PLAN_BUILD.builtAt ? new Date(PLAN_BUILD.builtAt) : null;
  const builtLabel = builtAt && !Number.isNaN(builtAt.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Denver" }).format(builtAt) : null;
  const changelogHref = isSectionKey("integrity") ? `/${locale}/plan/integrity#changelog` : null;
  const scenario = await getPlanScenario();
  const scenarioLabels = { group: t("scenario.group"), reset: t("scenario.reset"), conservative: t("scenario.conservative"), base: t("scenario.base"), aggressive: t("scenario.aggressive") };
  const chappyLabels: PlanChappyLabels = {
    launcher: tc("launcher"),
    title: tc("title"),
    subtitle: tc("subtitle"),
    greeting: tc("greeting"),
    suggestionsLabel: tc("suggestionsLabel"),
    placeholder: tc("placeholder"),
    send: tc("send"),
    close: tc("close"),
    thinking: tc("thinking"),
    error: tc("error"),
    busy: tc("busy"),
    tooMany: tc("tooMany"),
    expired: tc("expired"),
    escalated: tc("escalated"),
    limit: tc("limit"),
  };
  const chappySuggestions = tc.raw(`suggestions.${claims.aud}`) as string[];
  const paletteLabels = { open: t("palette.open"), placeholder: t("palette.placeholder"), sections: t("sections"), noResults: t("palette.noResults"), hint: t("palette.hint") };

  return (
    <div className={`${planFontVariables} ${locale.startsWith("zh") ? "font-cjk" : ""} plan-root flex min-h-screen shrink-0 flex-col bg-oh-charcoal text-oh-cream`}>
      <a href="#plan-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-oh-ember focus:px-3 focus:py-2 focus:text-oh-cream">
        {t("skipToContent")}
      </a>
      <ProgressRail label={t("progress")} />

      <header data-plan-shell="" className="relative sticky top-0 z-40 border-b border-oh-stone bg-oh-charcoal/95 backdrop-blur supports-[backdrop-filter]:bg-oh-charcoal/80">
        {/* Desktop (lg and up): the mark sits in the left margin, vertically centered across both header rows,
            so it can be large without making the header taller. It hugs the content column once the
            viewport is wide enough to have a real margin (2xl); below that the rows get left padding. */}
        <a
          href={sectionHref(locale, { slug: "" })}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute top-1/2 hidden -translate-y-1/2 lg:block"
          style={{ left: "max(1.5rem, calc(50% - 40rem - 6rem))" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/plan/mark-light-176.png" alt="" width={72} height={71} className="h-[4.5rem] w-auto" />
        </a>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:pl-28 lg:pr-8 2xl:pl-8">
          <a href={sectionHref(locale, { slug: "" })} aria-label={t("planTitle")} className="flex min-w-0 items-center gap-3 text-oh-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/plan/mark-light-56.png" alt="" width={28} height={28} className="h-7 w-auto lg:hidden" />
            <span className="hidden truncate whitespace-nowrap font-display text-[1.35rem] tracking-wide sm:inline lg:text-[1.6rem]">{t("planTitle")}</span>
          </a>
          <div className="flex shrink-0 items-center gap-2 lg:gap-3">
            <span className="hidden lg:inline-flex">
              <AudienceBadge audience={t(`audience.${claims.aud}`)} label={claims.lbl} />
            </span>
            <span className="hidden md:inline-flex">
              <PlanScenarioSwitch scenario={scenario} home={homeScenario(claims)} labels={scenarioLabels} />
            </span>
            <PlanPalette locale={locale} sections={paletteSections} labels={paletteLabels} />
            <Suspense fallback={null}>
              <PlanLocaleSwitcher locale={locale} label={t("language")} />
            </Suspense>
            <a href={printHref} className="hidden whitespace-nowrap rounded-md border border-oh-stone px-3 py-1 text-[0.75rem] text-oh-mute hover:text-oh-cream lg:inline-block">
              {t("print")}
            </a>
            <ClosePlanButton label={t("signOut")} locale={locale} />
          </div>
        </div>
        <div className="mx-auto hidden max-w-7xl px-4 pb-2 md:block md:px-6 lg:pl-28 lg:pr-8 2xl:pl-8">
          <PlanNav locale={locale} sections={sections} labels={{ sections: t("sections") }} />
        </div>
      </header>

      <main id="plan-content" className="flex-1">
        {children}
      </main>

      <footer data-plan-shell="" className="mx-auto w-full max-w-5xl px-4 pb-28 pt-2 text-[0.72rem] text-oh-mute md:px-8 md:pb-10">
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-oh-stone pt-4">
          <span className="font-mono text-oh-cream/80">{PLAN_VERSION_LABEL}</span>
          {builtLabel ? <span>{t("version.built", { date: builtLabel })}</span> : null}
          {PLAN_BUILD.commit ? <span className="font-mono">{PLAN_BUILD.commit.slice(0, 7)}</span> : null}
          {changelogHref ? (
            <a href={changelogHref} className="underline decoration-oh-stone underline-offset-4 hover:text-oh-cream">
              {t("version.whatChanged")}
            </a>
          ) : null}
          <span className="basis-full sm:basis-auto sm:ml-auto">{t("version.confidential")}</span>
        </p>
      </footer>

      <div data-plan-shell="" className="fixed inset-x-0 bottom-0 z-40 border-t border-oh-stone bg-oh-charcoal/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
        <PlanNav locale={locale} sections={sections} labels={{ sections: t("sections") }} paletteLabel={t("palette.open")} />
      </div>

      <AnalyticsBeacon />
      <PlanChappy locale={locale} suggestions={chappySuggestions} labels={chappyLabels} />
    </div>
  );
}
