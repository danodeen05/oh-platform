/**
 * /locations (Task D4): our two rooms as big photo cards (open now, pods
 * free, address), then the cities coming next. A server component: the data
 * is the public GET /locations, localized by the API.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SITE_IMAGES } from "@/lib/site/images";
import { PLACE_KEY, type SiteLocation } from "@/lib/site/locations";
import { getSiteLocations } from "./data";

export const dynamic = "force-dynamic";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("locations.meta");
  return { title: t("title"), description: t("description") };
}

export default async function LocationsPage() {
  const locale = await getLocale();
  const t = await getTranslations("locations");
  const tRoot = await getTranslations();
  const { locations, failed } = await getSiteLocations(locale);
  const cities = t.raw("comingSoon.cities") as string[];

  return (
    <div data-locations-page className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:pt-14">
      <header className="flex max-w-2xl flex-col gap-3">
        <Eyebrow locale={locale} className="text-oh-gold">
          {t("index.eyebrow")}
        </Eyebrow>
        <Display locale={locale} className="m-0 text-oh-cream">
          {t("index.title")}
        </Display>
        <Body locale={locale} className="m-0 text-oh-cream/80">
          {t("index.lede")}
        </Body>
      </header>

      {locations.length === 0 ? (
        <div role={failed ? "alert" : undefined} className="mt-8 rounded-3xl bg-oh-ink p-6">
          <p className="m-0 text-lg font-semibold text-oh-cream">{t("detail.loadErrorTitle")}</p>
          <p className="m-0 mt-1 text-[15px] text-oh-mute">{t("detail.loadErrorBody")}</p>
          <a href={`/${locale}/locations`} className={`mt-4 inline-flex min-h-11 items-center rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline ${FOCUS}`}>
            {t("detail.retry")}
          </a>
        </div>
      ) : (
        <ul className="m-0 mt-8 grid list-none gap-5 p-0 md:mt-12 md:grid-cols-2 md:gap-6">
          {locations.map((loc, i) => (
            <li key={loc.id}>
              <LocationCard loc={loc} locale={locale} priority={i === 0} alt={tRoot(SITE_IMAGES[loc.hero].alt)} t={t} />
            </li>
          ))}
        </ul>
      )}

      <Reveal as="section" aria-labelledby="coming-soon" className="mt-14 border-t border-oh-stone pt-10 md:mt-20">
        <Title locale={locale} id="coming-soon" className="m-0 text-oh-cream">
          {t("comingSoon.title")}
        </Title>
        <Body locale={locale} className="m-0 mt-2 text-oh-mute">
          {t("comingSoon.description")}
        </Body>
        <ul data-coming-soon className="m-0 mt-5 flex list-none flex-wrap gap-2 p-0">
          {cities.map((city) => (
            <li key={city} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-oh-stone px-4 text-[15px] text-oh-cream">
              <Icon name="pin" size={16} className="shrink-0 text-oh-gold" />
              {city}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

function LocationCard({ loc, locale, priority, alt, t }: { loc: SiteLocation; locale: string; priority: boolean; alt: string; t: T }) {
  const place = PLACE_KEY[loc.slug];
  return (
    <Link
      href={`/${locale}/locations/${loc.slug}`}
      data-location-card={loc.slug}
      className={`group relative flex h-full flex-col overflow-hidden rounded-[28px] bg-oh-ink text-oh-cream no-underline ${FOCUS}`}
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:scale-[1.03] motion-reduce:[&_img]:transition-none">
        <SitePicture image={loc.hero} sizes="(min-width: 768px) 560px, 100vw" priority={priority} alt={alt} className="block h-full w-full" />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-oh-ink via-oh-ink/10 to-transparent" />
        {loc.open ? (
          <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-oh-charcoal/85 px-3 py-1.5 text-sm text-oh-cream">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${loc.open === "open" ? "bg-oh-olive-light" : "bg-oh-ember-light"}`} />
            {loc.open === "open" ? t("status.open") : t("status.closed")}
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-2 p-5 pt-3 md:p-6 md:pt-4">
        <span className={`text-xs font-medium uppercase tracking-[0.2em] text-oh-gold ${locale.startsWith("zh") ? "font-cjk" : "font-body"}`}>{t(`places.${place}.tagline`)}</span>
        <span className={`text-[1.75rem] leading-tight [overflow-wrap:anywhere] ${locale.startsWith("zh") ? "font-display-cjk" : "font-display"}`}>{loc.name}</span>
        {loc.address ? <span className="text-[15px] text-oh-cream/80">{loc.address}</span> : null}
        <span className="mt-auto flex items-center justify-between gap-3 pt-3">
          <span className="flex items-center gap-2 text-[15px] text-oh-cream">
            <Icon name="pod" size={18} className="shrink-0 text-oh-gold" />
            {loc.podsFree !== null && loc.podsTotal !== null ? t("status.podsFree", { free: loc.podsFree, total: loc.podsTotal }) : null}
          </span>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-oh-ember-deep pl-4 pr-3 text-[15px] font-semibold text-oh-cream transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none">
            {t("index.cardCta")}
            <Icon name="chevron" size={18} />
          </span>
        </span>
      </span>
    </Link>
  );
}
