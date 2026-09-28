"use client";

/**
 * The bag (Task D10, /store/cart). Lines from the local cart, shown with the
 * product's current name, photo and stock from GET /shop/products (so a
 * locale switch or a restock shows up). The items line is the shelf prices;
 * shipping, tax and savings are the server's, at checkout.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/contexts/cart-context";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Title } from "@/components/site/Text";
import { SITE_API_URL } from "@/lib/site/api";
import { usePublishOrderBack } from "@/lib/site/order-back";
import { formatCents } from "@/lib/site/order-flow";
import { FREE_SHIPPING_MIN_CENTS, localizeProduct, maxQuantity, productImage, type ShopProductRow } from "@/lib/site/store";
import { PANEL, PRIMARY, ProductPhoto, SECONDARY, StepperView, MoneyRow } from "./ui";

export function useShopCatalog() {
  const [catalog, setCatalog] = useState<Map<string, ShopProductRow> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${SITE_API_URL}/shop/products`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((rows: ShopProductRow[]) => {
        if (!cancelled) setCatalog(new Map((Array.isArray(rows) ? rows : []).map((p) => [p.id, p])));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return catalog;
}

export function CartView() {
  const t = useTranslations("store.bag");
  const tp = useTranslations("store.product");
  const locale = useLocale();
  const { items, itemCount, subtotalCents, updateQuantity, removeItem } = useCart();
  const catalog = useShopCatalog();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  usePublishOrderBack(`/${locale}/store`, t("back"));
  const money = (c: number) => formatCents(c, locale);
  const gap = FREE_SHIPPING_MIN_CENTS - subtotalCents;

  const lines = useMemo(
    () =>
      items.map((item) => {
        const row = catalog?.get(item.id);
        const name = row ? localizeProduct(row, locale).name : item.name;
        return { item, row, name, max: row ? maxQuantity(row.stockCount) : 20 };
      }),
    [items, catalog, locale],
  );

  return (
    <div data-store-cart className="mx-auto max-w-5xl px-4 pb-16 pt-4 md:px-8 md:pt-10">
      <Reveal from="fade">
        <Title locale={locale} as="h1" className="m-0 text-oh-cream">
          {t("title")}
        </Title>
        <p className="m-0 mt-2 text-base text-oh-mute">{t("lede")}</p>
      </Reveal>

      {!hydrated ? (
        <div className="mt-8 h-40 animate-pulse rounded-3xl bg-oh-ink motion-reduce:animate-none" />
      ) : itemCount === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-3xl border border-oh-stone/70 bg-oh-ink p-6" data-cart-empty>
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-oh-ember-deep/25 text-oh-ember-light">
            <Icon name="store" size={24} />
          </span>
          <p className="m-0 text-xl font-semibold text-oh-cream">{t("emptyTitle")}</p>
          <p className="m-0 text-base text-oh-cream/80">{t("emptyBody")}</p>
          <Link href={`/${locale}/store`} className={SECONDARY}>
            {t("browse")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-start">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {lines.map(({ item, row, name, max }) => (
              <li key={`${item.id}-${item.variant ?? ""}`} data-cart-line={item.slug} className="flex gap-3 rounded-3xl border border-oh-stone/70 bg-oh-ink p-3 md:gap-4 md:p-4">
                <ProductPhoto image={productImage(row ?? { slug: item.slug, imageUrl: null })} alt="" sizes="96px" className="w-20 shrink-0 rounded-2xl md:w-24" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="m-0 text-base font-semibold leading-snug text-oh-cream [overflow-wrap:anywhere]">{name}</p>
                      <p className="m-0 mt-0.5 text-sm text-oh-mute">
                        {item.variant ? `${t("size", { size: item.variant })} / ` : ""}
                        {t("each", { amount: money(item.priceCents) })}
                      </p>
                    </div>
                    <p className="m-0 shrink-0 text-base font-semibold tabular-nums text-oh-cream">{money(item.priceCents * item.quantity)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StepperView
                      value={item.quantity}
                      min={1}
                      max={Math.max(item.quantity, max)}
                      onChange={(n) => updateQuantity(item.id, Math.min(n, 20), item.variant)}
                      fewerLabel={tp("fewer")}
                      moreLabel={tp("more")}
                      label={`${tp("quantity")}: ${name}`}
                      id={item.slug}
                    />
                    <button type="button" onClick={() => removeItem(item.id, item.variant)} aria-label={t("remove", { name })} data-remove className="inline-flex min-h-11 cursor-pointer appearance-none items-center border-0 bg-transparent px-2 font-[inherit] text-[15px] text-oh-mute underline underline-offset-4 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream">
                      {t("removeShort")}
                    </button>
                  </div>
                </div>
              </li>
            ))}
            <li className="px-1 text-sm text-oh-mute">{t("limit", { max: 20 })}</li>
          </ul>

          <aside className={`${PANEL} md:sticky md:top-24`} aria-label={t("title")}>
            <dl className="m-0 flex flex-col gap-2">
              <MoneyRow label={t("itemsTotal")} value={money(subtotalCents)} strong data="cart-subtotal" />
            </dl>
            <p className="m-0 mt-3 text-[15px] text-oh-cream/85">{gap > 0 ? t("freeShippingGap", { amount: money(gap) }) : t("freeShippingReached")}</p>
            <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-oh-stone">
              <div className="h-full w-[var(--fill)] rounded-full bg-oh-ember-light transition-[width] duration-500 motion-reduce:transition-none" style={{ "--fill": `${Math.min(100, Math.round((subtotalCents / FREE_SHIPPING_MIN_CENTS) * 100))}%` } as CSSProperties} />
            </div>
            <p className="m-0 mt-4 text-sm text-oh-mute">{t("lede")}</p>
            <Link href={`/${locale}/store/checkout`} className={`${PRIMARY} mt-5 h-14 w-full`} data-checkout-cta>
              {t("checkout")}
              <Icon name="arrow" size={18} />
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
