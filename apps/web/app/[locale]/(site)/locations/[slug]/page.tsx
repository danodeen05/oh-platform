/**
 * /locations/[slug] (Task D4): one room. The hero photo, the live comb map
 * (City Creek's 75 pods; University Place's 70, mirrored), "See it in 3D",
 * the week's hours exactly as the API has them, getting here (address, a
 * maps link, parking, landmarks), and the Order CTA. Everything but the live
 * map is server-rendered.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { buildLayout, LOCATION_LAYOUTS } from "@oh/floor-plan";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { LocationFloor } from "@/components/site/floor-plan/LocationFloor";
import type { CombMapLabels } from "@/components/site/floor-plan/CombMap";
import { SITE_IMAGES } from "@/lib/site/images";
import { PLACE_KEY, formatHour, isLocationSlug, mapsHref, orderHref as orderLink, weekRows, type SiteLocation } from "@/lib/site/locations";
import { getSiteLocations } from "../data";

export const dynamic = "force-dynamic";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline hover:bg-oh-ember ${FOCUS}`;
const SECONDARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-oh-cream/70 px-6 text-base font-semibold text-oh-cream no-underline hover:bg-oh-cream hover:text-oh-charcoal ${FOCUS}`;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("locations");
  if (!isLocationSlug(slug)) return { title: t("meta.title") };
  const locale = await getLocale();
  const { locations } = await getSiteLocations(locale);
  const loc = locations.find((l) => l.slug === slug);
  return { title: loc ? `${loc.name} | ${t("meta.title")}` : t("meta.title"), description: t(`places.${PLACE_KEY[slug]}.tagline`) };
}

export default async function LocationPage({ params }: Params) {
  const { slug } = await params;
  if (!isLocationSlug(slug)) notFound();
  const locale = await getLocale();
  const t = await getTranslations("locations");
  const tRoot = await getTranslations();
  const { locations, failed } = await getSiteLocations(locale);
  const loc = locations.find((l) => l.slug === slug);

  if (!loc) {
    if (!failed) notFound();
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <div role="alert" className="rounded-3xl bg-oh-ink p-6">
          <p className="m-0 text-lg font-semibold text-oh-cream">{t("detail.loadErrorTitle")}</p>
          <p className="m-0 mt-1 text-[15px] text-oh-mute">{t("detail.loadErrorBody")}</p>
          <a href={`/${locale}/locations/${slug}`} className={`mt-4 inline-flex min-h-11 items-center rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline ${FOCUS}`}>
            {t("detail.retry")}
          </a>
        </div>
      </div>
    );
  }

  const place = PLACE_KEY[slug];
  const pods = buildLayout(LOCATION_LAYOUTS[loc.layoutKey]).pods.length;
  const orderHref = orderLink(loc, locale);
  const combLabels = tRoot.raw("combMap") as CombMapLabels;
  const nearby = t.raw(`places.${place}.nearby`) as string[];

  return (
    <div data-location-page={slug} className="pb-16">
      <Hero loc={loc} locale={locale} alt={tRoot(SITE_IMAGES[loc.hero].alt)} tagline={t(`places.${place}.tagline`)} t={t} orderHref={orderHref} />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 pt-8 sm:px-6 md:gap-20 md:pt-12">
        <Body locale={locale} className="m-0 max-w-2xl text-lg text-oh-cream/90">
          {t(`places.${place}.intro`, { pods })}
        </Body>

        <section data-location-map-section aria-labelledby="live-title" className="flex flex-col gap-4">
          <div className="flex max-w-2xl flex-col gap-2">
            <Title locale={locale} id="live-title" className="m-0 text-oh-cream">
              {t("detail.mapTitle")}
            </Title>
            <Body locale={locale} className="m-0 text-oh-mute">
              {t("detail.mapLede")}
            </Body>
          </div>
          <LocationFloor
            locationId={loc.id}
            layoutKey={loc.layoutKey}
            labels={combLabels}
            isoLabels={{
              kitchen: combLabels.zones.kitchen,
              lobby: combLabels.zones.lobby,
              store: combLabels.zones.store,
              restrooms: combLabels.zones.restrooms,
              corridor: t("detail.iso.corridor"),
              aisle: t("detail.iso.aisle"),
              loading: t("detail.threeDLoading"),
            }}
            text={{
              loading: t("detail.mapLoading"),
              error: t("detail.mapError"),
              podsFree: t.raw("status.podsFree") as string,
              threeD: t("detail.threeD"),
              threeDHint: t("detail.threeDHint"),
              threeDClose: t("detail.threeDClose"),
              threeDUnavailable: t("detail.threeDUnavailable"),
              threeDAria: t("detail.threeDAria", { name: loc.name }),
            }}
          />
        </section>

        <div className="grid gap-14 md:grid-cols-2 md:gap-10">
          <Reveal as="section" data-location-hours aria-labelledby="hours-title" className="flex flex-col gap-4">
            <Title locale={locale} id="hours-title" className="m-0 text-oh-cream">
              {t("detail.hoursTitle")}
            </Title>
            <Hours loc={loc} locale={locale} t={t} />
          </Reveal>

          <Reveal as="section" data-location-visit aria-labelledby="visit-title" className="flex flex-col gap-4">
            <Title locale={locale} id="visit-title" className="m-0 text-oh-cream">
              {t("detail.visitTitle")}
            </Title>
            <dl className="m-0 flex flex-col gap-5">
              {loc.address ? (
                <div className="flex flex-col gap-1">
                  <dt className="text-xs font-medium uppercase tracking-[0.2em] text-oh-gold">{t("detail.address")}</dt>
                  <dd translate="no" className="m-0 text-base text-oh-cream">{loc.address}</dd>
                  <dd className="m-0 mt-2">
                    <a href={mapsHref(loc.name, loc.address)} target="_blank" rel="noopener noreferrer" aria-label={t("detail.directionsLabel", { name: loc.name })} className={SECONDARY}>
                      <Icon name="pin" size={18} />
                      {t("detail.directions")}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-oh-gold">{t("detail.parking")}</dt>
                <dd className="m-0 text-base text-oh-cream">{t(`places.${place}.parking`)}</dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-oh-gold">{t("detail.nearby")}</dt>
                {loc.landmarks ? <dd className="m-0 text-base text-oh-cream">{loc.landmarks}</dd> : null}
                <dd className="m-0">
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {nearby.map((n) => (
                      <li key={n} className="rounded-full bg-oh-ink px-3.5 py-2 text-[15px] text-oh-cream">
                        {n}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>

        <Reveal as="section" aria-labelledby="order-title" className="flex flex-col items-start gap-4 rounded-[28px] bg-oh-ink p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="flex flex-col gap-2">
            <Title locale={locale} id="order-title" className="m-0 text-oh-cream">
              {t("detail.orderTitle")}
            </Title>
            <Body locale={locale} className="m-0 text-oh-mute">
              {t("detail.orderLede")}
            </Body>
          </div>
          {orderHref ? (
            <Link href={orderHref} data-location-order className={`${PRIMARY} shrink-0`}>
              <Icon name="bowl" size={20} />
              {t("detail.order")}
            </Link>
          ) : (
            <Paused text={t("status.paused")} />
          )}
        </Reveal>

        <Link href={`/${locale}/locations`} className={`inline-flex min-h-11 items-center gap-2 self-start text-[15px] text-oh-cream/80 no-underline hover:text-oh-cream ${FOCUS}`}>
          <span aria-hidden="true" className="inline-flex rotate-180">
            <Icon name="chevron" size={18} />
          </span>
          {t("detail.back")}
        </Link>
      </div>
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

function Hero({ loc, locale, alt, tagline, t, orderHref }: { loc: SiteLocation; locale: string; alt: string; tagline: string; t: T; orderHref: string | null }) {
  return (
    <section data-location-hero className="relative isolate flex min-h-[min(86svh,760px)] flex-col justify-end overflow-hidden md:min-h-[min(78svh,720px)]">
      <div className="absolute inset-0 -z-10 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
        <SitePicture image={loc.hero} sizes="100vw" priority alt={alt} className="block h-full w-full" />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-oh-charcoal from-10% via-oh-charcoal/80 via-45% to-oh-charcoal/0" />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-8 sm:px-6 md:pb-14">
        <Eyebrow locale={locale} className="text-oh-gold">
          {tagline}
        </Eyebrow>
        <Display locale={locale} className="m-0 text-oh-cream [overflow-wrap:anywhere]">
          {loc.name}
        </Display>
        {loc.landmarks ? <p className="m-0 text-[17px] text-oh-cream/85">{loc.landmarks}</p> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-oh-cream">
          {loc.open ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${loc.open === "open" ? "bg-oh-olive-light" : "bg-oh-ember-light"}`} />
              {loc.open === "open" ? t("status.open") : t("status.closed")}
            </span>
          ) : null}
          {loc.podsFree !== null && loc.podsTotal !== null ? (
            <span className="inline-flex items-center gap-2">
              <Icon name="pod" size={18} className="text-oh-gold" />
              {t("status.podsFree", { free: loc.podsFree, total: loc.podsTotal })}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          {orderHref ? (
            <Link href={orderHref} data-location-order className={PRIMARY}>
              <Icon name="bowl" size={20} />
              {t("detail.order")}
            </Link>
          ) : (
            <Paused text={t("status.paused")} />
          )}
          {loc.address ? (
            <a href={mapsHref(loc.name, loc.address)} target="_blank" rel="noopener noreferrer" aria-label={t("detail.directionsLabel", { name: loc.name })} className={SECONDARY}>
              <Icon name="pin" size={18} />
              {t("detail.directions")}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Ordering is off at this location: a plain status in place of the Order CTA, never a link. */
