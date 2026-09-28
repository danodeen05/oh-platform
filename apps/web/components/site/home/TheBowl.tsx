/**
 * Task D1, chapter 4: The bowl. A linen panel, the one light section of the
 * story, because it's about food.
 *
 * The top-down bowl turns 40 degrees across its pass (BowlSpin), four
 * numbered callouts rise in one by one (Reveal), and the chapter ends on the
 * beef macro, full bleed on a phone, drifting slowly inside its frame on a
 * view timeline (home.css .hm-drift).
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import { SITE_IMAGES } from "@/lib/site/images";
import { localizedHref } from "@/lib/site/nav";
import { BowlSpin } from "./BowlSpin";
import "./home.css";

const CALLOUTS = ["broth", "beef", "cut", "yours"] as const;

export async function TheBowl({ locale }: { locale: string }) {
  const t = await getTranslations("home.bowl");
  const ti = await getTranslations();

  return (
    <section id="the-bowl" data-chapter="the-bowl" aria-labelledby="the-bowl-title" className="bg-oh-linen text-oh-ink">
      {/* One bowl, placed by grid areas: under the title on a phone, beside the copy on desktop. */}
      <div className="mx-auto grid max-w-6xl px-5 pb-14 pt-20 [grid-template-areas:'head'_'bowl'_'list'] md:grid-cols-2 md:items-center md:gap-x-16 md:px-8 md:pb-20 md:pt-28 md:[grid-template-areas:'head_bowl'_'list_bowl']">
        <Reveal className="min-w-0 [grid-area:head]">
          <Eyebrow locale={locale} className="text-oh-ember-deep">
            {t("eyebrow")}
          </Eyebrow>
          <Title id="the-bowl-title" locale={locale} className="m-0 mt-3 max-w-xl text-oh-ink [text-wrap:balance]">
            {t("title")}
          </Title>
          <Body locale={locale} className="m-0 mt-4 max-w-lg text-oh-ink/80">
            {t("lede")}
          </Body>
        </Reveal>
        <div className="mt-10 min-w-0 [grid-area:bowl] md:mt-0">
          <BowlSpin alt={ti(SITE_IMAGES["bowl-slices-top"].alt)} />
        </div>
        <ol className="m-0 mt-10 grid min-w-0 list-none gap-6 p-0 [grid-area:list] sm:grid-cols-2 md:mt-12 md:self-start">
          {CALLOUTS.map((key, i) => (
            <Reveal as="li" key={key} delay={i * 90} data-bowl-callout={key} className="flex min-w-0 gap-4">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep text-sm font-semibold text-oh-cream"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="m-0 text-lg font-semibold leading-snug text-oh-ink">{t(`callouts.${key}.title`)}</h3>
                <p className="m-0 mt-1 text-base leading-relaxed text-oh-ink/75">{t(`callouts.${key}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>

      <figure className="m-0 md:mx-auto md:max-w-6xl md:px-8 md:pb-24">
        <div className="hm-drift-frame relative aspect-[4/5] overflow-hidden md:aspect-[16/9] md:rounded-3xl">
          <div className="hm-drift absolute inset-0">
            <SitePicture
              image="beef-macro"
              sizes="(min-width: 1152px) 1088px, 100vw"
              alt={ti(SITE_IMAGES["beef-macro"].alt)}
              className="absolute inset-0 block [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,color-mix(in_oklab,var(--color-oh-charcoal)_80%,transparent),transparent)] px-5 pb-6 pt-24 md:px-10 md:pb-10">
            <figcaption className="max-w-md">
              <Reveal>
                <Body locale={locale} className="m-0 font-semibold text-oh-cream md:text-lg">
                  {t("macro")}
                </Body>
                <Link
                  href={localizedHref(locale, "/menu")}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-oh-cream px-5 text-base font-semibold text-oh-ink no-underline transition-colors hover:bg-oh-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                >
                  {t("menu")}
                  <Icon name="arrow" size={18} />
                </Link>
              </Reveal>
            </figcaption>
          </div>
        </div>
      </figure>
    </section>
  );
}
