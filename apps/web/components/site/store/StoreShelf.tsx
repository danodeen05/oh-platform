"use client";

/**
 * The store's shelf (Task D10): category chips, the product grid and a
 * product sheet (photo, story, size, quantity, Add to bag). Products come
 * from the server page (GET /shop/products); names and descriptions are the
 * row's own translations. The bag lives in contexts/cart-context (local to
 * this browser) and is only ever priced by the server at checkout.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/contexts/cart-context";
import { Icon } from "@/components/site/icons/Icon";
import { Sheet } from "@/components/site/motion/Sheet";
import { Reveal } from "@/components/site/motion/Reveal";
import { formatCents } from "@/lib/site/order-flow";
import { categoryKey, localizeProduct, LOW_STOCK, maxQuantity, productImage, productSizes, SHOP_CATEGORIES, type ShopCategory, type ShopProductRow } from "@/lib/site/store";
import { PlusMinus, PRIMARY, ProductPhoto, StepperView } from "./ui";
import { BagBar } from "./BagBar";

/** The sheet in the night palette (the motion kit's default panel is light). */
const NIGHT_SHEET =
  "[&_.oh-sheet-panel]:bg-oh-ink [&_.oh-sheet-panel]:text-oh-cream [&_.oh-sheet-grabber]:bg-oh-stone";

