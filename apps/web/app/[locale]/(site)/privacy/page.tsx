/**
 * Task D11: /privacy, rebuilt on the site shell. The policy text itself is
 * unchanged (the `privacy` namespace, including the SMS notifications
 * section from prod hotfix 649ab65); only its frame and the three sharing
 * labels (now translated) are new.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LegalList, LegalPage, LegalParagraph, MailLink, type LegalSection } from "@/components/site/legal/LegalPage";
import { localizedHref } from "@/lib/site/nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy.meta");
  return { title: t("title"), description: t("description") };
}

const PRIVACY_EMAIL = "privacy@ohbeefnoodlesoup.com";

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getTranslations("privacy");
  const tl = await getTranslations("legal");
  const tc = await getTranslations("common");
  const list = (key: string) => t.raw(key) as string[];
  const h3 = "m-0 mt-6 text-lg font-semibold text-oh-cream";

  const sections: LegalSection[] = [
    { id: "introduction", title: t("sections.introduction.title"), children: <LegalParagraph locale={locale}>{t("sections.introduction.content")}</LegalParagraph> },
    {
      id: "collect",
      title: t("sections.infoCollect.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("sections.infoCollect.intro")}</LegalParagraph>
          <h3 className={h3}>{t("sections.infoCollect.personalData.title")}</h3>
          <LegalList locale={locale} items={list("sections.infoCollect.personalData.items")} />
          <h3 className={h3}>{t("sections.infoCollect.autoData.title")}</h3>
          <LegalList locale={locale} items={list("sections.infoCollect.autoData.items")} />
        </>
      ),
    },
    { id: "use", title: t("sections.howWeUse.title"), children: <LegalList locale={locale} items={list("sections.howWeUse.items")} /> },
    {
      id: "sharing",
      title: t("sections.sharing.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("sections.sharing.intro")}</LegalParagraph>
          <LegalList
            locale={locale}
            items={(["serviceProviders", "businessPartners", "legalRequirements"] as const).map((k) => (
              <>
                <strong className="font-semibold text-oh-cream">{tl(`privacy.sharing.${k}`)}</strong>
                <span aria-hidden="true">{" · "}</span>
                {t(`sections.sharing.${k}`)}
              </>
            ))}
          />
          <LegalParagraph locale={locale} className="mt-5">
            {t("sections.sharing.noSell")}
          </LegalParagraph>
        </>
      ),
    },
    { id: "security", title: t("sections.security.title"), children: <LegalParagraph locale={locale}>{t("sections.security.content")}</LegalParagraph> },
    {
      id: "rights",
      title: t("sections.rights.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("sections.rights.intro")}</LegalParagraph>
          <LegalList locale={locale} items={list("sections.rights.items")} />
        </>
      ),
    },
    { id: "cookies", title: t("sections.cookies.title"), children: <LegalParagraph locale={locale}>{t("sections.cookies.content")}</LegalParagraph> },
    { id: "children", title: t("sections.children.title"), children: <LegalParagraph locale={locale}>{t("sections.children.content")}</LegalParagraph> },
    {
      id: "sms",
      title: t("sections.smsNotifications.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("sections.smsNotifications.intro")}</LegalParagraph>
          <LegalList locale={locale} items={list("sections.smsNotifications.messageTypes")} />
          <LegalParagraph locale={locale} className="mt-5">
            {t("sections.smsNotifications.frequency")}
          </LegalParagraph>
          <LegalParagraph locale={locale}>{t("sections.smsNotifications.consent")}</LegalParagraph>
          <LegalParagraph locale={locale} className="text-oh-cream/70">
            {t("sections.smsNotifications.carriers")} {t("sections.smsNotifications.help")}
          </LegalParagraph>
          <LegalParagraph locale={locale}>
            <Link href={localizedHref(locale, "/sms-consent")} className="font-semibold text-oh-ember-light underline decoration-oh-ember-light/40 underline-offset-4 hover:decoration-oh-ember-light">
              {tl("nav.smsConsent")}
            </Link>
          </LegalParagraph>
        </>
      ),
    },
    { id: "changes", title: t("sections.changes.title"), children: <LegalParagraph locale={locale}>{t("sections.changes.content")}</LegalParagraph> },
    {
      id: "contact",
      title: t("sections.contactUs.title"),
      children: (
        <>
          <LegalParagraph locale={locale}>{t("sections.contactUs.intro")}</LegalParagraph>
          <dl className="m-0 mt-4 grid gap-2 text-base">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-oh-mute">{tl("email")}</dt>
              <dd className="m-0 min-w-0">
                <MailLink email={PRIVACY_EMAIL} />
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

  return <LegalPage slug="privacy" locale={locale} title={t("title")} lede={t("description")} updated={t("lastUpdated")} sections={sections} />;
}
