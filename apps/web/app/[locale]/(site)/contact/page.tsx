/**
 * Task D11: /contact. The form (components/site/contact/ContactForm) posts
 * to the support queue (POST /support/cases, type CONTACT); staff answer it
 * from the admin console's Support page. Beside it: email, Chappy for the
 * quick questions, and the locations.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/site/contact/ContactForm";
import { ContactChappy } from "@/components/site/contact/ContactChappy";
import { Icon } from "@/components/site/icons/Icon";
import { Literal } from "@/components/site/legal/LegalPage";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { CHAPPY_AVATAR, localizedHref } from "@/lib/site/nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contactPage.meta");
  return { title: t("title"), description: t("description") };
}

const HELLO_EMAIL = "hello@ohbeefnoodlesoup.com";

export default async function ContactPage() {
  const locale = await getLocale();
  const t = await getTranslations("contactPage");
  const card = "flex min-w-0 gap-4 rounded-2xl border border-oh-stone/70 bg-oh-ink p-5";
  const iconWrap = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep/25 text-oh-ember-light";

  return (
    <div data-contact-page className="overflow-x-clip">
      <section aria-labelledby="contact-title" className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <SitePicture image="storefront-dusk" sizes="100vw" priority alt="" className="absolute inset-0 block opacity-40 [&>img]:h-full [&>img]:w-full [&>img]:object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-oh-charcoal)_40%,transparent)_0%,color-mix(in_oklab,var(--color-oh-charcoal)_75%,transparent)_55%,var(--color-oh-charcoal)_100%)]" />
        </div>
        <div className="mx-auto flex min-h-[46svh] max-w-6xl flex-col justify-end px-5 pb-10 pt-20 md:min-h-[52svh] md:px-8 md:pb-16">
          <Reveal from="fade">
            <Eyebrow locale={locale} className="text-oh-ember-light">
              {t("hero.eyebrow")}
            </Eyebrow>
            <Display id="contact-title" locale={locale} className="m-0 mt-3 max-w-3xl text-[clamp(2.5rem,8vw,4.75rem)] text-oh-cream">
              {t("hero.title")}
            </Display>
            <Body locale={locale} className="m-0 mt-5 max-w-xl text-lg text-oh-cream/85">
              {t("hero.lede")}
            </Body>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:gap-12 md:px-8 md:pb-28">
        <Reveal className="min-w-0">
          <ContactForm />
        </Reveal>

        <aside aria-labelledby="contact-other" className="min-w-0">
          <Reveal>
            <Eyebrow locale={locale} className="text-oh-ember-light">
              {t("other.eyebrow")}
            </Eyebrow>
            <h2 id="contact-other" className={`m-0 mt-2 text-[1.75rem] font-normal leading-tight text-oh-cream ${locale.startsWith("zh") ? "font-display-cjk" : "font-display"}`}>
              {t("other.title")}
            </h2>
          </Reveal>
          <ul className="m-0 mt-6 grid list-none gap-3 p-0">
            <Reveal as="li" className={card}>
              <Image src={CHAPPY_AVATAR} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-lg font-semibold text-oh-cream">{t("other.chappy.title")}</p>
                <p className="m-0 mt-1 text-base text-oh-cream/75">{t("other.chappy.body")}</p>
                <ContactChappy />
              </div>
            </Reveal>
            <Reveal as="li" delay={80} className={card}>
              <span aria-hidden="true" className={iconWrap}>
                <Icon name="mail" size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-lg font-semibold text-oh-cream">{t("other.email.title")}</p>
                <p className="m-0 mt-1 text-base text-oh-cream/75">{t("other.email.body")}</p>
                <a href={`mailto:${HELLO_EMAIL}`} className="mt-2 inline-flex min-h-11 items-center break-all text-base font-semibold text-oh-ember-light underline decoration-oh-ember-light/40 underline-offset-4 hover:decoration-oh-ember-light">
                  <Literal>{HELLO_EMAIL}</Literal>
                </a>
              </div>
            </Reveal>
            <Reveal as="li" delay={160} className={card}>
              <span aria-hidden="true" className={iconWrap}>
                <Icon name="pin" size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-lg font-semibold text-oh-cream">{t("other.visit.title")}</p>
                <p className="m-0 mt-1 text-base text-oh-cream/75">{t("other.visit.body")}</p>
                <Link href={localizedHref(locale, "/locations")} className="mt-2 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oh-cream no-underline hover:text-oh-ember-light">
                  {t("other.visit.cta")}
                  <Icon name="arrow" size={18} />
                </Link>
              </div>
            </Reveal>
          </ul>
        </aside>
      </div>
    </div>
  );
}
