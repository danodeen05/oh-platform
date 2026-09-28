"use client";

/**
 * The cart as the server priced it (Task E2), on linen like every food
 * surface. Lines, totals and the visit come from the `cart` card the API
 * builds from quoteOrder; nothing is added up here.
 */
import { useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import type { IconName } from "@/components/site/icons/paths";
import { getMenuItemImage } from "@/lib/menu-images";
import { CardFrame, Eyebrow, money, podText, useCardContext } from "./CardKit";
import type { CartCardData } from "./types";

export function CartCard({ card }: { card: CartCardData }) {
  const t = useTranslations("chappyWeb.cards.cart");
  const { locale, cjk } = useCardContext();
  const m = (c: number) => money(c, locale);
  const showDue = card.creditCents > 0 && card.amountDueCents !== card.totalCents;

  const visit: { icon: IconName; text: string }[] = [];
  if (card.location) visit.push({ icon: "pin", text: card.location });
  visit.push({ icon: "clock", text: card.arrival ? t("arrival", { time: card.arrival }) : t("asap") });
  visit.push({ icon: "pod", text: card.pod ? t("pod", { pod: podText(card.pod) }) : card.podBest ? t("podBest") : t("podCheckIn") });
  if (card.partySize > 1) visit.push({ icon: "user", text: t("party", { count: card.partySize }) });

  return (
    <CardFrame type="cart" label={t("label")} tone="linen">
      <div className="px-4 pb-4 pt-4">
        <Eyebrow tone="linen">{t("title")}</Eyebrow>
        <ul className="m-0 mt-3 grid list-none gap-3 p-0">
          {card.lines.map((line, i) => {
            const img = line.imageKey ? getMenuItemImage(line.imageKey) : null;
            const name = line.name || t("item");
            return (
              <li key={`${line.menuItemId}-${i}`} className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-oh-paper">
                  {img ? <img src={img} alt="" width={44} height={44} loading="lazy" className="h-full w-full object-cover" /> : <Icon name="bowl" size={22} className="text-oh-clay" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[0.95rem] font-semibold leading-snug">{name}</span>
                  {line.value ? <span className="block break-words text-sm leading-snug text-oh-ink/65">{line.value}</span> : null}
                </span>
                {line.quantity > 1 ? <span className="shrink-0 text-sm tabular-nums text-oh-ink/65">{`×${line.quantity}`}</span> : null}
                <span className="shrink-0 text-[0.95rem] tabular-nums">{line.priceCents > 0 ? m(line.priceCents) : "–"}</span>
              </li>
            );
          })}
        </ul>

        <dl className="m-0 mt-4 grid gap-1.5 border-0 border-t border-dashed border-oh-ink/20 pt-3 text-sm">
          <Row label={t("subtotal")} value={m(card.subtotalCents)} />
          {card.savingsCents > 0 ? <Row label={t("savings")} value={`−${m(card.savingsCents)}`} accent /> : null}
          <Row label={t("tax")} value={m(card.taxCents)} />
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <dt className="font-semibold">{t("total")}</dt>
            <dd className={`m-0 ${cjk ? "font-display-cjk" : "font-display"} text-2xl tabular-nums`}>{m(card.totalCents)}</dd>
          </div>
          {showDue ? (
            <>
              <Row label={t("credit")} value={`−${m(card.creditCents)}`} accent />
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold">{t("due")}</dt>
                <dd className="m-0 text-lg font-semibold tabular-nums">{m(card.amountDueCents)}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>

      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 bg-oh-ink/[0.06] px-4 py-3 text-sm">
        {visit.map((v) => (
          <li key={v.icon} className="inline-flex min-w-0 items-center gap-1.5">
            <Icon name={v.icon} size={16} className="shrink-0 text-oh-clay" />
            <span className="min-w-0 break-words">{v.text}</span>
          </li>
        ))}
      </ul>
    </CardFrame>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-oh-ink/70">{label}</dt>
      <dd className={`m-0 tabular-nums ${accent ? "text-oh-olive" : ""}`}>{value}</dd>
    </div>
  );
}
