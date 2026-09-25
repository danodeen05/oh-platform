import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GateForm } from "./GateForm";
import { planFontVariables } from "@/lib/plan/fonts";

/**
 * Plan gate. Reachable without a session; everything else under /plan is
 * redirected here by middleware.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; c?: string }>;
};

function safeNext(locale: string, next: string | undefined): string {
  // Only same-origin plan paths; never an absolute URL from the query string.
  if (next && /^\/(en|zh-TW|zh-CN|es)\/plan(\/|$|\?)/.test(next)) return next;
  return `/${locale}/plan`;
}

export default async function PlanGatePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, c } = await searchParams;
  const t = await getTranslations("plan.gate");

  return (
    <main className={`${planFontVariables} ${locale.startsWith("zh") ? "font-cjk" : ""} flex min-h-screen shrink-0 items-center justify-center bg-oh-charcoal px-4 py-6 text-oh-cream`}>
      <div className="w-full max-w-[420px] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/plan/mark-light-176.png" alt="Oh!" width={88} height={88} fetchPriority="high" className="mx-auto mb-8 block h-auto w-[88px]" />
        <h1 className="m-0 mb-3 font-display text-[clamp(1.8rem,5vw,2.4rem)] font-normal leading-[1.15] text-oh-cream">{t("title")}</h1>
        <p className="m-0 mb-8 text-[0.95rem] text-oh-mute">{t("subtitle")}</p>
        <GateForm
          nextPath={safeNext(locale, next)}
          initialCode={c ?? ""}
          labels={{
            codeLabel: t("codeLabel"),
            codePlaceholder: t("codePlaceholder"),
            submit: t("submit"),
            submitting: t("submitting"),
            errorInvalid: t("errorInvalid"),
            errorRateLimited: t("errorRateLimited"),
            errorNetwork: t("errorNetwork"),
          }}
        />
        <p className="m-0 mt-10 text-[0.8rem] text-oh-mute">{t("help")}</p>
      </div>
    </main>
  );
}