function Paused({ text }: { text: string }) {
  return (
    <p data-location-paused role="status" className="m-0 inline-flex min-h-12 items-center gap-2 rounded-full border border-oh-stone bg-oh-charcoal/80 px-5 text-base text-oh-cream">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-oh-ember-light" />
      {text}
    </p>
  );
}

function Hours({ loc, locale, t }: { loc: SiteLocation; locale: string; t: T }) {
  const rows = weekRows(loc.hours, locale);
  if (rows.length === 0) return <Body locale={locale} className="m-0 text-oh-mute">{t("detail.hoursNone")}</Body>;
  return (
    <>
      <table className="w-full border-collapse text-base">
        <caption className="sr-only">{t("detail.hoursTitle")}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day} data-today={r.today ? "true" : undefined} className={`border-b border-oh-stone ${r.today ? "text-oh-cream" : "text-oh-cream/75"}`}>
              <th scope="row" className="py-3 pr-4 text-left font-normal">
                <span className="inline-flex flex-wrap items-center gap-2">
                  {r.label}
                  {r.today ? <span className="rounded-full bg-oh-gold px-2 py-0.5 text-xs font-semibold text-oh-charcoal">{t("detail.today")}</span> : null}
                </span>
              </th>
              <td className={`py-3 text-right tabular-nums ${r.today ? "font-semibold" : ""}`}>
                {r.open && r.close ? t("detail.hoursRange", { open: formatHour(r.open, locale), close: formatHour(r.close, locale) }) : t("detail.closedDay")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 flex items-center gap-2 text-sm text-oh-mute">
        <Icon name="clock" size={16} className="shrink-0" />
        {t("detail.timezone")}
      </p>
    </>
  );
}
