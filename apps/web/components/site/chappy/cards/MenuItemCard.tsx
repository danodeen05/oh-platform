"use client";

/**
 * One dish (Task E2), on linen: the photo (lib/menu-images.ts, keyed by the
 * item's English name), the localized name and description, the server's
 * price, dietary marks and spice. "Add to my order" just says so to Chappy,
 * as the customer; the cart tool does the rest.
 */
import { useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import type { IconName } from "@/components/site/icons/paths";
import { getMenuItemImage } from "@/lib/menu-images";
import { CardFrame, QuietButton, money, useCardContext } from "./CardKit";
import type { MenuItemCardData } from "./types";

const DIETARY_ICON: Record<string, IconName> = { vegetarian: "leaf", vegan: "leaf", gluten_free: "wheat-off" };
const DIETARY = ["vegetarian", "vegan", "gluten_free"] as const;

export function MenuItemCard({ card }: { card: MenuItemCardData }) {
  const t = useTranslations("chappyWeb.cards.menuItem");
  const { locale, cjk, send, busy } = useCardContext();
  const img = card.imageKey ? getMenuItemImage(card.imageKey) : null;
  const dietary = DIETARY.filter((d) => card.dietary.includes(d));
  const spice = Math.min(card.spiceLevel, 5);

  return (
    <CardFrame type="menu-item" label={t("label", { name: card.name })} tone="linen">
      {img ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-oh-paper">
          <img src={img} alt={card.name} loading="lazy" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`${cjk ? "font-display-cjk" : "font-display"} m-0 min-w-0 break-words text-[1.6rem] font-normal leading-tight`}>{card.name}</h3>
          <p className="m-0 mt-1 shrink-0 text-lg font-semibold tabular-nums">{money(card.priceCents, locale)}</p>
        </div>
        {card.description ? <p className="m-0 mt-2 line-clamp-4 text-[0.95rem] leading-relaxed text-oh-ink/75">{card.description}</p> : null}
        {dietary.length || spice > 0 ? (
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
            {dietary.map((d) => (
              <li key={d} className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-oh-olive/15 px-3 text-sm text-oh-ink">
                <Icon name={DIETARY_ICON[d]} size={14} className="text-oh-olive" />
                {t(`dietary.${d}`)}
              </li>
            ))}
            {spice > 0 ? (
              <li className="inline-flex min-h-7 items-center gap-1 rounded-full bg-oh-ember/10 px-3 text-sm text-oh-ink">
                <span className="inline-flex text-oh-ember-deep" aria-hidden="true">
                  {Array.from({ length: spice }, (_, i) => (
                    <Icon key={i} name="flame" size={14} />
                  ))}
                </span>
                <span className="sr-only">{t("spice", { level: spice })}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
        <QuietButton tone="linen" data-menu-add onClick={() => send(t("addPrompt", { name: card.name }))} disabled={busy} className="mt-4 w-full">
          <Icon name="bowl" size={18} />
          {t("add")}
        </QuietButton>
      </div>
    </CardFrame>
  );
}
