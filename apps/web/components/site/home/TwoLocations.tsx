/**
 * Task D1, chapter 8: Two locations, and the close.
 *
 * The sign over the reflecting pool, drifting in its frame, then a card per
 * restaurant: name and neighborhood (copy, from messages), live open or
 * closed, today's hours and pods free (LocationLive), a link to its page
 * (/locations/<slug>, built by D4) and directions. The story ends on the
 * Order CTA.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import { directionsUrl, type HomeLocation } from "@/lib/site/home-locations";
import { SITE_IMAGES } from "@/lib/site/images";
import { localizedHref } from "@/lib/site/nav";
import { LocationLive } from "./LocationLive";
import "./home.css";

export async function TwoLocations({ locale, locations }: { locale: string; locations: HomeLocation[] }) {
  const t = await getTranslations("home.locations");
  const ti = await getTranslations();
  const serif = locale.startsWith("zh") ? "font-display-cjk" : "font-display";

  return (
    <section id="locations" data-chapter="locations" aria-labelledby="locations-title" className="px-5 pb-20 pt-20 md:px-8 md:pb-28 md:pt-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Title id="locations-title" locale={locale} className="m-0 mt-3 text-oh-cream [text-wrap:balance]">
            {t("title")}
          </Title>
          <Body locale={locale} className="m-0 mt-4 text-oh-cream/80">
            {t("lede")}
          </Body>
        </Reveal>

        <div className="hm-drift-frame relative mt-10 aspect-[4/3] overflow-hidden rounded-3xl md:aspect-[21/9]">
          <div className="hm-drift absolute inset-0">
            <SitePicture
              image="sign-pool"
              sizes="(min-width: 1152px) 1088px, 100vw"
              alt={ti(SITE_IMAGES["sign-pool"].alt)}
              className="absolute inset-0 block [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
            />
          </div>
        </div>

        <ul className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-2 md:gap-6">
          {locations.map((loc, i) => {
            const name = t(`cards.${loc.msg}.name`);
            return (
              <Reveal
                as="li"
                key={loc.slug}
                delay={i * 120}
                data-location-card={loc.slug}
                className="flex min-w-0 flex-col rounded-3xl border border-oh-stone/80 bg-oh-ink p-6 md:p-8"
              >
                <p className="m-0 flex items-center gap-2 text-sm text-oh-cream/70">
                  <Icon name="pin" size={16} className="shrink-0 text-oh-ember-light" />
                  {t(`cards.${loc.msg}.area`)}
                </p>
                <h3 className={`m-0 mt-2 ${serif} text-[clamp(1.75rem,7vw,2.5rem)] font-normal leading-tight text-oh-cream`}>{name}</h3>
                <LocationLive id={loc.id} operatingHours={loc.operatingHours} timeZone={loc.timeZone} />
                <div className="mt-auto flex flex-wrap gap-3 pt-6">
                  <Link
                    href={localizedHref(locale, `/locations/${loc.slug}`)}
                    data-location-link
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-oh-cream px-5 text-base font-semibold text-oh-ink no-underline transition-colors hover:bg-oh-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                  >
                    {t("visit", { name })}
                    <Icon name="arrow" size={16} />
                  </Link>
                  <a
                    href={directionsUrl(loc.directionsTo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-location-directions
                    aria-label={t("directionsLabel", { name })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-oh-cream/30 px-5 text-base font-semibold text-oh-cream no-underline transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                  >
                    <Icon name="pin" size={16} />
                    {t("directions")}
                  </a>
                </div>
              </Reveal>
            );
          })}
        </ul>

        <Reveal className="mt-20 flex flex-col items-start gap-5 border-0 border-t border-solid border-oh-stone pt-12 md:mt-28 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className={`m-0 ${serif} text-[clamp(2rem,8vw,3.5rem)] leading-[1.05] text-oh-cream`}>{t("final.title")}</p>
            <Body locale={locale} className="m-0 mt-3 text-oh-cream/80">
              {t("final.body")}
            </Body>
          </div>
          <Link
            href={localizedHref(locale, "/order")}
            data-home-order
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-7 text-base font-semibold text-oh-cream no-underline shadow-[0_12px_32px_-14px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("final.order")}
            <Icon name="arrow" size={18} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
