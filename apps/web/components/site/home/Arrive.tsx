/**
 * Task D1, chapter 1: Arrive.
 *
 * The storefront at dusk, full bleed, under the translucent top bar, and it
 * is the page's LCP: eager, fetchpriority high, with `sizes` that match how
 * wide the 4:3 photo is drawn on a tall phone (it covers the height, so it
 * is about 134vh wide there). The photographed sign carries the mark (fix
 * round 1: the brush reveal moved to the close of chapter 8), the
 * copy rises after it, and the Order CTA sits above the dock. Under it, the
 * live line for the nearer location (LivePill).
 *
 * The hero fills the first screen above the dock (100svh minus --dock-h),
 * so the CTA is always above the fold at 390 x 844.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import type { HomeLocation } from "@/lib/site/home-locations";
import { SITE_IMAGES } from "@/lib/site/images";
import { localizedHref } from "@/lib/site/nav";
import { LivePill } from "./LivePill";
import "./home.css";

export async function Arrive({ locale, locations }: { locale: string; locations: HomeLocation[] }) {
  const t = await getTranslations("home.arrive");
  const tc = await getTranslations("home.locations.cards");
  const ti = await getTranslations();

  return (
    <section
      id="arrive"
      data-chapter="arrive"
      aria-labelledby="arrive-title"
      className="relative isolate -mt-[calc(3.5rem+env(safe-area-inset-top,0px))] flex min-h-[calc(100svh-var(--dock-h))] flex-col justify-end overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 bg-oh-charcoal">
        <SitePicture
          image="storefront-dusk"
          sizes="(max-aspect-ratio: 4/3) 134vh, 100vw"
          priority
          alt={ti(SITE_IMAGES["storefront-dusk"].alt)}
          className="hm-push absolute inset-0 block md:top-14 [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>img]:object-[46%_50%]"
        />
        {/* Legibility: the top bar's strip at the top, the copy's ground at the bottom. */}
        <div className="absolute inset-0 hidden bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-oh-charcoal)_70%,transparent)_0%,transparent_55%)] md:block" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-oh-charcoal)_55%,transparent)_0%,transparent_16%,transparent_34%,color-mix(in_oklab,var(--color-oh-charcoal)_78%,transparent)_58%,var(--color-oh-charcoal)_100%)] md:bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-oh-charcoal)_55%,transparent)_0%,transparent_18%,transparent_40%,color-mix(in_oklab,var(--color-oh-charcoal)_70%,transparent)_70%,var(--color-oh-charcoal)_100%)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 pb-5 pt-40 md:px-8 md:pb-14">
        <Eyebrow locale={locale} className="hm-rise text-oh-ember-light [--hm-delay:0.3s]">
          {t("eyebrow")}
        </Eyebrow>
        <Display
          id="arrive-title"
          locale={locale}
          className="hm-rise m-0 mt-3 max-w-[14ch] text-[clamp(2.6rem,11vw,5.75rem)]! leading-[1.02]! text-oh-cream [--hm-delay:0.4s] [text-wrap:balance]"
        >
          {t("title")}
        </Display>
        <Body locale={locale} className="hm-rise m-0 mt-4 max-w-xl text-oh-cream/85 [--hm-delay:0.55s] md:text-lg">
          {t("lede")}
        </Body>
        <div className="hm-rise mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 [--hm-delay:0.7s]">
          <Link
            href={localizedHref(locale, "/order")}
            data-home-order
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-7 text-base font-semibold text-oh-cream no-underline shadow-[0_12px_32px_-14px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("order")}
            <Icon name="arrow" size={18} />
          </Link>
          <a
            href="#walk-in"
            className="hidden min-h-11 items-center gap-2 text-base font-semibold text-oh-cream/90 sm:inline-flex no-underline underline-offset-4 hover:text-oh-cream hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("story")}
          </a>
        </div>
        <div className="mt-4">
          <LivePill
            locations={locations.map((l) => ({ slug: l.slug, id: l.id, lat: l.lat, lng: l.lng, name: tc(`${l.msg}.name`) }))}
          />
        </div>
      </div>
      <span aria-hidden="true" className="hm-scroll-cue absolute bottom-0 left-1/2 hidden h-10 w-px bg-oh-cream/50 md:block" />
    </section>
  );
}
