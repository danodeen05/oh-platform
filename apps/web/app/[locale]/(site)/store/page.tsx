/**
 * Task D10: /store. The shelf photo (store-interior) opens the page, then
 * the products from GET /shop/products (their own translations), a bag bar
 * above the dock, and a way into gift cards. Checkout is priced by the
 * server (POST /shop/orders), never here.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { StoreShelf } from "@/components/site/store/StoreShelf";
import { GiftCardFace } from "@/components/site/giftcards/GiftCardFace";
import { PRIMARY, SECONDARY } from "@/components/site/store/ui";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { SITE_IMAGES } from "@/lib/site/images";
import { getShopProducts } from "@/lib/site/store-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("store.meta");
  return { title: t("title"), description: t("description") };
}

export default async function StorePage() {
  const locale = await getLocale();
  const t = await getTranslations("store");
  const tRoot = await getTranslations();
  const products = await getShopProducts();

  return (
    <div data-store-page className="overflow-x-clip pb-24">
      <section aria-labelledby="store-title" className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <SitePicture image="store-interior" sizes="100vw" priority alt={tRoot(SITE_IMAGES["store-interior"].alt)} className="absolute inset-0 block [&>img]:h-full [&>img]:w-full [&>img]:object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-oh-charcoal)_30%,transparent)_0%,color-mix(in_oklab,var(--color-oh-charcoal)_70%,transparent)_55%,var(--color-oh-charcoal)_100%)]" />
        </div>
        <div className="mx-auto flex min-h-[62svh] max-w-6xl flex-col justify-end px-4 pb-10 pt-24 md:min-h-[64svh] md:px-8 md:pb-16">
          <Reveal from="fade">
            <Eyebrow locale={locale} className="text-oh-ember-light">
              {t("hero.eyebrow")}
            </Eyebrow>
            <Display id="store-title" locale={locale} className="m-0 mt-3 max-w-3xl text-[clamp(2.5rem,9vw,5rem)] text-oh-cream">
              {t("hero.title")}
            </Display>
            <Body locale={locale} className="m-0 mt-4 max-w-xl text-lg text-oh-cream/90">
              {t("hero.lede")}
            </Body>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#shelf" className={PRIMARY} data-store-cta>
                {t("hero.shop")}
                <Icon name="arrow" size={18} />
              </a>
              <Link href={`/${locale}/store/scan`} className={SECONDARY}>
                {t("hero.scan")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="shelf" aria-labelledby="shelf-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-6 md:px-8 md:pt-10">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <Title id="shelf-title" locale={locale} className="m-0 text-oh-cream">
            {t("shelf.title")}
          </Title>
          {products && products.length ? <span className="text-[15px] text-oh-mute">{t("shelf.count", { count: products.length })}</span> : null}
        </div>
        {products === null ? (
          <div role="alert" className="flex flex-col items-start gap-4 rounded-3xl border border-oh-stone/70 bg-oh-ink p-5">
            <p className="m-0 text-base text-oh-cream/85">{t("loadError")}</p>
            <a href={`/${locale}/store`} className={SECONDARY}>
              {t("retry")}
            </a>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-oh-stone/70 bg-oh-ink p-6" data-store-empty>
            <p className="m-0 text-xl font-semibold text-oh-cream">{t("empty.title")}</p>
            <p className="m-0 mt-2 text-base text-oh-cream/80">{t("empty.body")}</p>
          </div>
        ) : (
          <StoreShelf products={products} />
        )}
      </section>

      <section aria-labelledby="store-gift" className="mx-auto mt-16 max-w-6xl px-4 md:mt-24 md:px-8">
        <Reveal className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-oh-linen p-6 text-oh-charcoal md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-10">
          <div className="min-w-0">
            <Eyebrow locale={locale} className="text-oh-ember-deep">
              {t("gift.eyebrow")}
            </Eyebrow>
            <h2 id="store-gift" className={`m-0 mt-2 text-[clamp(1.75rem,5vw,2.5rem)] font-normal leading-tight ${locale.startsWith("zh") ? "font-display-cjk" : "font-display"}`}>
              {t("gift.title")}
            </h2>
            <p className="m-0 mt-3 max-w-md text-base leading-relaxed text-oh-charcoal/80">{t("gift.body")}</p>
            <Link href={`/${locale}/gift-cards`} className={`${PRIMARY} mt-6`}>
              {t("gift.cta")}
              <Icon name="gift" size={18} />
            </Link>
          </div>
          <GiftCardFace design="classic" amount={null} className="mx-auto w-full max-w-sm rotate-[-3deg] motion-reduce:rotate-0" />
        </Reveal>
      </section>
    </div>
  );
}
