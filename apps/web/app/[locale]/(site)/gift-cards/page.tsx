/**
 * Task D10: /gift-cards. The card (the bowl-flatlay photograph under the
 * chosen face), the amounts, why it's easy, and the questions people ask.
 * Buying happens on /gift-cards/purchase; checking on /gift-cards/balance.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { GiftCardFace } from "@/components/site/giftcards/GiftCardFace";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { PRIMARY, SECONDARY } from "@/components/site/store/ui";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { formatCents } from "@/lib/site/order-flow";
import { GIFT_PRESETS } from "@/lib/site/store";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("giftCards.meta");
  return { title: t("title"), description: t("description") };
}

const WHY: { key: "instant" | "note" | "anywhere" | "lasts"; icon: IconName }[] = [
  { key: "instant", icon: "mail" },
  { key: "note", icon: "gift" },
  { key: "anywhere", icon: "bowl" },
  { key: "lasts", icon: "seal" },
];
const FAQ = ["delivery", "spend", "discounts", "balance"] as const;

export default async function GiftCardsPage() {
  const locale = await getLocale();
  const t = await getTranslations("giftCards");
  const serif = locale.startsWith("zh") ? "font-display-cjk" : "font-display";

  return (
    <div data-gift-cards-page className="overflow-x-clip pb-16">
      <section aria-labelledby="gift-title" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14 md:px-8 md:pb-20 md:pt-16">
        <Reveal from="fade" className="min-w-0">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("hero.eyebrow")}
          </Eyebrow>
          <Display id="gift-title" locale={locale} className="m-0 mt-3 text-[clamp(2.5rem,9vw,4.75rem)] text-oh-cream">
            {t("hero.title")}
          </Display>
          <Body locale={locale} className="m-0 mt-4 max-w-lg text-lg text-oh-cream/85">
            {t("hero.lede")}
          </Body>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`/${locale}/gift-cards/purchase`} className={PRIMARY} data-gift-cta>
              {t("hero.buy")}
              <Icon name="arrow" size={18} />
            </Link>
            <Link href={`/${locale}/gift-cards/balance`} className={SECONDARY}>
              {t("hero.balance")}
            </Link>
          </div>
        </Reveal>
        <Reveal from="scale" delay={120} className="relative mx-auto w-full max-w-md min-w-0">
          <GiftCardFace design="gold" amount={null} className="absolute inset-x-[8%] top-0 -translate-y-6 rotate-[7deg] opacity-80 motion-reduce:rotate-0" />
          <GiftCardFace design="classic" amount={50} className="relative -rotate-[4deg] motion-reduce:rotate-0" />
        </Reveal>
      </section>

      <section aria-labelledby="gift-amounts" className="mx-auto max-w-6xl px-4 md:px-8">
        <Reveal className="rounded-[2rem] bg-oh-linen p-6 text-oh-charcoal md:p-10">
          <h2 id="gift-amounts" className={`m-0 text-[clamp(1.75rem,5vw,2.5rem)] font-normal leading-tight ${serif}`}>
            {t("amounts.title")}
          </h2>
          <p className="m-0 mt-2 text-base text-oh-charcoal/80">{t("amounts.lede")}</p>
          <ul className="m-0 mt-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
            {GIFT_PRESETS.map((d) => (
              <li key={d}>
                <Link
                  href={`/${locale}/gift-cards/purchase?amount=${d}`}
                  aria-label={t("amounts.choose", { amount: formatCents(d * 100, locale) })}
                  className="flex min-h-16 items-center justify-center rounded-2xl bg-oh-charcoal text-xl font-semibold tabular-nums text-oh-cream no-underline transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ember-deep motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  data-preset={d}
                >
                  {formatCents(d * 100, locale)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-4 text-sm text-oh-charcoal/75">{t("amounts.customHint", { min: formatCents(1000, locale), max: formatCents(50000, locale) })}</p>
        </Reveal>
      </section>

      <section aria-labelledby="gift-why" className="mx-auto mt-16 max-w-6xl px-4 md:mt-24 md:px-8">
        <Title id="gift-why" locale={locale} className="m-0 text-oh-cream">
          {t("why.title")}
        </Title>
        <ul className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ key, icon }, i) => (
            <Reveal as="li" key={key} delay={i * 70} className="flex gap-4 rounded-3xl border border-oh-stone/70 bg-oh-ink p-5 lg:flex-col">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep/25 text-oh-ember-light">
                <Icon name={icon} size={22} />
              </span>
              <div className="min-w-0">
                <p className="m-0 text-lg font-semibold text-oh-cream">{t(`why.${key}.title`)}</p>
                <p className="m-0 mt-1 text-base text-oh-cream/80">{t(`why.${key}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gift-faq" className="mx-auto mt-16 max-w-3xl px-4 md:mt-24 md:px-8">
        <Title id="gift-faq" locale={locale} className="m-0 text-oh-cream">
          {t("faq.title")}
        </Title>
        <div className="mt-6 divide-y divide-oh-stone/70 border-y border-oh-stone/70">
          {FAQ.map((k) => (
            <details key={k} className="group" data-faq={k}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream [&::-webkit-details-marker]:hidden">
                {t(`faq.${k}.q`)}
                <Icon name="chevron" size={18} className="shrink-0 rotate-90 transition-transform duration-200 group-open:-rotate-90 motion-reduce:transition-none" />
              </summary>
              <p className="m-0 pb-5 text-base leading-relaxed text-oh-cream/85">{t(`faq.${k}.a`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="gift-end" className="mx-auto mt-16 max-w-6xl px-4 md:mt-24 md:px-8">
        <Reveal className="flex flex-col items-start gap-4 rounded-[2rem] border border-oh-stone/70 bg-oh-ink p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="min-w-0">
            <h2 id="gift-end" className={`m-0 text-[clamp(1.75rem,5vw,2.25rem)] font-normal leading-tight text-oh-cream ${serif}`}>
              {t("cta.title")}
            </h2>
            <p className="m-0 mt-2 text-base text-oh-cream/80">{t("cta.body")}</p>
          </div>
          <Link href={`/${locale}/gift-cards/purchase`} className={`${PRIMARY} shrink-0`}>
            {t("hero.buy")}
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
