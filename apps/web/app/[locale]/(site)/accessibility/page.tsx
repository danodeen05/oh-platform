/**
 * Task D11: /accessibility, rebuilt on the site shell. The statement's text
 * is the existing `accessibility` namespace; the frame is shared with the
 * other fine-print pages (components/site/legal/LegalPage).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LegalList, LegalPage, LegalParagraph, MailLink, type LegalSection } from "@/components/site/legal/LegalPage";
import { localizedHref } from "@/lib/site/nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.accessibility.meta");
  return { title: t("title"), description: t("description") };
}

const HELLO_EMAIL = "hello@ohbeefnoodlesoup.com";
const ACCESSIBILITY_EMAIL = "accessibility@ohbeefnoodlesoup.com";

export default async function AccessibilityPage() {
  const locale = await getLocale();
  const t = await getTranslations("accessibility");
  const tl = await getTranslations("legal");
  const tc = await getTranslations("common");
  const list = (key: string) => t.raw(key) as string[];

  const sections: LegalSection[] = [
    { id: "commitment", title: t("commitment.title"), children: <LegalParagraph locale={locale}>{t("commitment.content")}</LegalParagraph> },
    {
      id: "website",
      title: t("website.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("website.intro")}</LegalParagraph>
          <LegalList locale={locale} items={list("website.items")} />
        </>
      ),
    },
    {
      id: "restaurant",
      title: t("restaurant.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("restaurant.intro")}</LegalParagraph>
          <LegalList locale={locale} items={list("restaurant.items")} />
        </>
      ),
    },
    {
      id: "ordering",
      title: t("ordering.title"),
      children: (
        <LegalParagraph locale={locale}>
          {t("ordering.content")} <MailLink email={HELLO_EMAIL} />
        </LegalParagraph>
      ),
    },
    { id: "feedback", title: t("feedback.title"), children: <LegalParagraph locale={locale}>{t("feedback.content")}</LegalParagraph> },
    {
      id: "contact",
      title: t("contactUs.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("contactUs.intro")}</LegalParagraph>
          <dl className="m-0 mt-4 grid gap-2 text-base">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-oh-mute">{tl("email")}</dt>
              <dd className="m-0 min-w-0">
                <MailLink email={ACCESSIBILITY_EMAIL} />
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-oh-mute">{tc("or")}</dt>
              <dd className="m-0">
                <Link href={localizedHref(locale, "/contact")} className="font-semibold text-oh-ember-light underline decoration-oh-ember-light/40 underline-offset-4 hover:decoration-oh-ember-light">
                  {tc("contactForm")}
                </Link>
              </dd>
            </div>
          </dl>
        </>
      ),
    },
  ];

  return <LegalPage slug="accessibility" locale={locale} title={t("title")} lede={t("description")} sections={sections} />;
}
