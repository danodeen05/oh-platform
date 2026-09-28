/**
 * Task D11: /sms-consent, the SMS opt-in documentation the carrier review
 * reads, rebuilt on the site shell and translated (it was English only).
 * The facts are unchanged: the exact consent sentence, the two opt-in
 * flows with their screenshots, the opt-out keywords and the business
 * contact block. Keywords, addresses and the phone number read the same in
 * every language, so they are <Literal>s.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { LegalList, LegalPage, LegalParagraph, Literal, MailLink, type LegalSection } from "@/components/site/legal/LegalPage";
import { localizedHref } from "@/lib/site/nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("smsConsent.meta");
  return { title: t("title"), description: t("description") };
}

const BUSINESS = {
  name: "Oh Beef Noodle Soup LLC",
  website: "https://ohbeef.com",
  email: "hello@ohbeef.com",
  phone: "+1 (866) 359-4863",
  // The same address as the privacy policy's SMS section (controller ruling, D11 fix round 1).
  optOutEmail: "orders@ohbeefnoodlesoup.com",
};

function Term({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-oh-stone/70 bg-oh-ink p-4 md:p-5">
      <dt className="text-base font-semibold text-oh-cream">{label}</dt>
      <dd className="m-0 mt-1 text-base leading-relaxed text-oh-cream/80">{children}</dd>
    </div>
  );
}

function Shot({ src, width, height, alt, caption }: { src: string; width: number; height: number; alt: string; caption: string }) {
  return (
    <figure className="m-0 mt-6 overflow-hidden rounded-[1.5rem] border border-oh-stone/70 bg-oh-linen p-3 md:p-4">
      <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 768px) 420px, 90vw" className="mx-auto block h-auto max-h-[70svh] w-auto max-w-full rounded-xl" />
      <figcaption className="m-0 mt-3 text-sm leading-relaxed text-oh-stone">{caption}</figcaption>
    </figure>
  );
}

export default async function SmsConsentPage() {
  const locale = await getLocale();
  const t = await getTranslations("smsConsent");
  const kw = (k: string) => <Literal key={k} as="strong" className="font-semibold text-oh-cream">{k}</Literal>;

  const sections: LegalSection[] = [
    { id: "overview", title: t("overview.title"), children: <LegalParagraph locale={locale}>{t("overview.body")}</LegalParagraph> },
    { id: "points", title: t("points.title"), children: <LegalList locale={locale} items={t.raw("points.items") as string[]} /> },
    {
      id: "language",
      title: t("language.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("language.intro")}</LegalParagraph>
          <blockquote className="m-0 mt-4 rounded-2xl border-l-4 border-oh-gold bg-oh-ink px-5 py-4 text-lg font-medium leading-relaxed text-oh-cream">
            {t("language.quote")}
          </blockquote>
        </>
      ),
    },
    {
      id: "types",
      title: t("types.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("types.intro")}</LegalParagraph>
          <dl className="m-0 mt-5 grid gap-3">
            <Term label={t("types.confirmation.label")}>{t("types.confirmation.body")}</Term>
            <Term label={t("types.ready.label")}>{t("types.ready.body")}</Term>
            <Term label={t("types.frequency.label")}>{t("types.frequency.body")}</Term>
          </dl>
        </>
      ),
    },
    {
      id: "guest-checkout",
      title: t("flow1.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("flow1.body")}</LegalParagraph>
          <Shot src="/sms-consent/Opt-In1.png" width={936} height={1080} alt={t("flow1.alt")} caption={t("flow1.caption")} />
        </>
      ),
    },
    {
      id: "phone-collection",
      title: t("flow2.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("flow2.body")}</LegalParagraph>
          <Shot src="/sms-consent/Opt-In2.png" width={874} height={1334} alt={t("flow2.alt")} caption={t("flow2.caption")} />
        </>
      ),
    },
    {
      id: "opt-out",
      title: t("optOut.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("optOut.intro")}</LegalParagraph>
          <dl className="m-0 mt-5 grid gap-3">
            <Term label={t.rich("optOut.stop.label", { kw: () => kw("STOP") })}>{t.rich("optOut.stop.body", { kw: () => kw("STOP") })}</Term>
            <Term label={t.rich("optOut.help.label", { kw: () => kw("HELP") })}>{t.rich("optOut.help.body", { kw: () => kw("HELP") })}</Term>
            <Term label={t("optOut.email.label")}>{t.rich("optOut.email.body", { email: () => <MailLink key="email" email={BUSINESS.optOutEmail} /> })}</Term>
          </dl>
        </>
      ),
    },
    {
      id: "privacy",
      title: t("privacy.title"),
      children: (
        <LegalParagraph locale={locale}>
          {t("privacy.body")}{" "}
          <Link href={localizedHref(locale, "/privacy")} className="break-all font-semibold text-oh-ember-light underline decoration-oh-ember-light/40 underline-offset-4 hover:decoration-oh-ember-light">
            <Literal>{`${BUSINESS.website}/privacy`}</Literal>
          </Link>
        </LegalParagraph>
      ),
    },
    {
      id: "business",
      title: t("business.title"),
      children: (
        <dl className="m-0 grid gap-3 sm:grid-cols-2">
          <Term label={t("business.name")}>
            <Literal>{BUSINESS.name}</Literal>
          </Term>
          <Term label={t("business.website")}>
            <Literal>{BUSINESS.website}</Literal>
          </Term>
          <Term label={t("business.email")}>
            <MailLink email={BUSINESS.email} />
          </Term>
          <Term label={t("business.phone")}>
            <a href="tel:+18663594863" className="font-semibold text-oh-ember-light no-underline hover:underline">
              <Literal>{BUSINESS.phone}</Literal>
            </a>
          </Term>
        </dl>
      ),
    },
  ];

  return <LegalPage slug="sms-consent" locale={locale} title={t("hero.title")} lede={t("hero.lede")} sections={sections} />;
}
