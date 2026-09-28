"use client";

/**
 * Nothing to pay (Task E2): credit, a reward or a gift card cover the whole
 * order. The customer still taps: "Place order" asks the API to verify the
 * zero balance itself (confirm-payment with no PaymentIntent) and mark the
 * order PAID. One call at a time; a network failure can be retried.
 */
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { confirmPayment } from "@/lib/site/orders";
import { CardFrame, Eyebrow, PrimaryButton, money, useCardContext } from "./CardKit";
import { PayMeta } from "./PayCard";
import type { ConfirmZeroCardData } from "./types";

export function ConfirmZeroCard({ card }: { card: ConfirmZeroCardData }) {
  const t = useTranslations("chappyWeb.cards");
  const { api, onPaid, locale, cjk } = useCardContext();
  const [phase, setPhase] = useState<"ready" | "placing" | "paid" | "failed">("ready");
  const inFlight = useRef(false);

  const place = async () => {
    if (inFlight.current || phase === "paid") return;
    inFlight.current = true;
    setPhase("placing");
    try {
      const res = await confirmPayment(card.orderId, null, { fetcher: api });
      if (res.ok) {
        setPhase("paid");
        onPaid(res.data);
      } else setPhase("failed");
    } finally {
      inFlight.current = false;
    }
  };

  const paid = phase === "paid";
  return (
    <CardFrame type="confirm-zero" label={t("confirmZero.label")}>
      <div className="flex items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <Eyebrow>{paid ? t("pay.paidTitle") : t("confirmZero.title")}</Eyebrow>
          <p className={`${cjk ? "font-display-cjk" : "font-display"} m-0 mt-1 text-[2.5rem] font-normal leading-none tabular-nums text-oh-cream`}>{money(0, locale)}</p>
          <p className="m-0 mt-2 text-sm leading-snug text-oh-cream/80">{t("confirmZero.body")}</p>
          <PayMeta kitchenNumber={card.kitchenNumber} pod={card.pod} />
        </div>
        {paid ? (
          <span className="chappy-paid-mark mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oh-olive text-oh-cream">
            <Icon name="check" size={26} />
          </span>
        ) : null}
      </div>
      {paid ? null : (
        <div className="px-4 pb-4">
          {phase === "failed" ? (
            <p role="alert" className="m-0 mb-3 flex gap-2 text-[0.95rem] leading-snug text-oh-ember-light">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <span>{t("pay.unavailable")}</span>
            </p>
          ) : null}
          <PrimaryButton data-confirm-zero onClick={() => void place()} disabled={phase === "placing"} busy={phase === "placing"}>
            {phase === "placing" ? t("confirmZero.placing") : t("confirmZero.place")}
          </PrimaryButton>
        </div>
      )}
    </CardFrame>
  );
}