export function StoreShelf({ products }: { products: ShopProductRow[] }) {
  const t = useTranslations("store");
  const locale = useLocale();
  const { addItem, getItemQuantity, items } = useCart();
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [open, setOpen] = useState<ShopProductRow | null>(null);
  const [announce, setAnnounce] = useState("");

  const present = useMemo(() => SHOP_CATEGORIES.filter((c) => products.some((p) => p.category === c)), [products]);
  const shown = category === "all" ? products : products.filter((p) => p.category === category);
  const money = (c: number) => formatCents(c, locale);
  const inBag = (p: ShopProductRow) => items.filter((i) => i.id === p.id).reduce((s, i) => s + i.quantity, 0);

  const add = (p: ShopProductRow, quantity: number, size?: string) => {
    const room = maxQuantity(p.stockCount) - getItemQuantity(p.id, size);
    const qty = Math.min(quantity, room);
    if (qty <= 0) return;
    addItem({ id: p.id, slug: p.slug, name: p.name, priceCents: p.priceCents, variant: size }, qty);
    setAnnounce(`${t("product.added")}: ${localizeProduct(p, locale).name}`);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        {present.length > 1 ? (
          <div role="group" aria-label={t("shelf.filterLabel")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            {(["all", ...present] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                data-category={c}
                onClick={() => setCategory(c)}
                className={`min-h-11 shrink-0 cursor-pointer appearance-none rounded-full border px-4 font-[inherit] text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream ${
                  category === c ? "border-oh-cream bg-oh-cream text-oh-charcoal" : "border-oh-stone bg-transparent text-oh-cream hover:border-oh-cream/60"
                }`}
              >
                {c === "all" ? t("categories.all") : t(`categories.${c}`)}
              </button>
            ))}
          </div>
        ) : null}

        <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-7 p-0 md:grid-cols-3 md:gap-x-6 md:gap-y-10 xl:grid-cols-4" data-product-grid>
          {shown.map((p, i) => {
            const { name } = localizeProduct(p, locale);
            const sizes = productSizes(p.variants);
            const max = maxQuantity(p.stockCount);
            const soldOut = max === 0;
            const count = inBag(p);
            const badge = soldOut ? t("product.soldOut") : typeof p.stockCount === "number" && p.stockCount < LOW_STOCK ? t("product.fewLeft", { count: p.stockCount }) : categoryKey(p.category) === "LIMITED_EDITION" ? t("product.limited") : null;
            return (
              <Reveal as="li" key={p.id} delay={Math.min(i, 6) * 60} className="relative flex min-w-0 flex-col" data-product={p.slug}>
                <button type="button" onClick={() => setOpen(p)} aria-label={t("product.open", { name })} className="group block cursor-pointer appearance-none overflow-hidden rounded-2xl border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream">
                  <ProductPhoto image={productImage(p)} alt="" sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw" className={`w-full rounded-2xl transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none ${soldOut ? "opacity-60" : ""}`} />
                </button>
                {badge ? (
                  <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold ${soldOut ? "bg-oh-charcoal/85 text-oh-cream" : "bg-oh-cream text-oh-charcoal"}`}>{badge}</span>
                ) : null}
                <div className="mt-3 flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-[15px] font-semibold leading-snug text-oh-cream [overflow-wrap:anywhere]">{name}</p>
                    <p className="m-0 mt-0.5 text-[15px] tabular-nums text-oh-mute">{money(p.priceCents)}</p>
                    {count > 0 ? <p className="m-0 mt-0.5 text-sm text-oh-ember-light">{t("product.inBag", { count })}</p> : null}
                  </div>
                  {sizes.length === 0 ? (
                    <button
                      type="button"
                      data-quick-add
                      disabled={soldOut || getItemQuantity(p.id) >= max}
                      onClick={() => add(p, 1)}
                      aria-label={t("product.addNamed", { name })}
                      className="flex h-11 w-11 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-oh-ember-deep p-0 text-oh-cream transition-[filter,transform] hover:brightness-90 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-not-allowed disabled:bg-oh-stone motion-reduce:transition-none"
                    >
                      <PlusMinus plus />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(p)}
                      disabled={soldOut}
                      aria-label={t("product.open", { name })}
                      className="flex h-11 w-11 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border border-oh-stone bg-transparent p-0 text-oh-cream hover:bg-oh-stone/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:opacity-40"
                    >
                      <Icon name="chevron" size={18} />
                    </button>
                  )}
                </div>
              </Reveal>
            );
          })}
        </ul>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>

      <Sheet open={open !== null} onClose={() => setOpen(null)} label={open ? localizeProduct(open, locale).name : t("product.close")} snapPoints={[0.92]} className={NIGHT_SHEET}>
        {open ? <ProductSheet key={open.id} product={open} onAdd={(q, s) => { add(open, q, s); setOpen(null); }} onClose={() => setOpen(null)} alreadyInBag={(s) => getItemQuantity(open.id, s)} /> : null}
      </Sheet>
      <BagBar />
    </>
  );
}

function ProductSheet({ product, onAdd, onClose, alreadyInBag }: { product: ShopProductRow; onAdd: (quantity: number, size?: string) => void; onClose: () => void; alreadyInBag: (size?: string) => number }) {
  const t = useTranslations("store.product");
  const locale = useLocale();
  const { name, description } = localizeProduct(product, locale);
  const sizes = productSizes(product.variants);
  const [size, setSize] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const room = Math.max(0, maxQuantity(product.stockCount) - alreadyInBag(size));
  const soldOut = room === 0;

  return (
    <div className="flex flex-col gap-5 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:px-6" data-product-sheet={product.slug}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={`m-0 text-2xl font-normal leading-tight text-oh-cream ${locale.startsWith("zh") ? "font-display-cjk" : "font-display"}`}>{name}</h2>
          <p className="m-0 mt-1 text-lg tabular-nums text-oh-cream/85">{formatCents(product.priceCents, locale)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("close")} className="flex h-11 w-11 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-oh-stone/60 p-0 text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream">
          <Icon name="close" size={18} />
        </button>
      </div>
      <ProductPhoto image={productImage(product)} alt={name} sizes="(min-width: 768px) 480px, 92vw" className="mx-auto w-full max-w-[42svh] rounded-2xl md:max-w-none" />
      {description ? <p className="m-0 text-base leading-relaxed text-oh-cream/85">{description}</p> : null}

      {sizes.length > 0 ? (
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold text-oh-cream/85">{t("size")}</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s.size}
                type="button"
                aria-pressed={size === s.size}
                aria-label={s.soldOut ? t("sizeSoldOut", { size: s.size }) : undefined}
                disabled={s.soldOut}
                data-size={s.size}
                onClick={() => {
                  setSize(s.size);
                  setNeedSize(false);
                }}
                className={`min-h-11 min-w-12 cursor-pointer appearance-none rounded-full border px-4 font-[inherit] text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                  size === s.size ? "border-oh-cream bg-oh-cream text-oh-charcoal" : "border-oh-stone bg-transparent text-oh-cream"
                }`}
              >
                {s.size}
              </button>
            ))}
          </div>
          {needSize ? (
            <p role="alert" className="m-0 mt-2 text-sm text-oh-ember-light">
              {t("pickSize")}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-oh-cream/85">{t("quantity")}</span>
        <StepperView value={Math.min(qty, Math.max(1, room))} min={1} max={Math.max(1, room)} onChange={setQty} fewerLabel={t("fewer")} moreLabel={t("more")} label={t("quantity")} id="sheet" />
      </div>

      <button
        type="button"
        data-add-to-bag
        disabled={soldOut}
        onClick={() => {
          if (sizes.length > 0 && !size) {
            setNeedSize(true);
            return;
          }
          onAdd(Math.min(qty, room), size);
        }}
        className={`${PRIMARY} h-14 w-full`}
      >
        {soldOut ? t("soldOut") : t("addToBagAmount", { amount: formatCents(product.priceCents * Math.min(qty, Math.max(1, room)), locale) })}
      </button>
    </div>
  );
}
