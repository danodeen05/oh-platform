"use client";

/**
 * Where the order is (Task E2): the stage along the order status page's own
 * steps (PHONE_STAGES from @oh/floor-plan, the same six the status page and
 * the plan's phone show), the kitchen number, the pod and a link to the
 * full status page. Shown for get_order_status and right after a pay card
 * settles.
 */
import { PHONE_STAGES } from "@oh/floor-plan/stages";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Icon } from "@/components/site/icons/Icon";
import { CardFrame, Eyebrow, podText } from "./CardKit";
import type { OrderStatusCardData } from "./types";

export function OrderTrackerCard({ card }: { card: OrderStatusCardData }) {
  const t = useTranslations("chappyWeb.cards.orderStatus");
  const stages = PHONE_STAGES as readonly string[];
  const index = card.stage ? stages.indexOf(card.stage) : -1;
  const label = card.stage && (index >= 0 || card.stage === "UNPAID") ? t(`stages.${card.stage}`) : card.status === "CANCELLED" ? t("stages.CANCELLED") : t("stages.OTHER");

  return (
    <CardFrame type="order-status" label={t("label")}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow>{card.kitchenNumber ? t("title", { number: card.kitchenNumber }) : t("titleNoNumber")}</Eyebrow>
            <p data-order-stage={card.stage ?? card.status} className="m-0 mt-1 text-xl font-semibold leading-snug text-oh-cream">
              {label}
            </p>
          </div>
          {card.pod ? (
            <p className="m-0 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-solid border-oh-stone px-3 py-1.5 text-sm font-semibold tabular-nums text-oh-cream">
              <Icon name="pod" size={16} className="text-oh-ember-light" />
              {t("pod", { pod: podText(card.pod) })}
            </p>
          ) : null}
        </div>

        {index >= 0 ? (
          <div className="mt-4">
            <ol className="m-0 grid list-none grid-cols-6 gap-1.5 p-0" aria-label={t("progress", { step: index + 1, total: stages.length })}>
              {stages.map((s, i) => (
                <li
                  key={s}
                  className={`h-1.5 rounded-full ${i < index ? "bg-oh-ember" : i === index ? "chappy-stage-now bg-oh-ember-light" : "bg-oh-stone"}`}
                  aria-current={i === index ? "step" : undefined}
                >
                  <span className="sr-only">{t(`stages.${s}`)}</span>
                </li>
              ))}
            </ol>
            <p className="m-0 mt-2 flex justify-between gap-2 text-xs text-oh-mute" aria-hidden="true">
              <span>{t(`stages.${stages[0]}`)}</span>
              <span>{t(`stages.${stages[stages.length - 1]}`)}</span>
            </p>
          </div>
        ) : null}

        {card.statusPath ? (
          <Link
            href={card.statusPath}
            prefetch={false}
            data-order-status-link
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-solid border-oh-stone px-4 text-sm font-semibold text-oh-cream no-underline transition-colors hover:border-oh-ash hover:bg-oh-stone/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("open")}
            <Icon name="arrow" size={16} className="text-oh-ember-light" />
          </Link>
        ) : null}
      </div>
    </CardFrame>
  );
}
