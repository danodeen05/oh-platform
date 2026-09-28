"use client";

/**
 * A shelf tag's product (Task D10, /store/item/:qrCode). "Buy now" puts it
 * in the bag and opens checkout set to pickup, so the one checkout (and its
 * server pricing) handles in-restaurant purchases too.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/contexts/cart-context";
import { Reveal } from "@/components/site/motion/Reveal";
import { Eyebrow } from "@/components/site/Text";
import { usePublishOrderBack } from "@/lib/site/order-back";
import { formatCents } from "@/lib/site/order-flow";
import { localizeProduct, maxQuantity, productImage, productSizes, type ShopProductRow } from "@/lib/site/store";
import { PRIMARY, ProductPhoto, SECONDARY, StepperView } from "./ui";

export function InStoreItem({ product }: { product: ShopProductRow }) {
  const t = useTranslations("store");
  const locale = useLocale();
  const router = useRouter();
  const { addItem, getItemQuantity } = useCart();
  const { name, description } = localizeProduct(product, locale);
  const sizes = productSizes(product.variants);
  const [size, setSize] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  usePublishOrderBack(`/${locale}/store/scan`, t("item.scanAgain"));
  const room = Math.max(0, maxQuantity(product.stockCount) - getItemQuantity(product.id, size));

  const add = (then: "checkout" | "stay") => {
    if (sizes.length && !size) {
      setNeedSize(true);
      return;
    }
    if (room > 0) addItem({ id: product.id, slug: product.slug, name: product.name, priceCents: product.priceCents, variant: size }, Math.min(qty, room));
    router.push(then === "checkout" ? `/${locale}/store/checkout?pickup=1` : `/${locale}/store/cart`);
  };

  return (
    <div data-store-item={product.slug} className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 pt-4 md:grid-cols-2 md:gap-10 md:px-8 md:pt-10">
      <Reveal from="fade">
        <ProductPhoto image={productImage(product)} alt={name} sizes="(min-width: 768px) 480px, 100vw" priority className="w-full rounded-3xl" />
      </Reveal>
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("item.eyebrow")}
          </Eyebrow>
          <h1 className={`m-0 mt-2 text-[clamp(2rem,7vw,2.75rem)] font-normal leading-tight text-oh-cream ${locale.startsWith("zh") ? "font-display-cjk" : "font-display"}`}>{name}</h1>
          <p className="m-0 mt-2 text-xl tabular-nums text-oh-cream/90">{formatCents(product.priceCents, locale)}</p>
        </div>
        {description ? <p className="m-0 text-base leading-relaxed text-oh-cream/85">{description}</p> : null}
        {sizes.length ? (
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-oh-cream/85">{t("product.size")}</legend>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  aria-pressed={size === s.size}
                  disabled={s.soldOut}
                  onClick={() => {
                    setSize(s.size);
                    setNeedSize(false);
                  }}
                  className={`min-h-11 min-w-12 cursor-pointer appearance-none rounded-full border px-4 font-[inherit] text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:opacity-40 ${size === s.size ? "border-oh-cream bg-oh-cream text-oh-charcoal" : "border-oh-stone bg-transparent text-oh-cream"}`}
                >
                  {s.size}
                </button>
              ))}
            </div>
            {needSize ? (
              <p role="alert" className="m-0 mt-2 text-sm text-oh-ember-light">
                {t("product.pickSize")}
              </p>
            ) : null}
          </fieldset>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-oh-cream/85">{t("product.quantity")}</span>
          <StepperView value={Math.min(qty, Math.max(1, room))} min={1} max={Math.max(1, room)} onChange={setQty} fewerLabel={t("product.fewer")} moreLabel={t("product.more")} label={t("product.quantity")} />
        </div>
        <p className="m-0 rounded-2xl bg-oh-ink px-4 py-3 text-[15px] text-oh-cream/85">{t("item.pickupNote")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => add("checkout")} disabled={room === 0} className={`${PRIMARY} h-14 flex-1`} data-buy-now>
            {room === 0 ? t("product.soldOut") : t("item.buyNow")}
          </button>
          <button type="button" onClick={() => add("stay")} disabled={room === 0} className={`${SECONDARY} h-14 flex-1`}>
            {t("product.addToBag")}
          </button>
        </div>
        <Link href={`/${locale}/store/scan`} className="inline-flex min-h-11 items-center self-start text-[15px] text-oh-mute underline underline-offset-4">
          {t("item.scanAgain")}
        </Link>
      </div>
    </div>
  );
}
