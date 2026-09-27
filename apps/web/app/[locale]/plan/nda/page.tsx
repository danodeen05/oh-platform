import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { planApi } from "@/lib/plan/api";
import { planFontVariables } from "@/lib/plan/fonts";
import { getPlanAccess } from "@/lib/plan/session.server";
import { signatureFont } from "@/lib/plan/nda/signatureFont";
import type { NdaState } from "@/lib/plan/nda/types";
import { NdaFlow } from "@/components/plan/nda/NdaFlow";
import { ClosePlanButton } from "../(gated)/ClosePlanButton";

/**
 * The NDA a code's recipient signs before any plan content (codes with
 * ndaRequired). Signed-in viewers who no longer need it go straight to the
 * Summary; everyone else goes to the gate. English only by design: one
 * controlling language for a legal agreement.
 */

export const metadata: Metadata = {
  title: "Confidential Disclosure Agreement · Oh! Beef Noodle Soup",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

export default async function PlanNdaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const access = await getPlanAccess();
  if (!access.claims || access.state === "none") redirect(`/${locale}/plan/gate?next=/${locale}/plan`);
  if (access.state === "ok") redirect(`/${locale}/plan`);

  const res = await planApi<NdaState>(`/plan/sessions/${encodeURIComponent(access.claims.sid)}/nda`, {});
  const state = res.ok ? res.data : null;

  return (
    <main lang="en" className={`${planFontVariables} flex min-h-screen shrink-0 flex-col bg-oh-charcoal text-oh-cream print:bg-white`}>
      <header className="border-b border-oh-stone/70 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/plan/mark-light-56.png" alt="Oh!" width={32} height={32} className="h-8 w-auto" />
            <span className="font-display text-[1.25rem] tracking-wide text-oh-cream">Oh! Business Plan</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[0.7rem] uppercase tracking-[0.2em] text-oh-ash sm:inline">Confidential</span>
            <ClosePlanButton label="Not you? Sign out" locale={locale} />
          </div>
        </div>
      </header>


      {state ? (
        <NdaFlow locale={locale} initial={state} signatureFontFamily={signatureFont.style.fontFamily} />
      ) : (
        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <h2 className="m-0 font-display text-[2rem] font-normal text-oh-cream">The agreement is taking a short break.</h2>
          <p className="m-0 mt-3 text-oh-mute">We couldn't load it just now. Please refresh in a minute, or reply to your invitation and we will sort it out.</p>
        </section>
      )}
    </main>
  );
}
