"use client";

/**
 * The order's receipt: item lines, savings, tax, total and what is due now,
 * every number as the server returned it (a quote, or the PaymentIntent's
 * totals). Used by the savings and pay steps.
 */
import { useLocale, useTranslations } from "next-intl";
import { formatCents } from "@/lib/site/order-flow";

export type ReceiptLine = {
  key: string;
  label: string;
  detail?: string | null;
  cents: number;
  /** Shown struck through, with `nowCents` after it (a free bowl: the line becomes $0.00). */
  nowCents?: number | null;
  main?: boolean;
};

export type ReceiptTotals = {
  subtotalCents: number;
  rewardCents: number;
  promoCents: number;
  taxCents: number;
  totalCents: number;
  creditsCents: number;
  giftCardCents: number;
  mealGiftCents: number;
  amountDueCents: number;
};

export function Receipt({ lines, totals }: { lines: ReceiptLine[]; totals: ReceiptTotals | null }) {
  const t = useTranslations("orderFlow.receipt");
  const locale = useLocale();
  const money = (c: number) => formatCents(c, locale);
  const minus = (c: number) => `-${money(c)}`;

  return (
    <section aria-labelledby="receipt-title" className="rounded-3xl bg-oh-ink p-4 md:p-5">
      <h2 id="receipt-title" className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
        {t("title")}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((l) => (
          <li key={l.key} data-receipt-line data-main={l.main ? "true" : "false"} className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="min-w-0 text-oh-cream [overflow-wrap:anywhere]">
              {l.label}
              {l.detail ? <span className="ml-1.5 text-sm text-oh-mute">{l.detail}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums text-oh-cream">
              {typeof l.nowCents === "number" ? (
                <>
                  <s className="mr-2 text-oh-mute">{money(l.cents)}</s>
                  <span>{money(l.nowCents)}</span>
                </>
              ) : (
                money(l.cents)
              )}
            </span>
          </li>
        ))}
      </ul>
      {totals ? (
        <dl className="m-0 mt-4 flex flex-col gap-1.5 border-t border-oh-stone pt-3 text-[15px]">
          <Row label={t("subtotal")} value={money(totals.subtotalCents)} />
          {totals.rewardCents > 0 ? <Row label={t("reward")} value={minus(totals.rewardCents)} accent /> : null}
          {totals.promoCents > 0 ? <Row label={t("promo")} value={minus(totals.promoCents)} accent /> : null}
          <Row label={t("tax")} value={money(totals.taxCents)} />
          <div className="flex items-baseline justify-between gap-3 pt-1 text-base font-semibold text-oh-cream">
            <dt>{t("total")}</dt>
            <dd data-total data-cents={totals.totalCents} className="m-0 tabular-nums">
              {money(totals.totalCents)}
            </dd>
          </div>
          {totals.creditsCents > 0 ? <Row label={t("credits")} value={minus(totals.creditsCents)} accent /> : null}
          {totals.giftCardCents > 0 ? <Row label={t("giftCard")} value={minus(totals.giftCardCents)} accent /> : null}
          {totals.mealGiftCents > 0 ? <Row label={t("mealGift")} value={minus(totals.mealGiftCents)} accent /> : null}
          {totals.amountDueCents !== totals.totalCents ? (
            <div className="flex items-baseline justify-between gap-3 border-t border-oh-stone pt-2 text-base font-semibold text-oh-cream">
              <dt>{t("due")}</dt>
              <dd className="m-0 tabular-nums">{money(totals.amountDueCents)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-oh-mute">{label}</dt>
      <dd className={`m-0 tabular-nums ${accent ? "text-oh-olive-light" : "text-oh-cream"}`}>{value}</dd>
    </div>
  );
}
