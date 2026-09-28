/**
 * /challenges/meal-for-stranger (Task D9): buy the next guest a bowl.
 * The story and the rules are rendered here on the server; GiveMealFlow is
 * the giving flow (a signed-in giver, a verified Stripe PaymentIntent, then
 * POST /meal-gifts; see lib/site/meal-gift-give.ts). The locations are the
 * public GET /locations, localized by the API.
 *
 * An unclaimed gift comes back as Oh! store credit (POST /meal-gifts/expire),
 * never to the card, and the copy says so.
 */
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { GiveMealFlow } from "@/components/site/gift/GiveMealFlow";
import { MEAL_GIFT_GIVER_REWARD_CENTS } from "@/lib/site/meal-gift-give";
import { formatMoney } from "@/lib/site/program";
import { getSiteLocations } from "../../locations/data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("giveMeal.meta");
  return { title: t("title"), description: t("description") };
}

export default async function MealForStrangerPage() {
  const locale = await getLocale();
  const t = await getTranslations("giveMeal");
  const { locations } = await getSiteLocations(locale);
  const cjk = locale.startsWith("zh");
  const steps = [t("step1"), t("step2"), t("step3"), t("step4")];

  return (
    <div data-give-page className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 md:pt-14">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-12">
        <div className="flex flex-col gap-6">
          <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-[28px] bg-oh-linen md:aspect-[5/4] [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
            <SitePicture image="bowl-chunks-top" sizes="(min-width: 768px) 560px, 100vw" priority alt={t("photoAlt")} className="block h-full w-full" />
          </span>
          <header className="flex flex-col gap-3">
            <Eyebrow locale={locale} className="text-oh-gold">
              {t("eyebrow")}
            </Eyebrow>
            <Display locale={locale} className="m-0 text-oh-cream">
              {t("title")}
            </Display>
            <Body locale={locale} className="m-0 text-oh-cream/80">
              {t("lede")}
            </Body>
          </header>

          <Reveal as="section" aria-labelledby="give-steps" className="rounded-3xl border border-oh-stone p-5 md:p-6">
            <Title locale={locale} id="give-steps" className="m-0 text-oh-cream">
              {t("stepsTitle")}
            </Title>
            <ol data-give-steps className="m-0 mt-4 flex list-none flex-col gap-4 p-0">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oh-stone text-base text-oh-gold ${cjk ? "font-display-cjk" : "font-display"}`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 pt-1 text-[15px] leading-relaxed text-oh-cream/85">{s}</span>
                </li>
              ))}
            </ol>
            <p className="m-0 mt-5 flex gap-3 border-t border-oh-stone pt-4 text-[15px] leading-relaxed text-oh-cream">
              <Icon name="seal" size={20} className="mt-0.5 shrink-0 text-oh-gold" />
              <span className="min-w-0">{t("reward", { reward: formatMoney(MEAL_GIFT_GIVER_REWARD_CENTS, locale) })}</span>
            </p>
          </Reveal>
        </div>

        <div className="md:sticky md:top-24">
          <GiveMealFlow locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
        </div>
      </div>
    </div>
  );
}
