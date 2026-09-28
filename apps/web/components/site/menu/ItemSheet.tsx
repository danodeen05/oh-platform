"use client";

/**
 * One menu item up close (Task D3), in the motion kit's bottom sheet: drag
 * the handle down (or Esc, or the backdrop, or Close) to dismiss. The
 * photo on linen, the name and price, the description in this locale (or
 * the group's line when the database has none for it), the dietary and
 * spice marks, and "Order this", which starts the order flow with the item
 * preselected (/{locale}/order?item=<id>).
 */
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Sheet } from "@/components/site/motion/Sheet";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Seal } from "@/components/site/seal/Seal";
import { Icon } from "@/components/site/icons/Icon";
import { SITE_IMAGES } from "@/lib/site/images";
import { orderHref, type MenuCard } from "@/lib/site/menu";
import { formatCents } from "@/lib/site/order-flow";
import { DietaryMarks } from "./DietaryMarks";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ember-deep";

export function ItemSheet({ item, open, onClose }: { item: MenuCard | null; open: boolean; onClose: () => void }) {
  const t = useTranslations("menuPage");
  const tRoot = useTranslations();
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  if (!item) return null;
  const price = item.priceCents > 0 ? formatCents(item.priceCents, locale) : t("included");

  return (
    <Sheet open={open} onClose={onClose} label={t("sheet.label", { name: item.name })} snapPoints={[0.92]} className="[&_.oh-sheet-panel]:px-4 sm:[&_.oh-sheet-panel]:px-6">
      <div data-item-sheet={item.id} className="flex flex-col gap-5 pb-2">
        <figure className="relative m-0 aspect-[16/11] overflow-hidden rounded-3xl bg-oh-linen">
          {item.photo?.kind === "site" ? (
            <div className="absolute inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
              <SitePicture image={item.photo.key} sizes="(min-width: 640px) 600px, 100vw" alt={tRoot(SITE_IMAGES[item.photo.key].alt)} className="block h-full w-full" />
            </div>
          ) : item.photo?.kind === "file" ? (
            <div className="absolute inset-0">
              <Image src={item.photo.src} alt={item.name} fill sizes="(min-width: 640px) 600px, 100vw" className="object-cover" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-oh-clay/60">
              <Icon name="bowl" size={72} />
            </div>
          )}
          {/* First in the tab order, so opening the sheet focuses Close without scrolling the panel. */}
          <button
            type="button"
            onClick={onClose}
            data-item-sheet-close
            aria-label={t("sheet.close")}
            className={`absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full border-0 bg-oh-charcoal/80 p-0 text-oh-cream ${FOCUS}`}
          >
            <Icon name="close" size={20} />
          </button>
          {item.early ? (
            <figcaption data-menu-early className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-oh-charcoal/85 py-1 pl-1 pr-3 text-sm font-semibold text-oh-cream">
              <Seal iconKey="early-access" name={t("early")} size={28} />
              {t("early")}
            </figcaption>
          ) : null}
        </figure>

        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <h2 className={`m-0 min-w-0 text-[1.75rem] font-normal leading-tight text-oh-ink [overflow-wrap:anywhere] ${cjk ? "font-display-cjk" : "font-display"}`}>{item.name}</h2>
            <span data-item-price className="shrink-0 pt-1.5 text-lg font-semibold tabular-nums text-oh-ink">
              {price}
            </span>
          </div>
          <p className={`m-0 text-base leading-relaxed text-oh-stone ${cjk ? "font-cjk" : "font-body"}`}>{item.description || t(`groups.${item.group}.line`)}</p>
          {item.early ? <p className="m-0 text-[15px] text-oh-clay">{t("earlyNote")}</p> : null}
        </div>

        <DietaryMarks marks={item.marks} variant="full" />

        <div className="pt-1">
          <Link
            href={orderHref(locale, item.id)}
            data-order-this
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline ${FOCUS}`}
          >
            {t("sheet.orderThis")}
            <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>
    </Sheet>
  );
}
