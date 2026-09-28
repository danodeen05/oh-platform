"use client";

/**
 * "Payment received, finishing" (Task D10 fix round 1), shared by the store
 * checkout and the gift-card purchase. Stripe has said the payment
 * succeeded, so this view never offers to pay again: it shows the finish
 * in progress, then (after the automatic retries) Retry with the same
 * PaymentIntent, and a way to reach a person (Chappy or the contact page).
 */
import { useLocale, useTranslations } from "next-intl";
import { useChappy } from "@/components/site/chappy/ChappyLauncher";
import { Icon } from "@/components/site/icons/Icon";
import { Title } from "@/components/site/Text";
import { PANEL, PRIMARY, SECONDARY } from "./ui";

export type ReceivedState = "finishing" | "stuck" | "review";

export function PaymentReceived({
  state,
  finishingText,
  stuckText,
  reviewText,
  reference,
  onRetry,
}: {
  state: ReceivedState;
  finishingText: string;
  stuckText: string;
  reviewText?: string;
  reference?: { label: string; value: string } | null;
  /** Omitted when there is nothing left to retry (the server finishes on its own). */
  onRetry?: (() => void) | null;
}) {
  const t = useTranslations("store.checkout.received");
  const locale = useLocale();
  const chappy = useChappy();
  return (
    <div data-payment-received={state} className="mx-auto max-w-2xl px-4 pb-16 pt-8 md:pt-14">
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-oh-olive/30 text-oh-olive-light">
        <Icon name="check" size={26} />
      </span>
      <Title locale={locale} as="h1" className="m-0 mt-5 text-oh-cream">
        {t("title")}
      </Title>
      <div className={`${PANEL} mt-6`}>
        {reference ? (
          <>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{reference.label}</p>
            <p className="m-0 mb-4 mt-1 break-all font-mono text-xl tracking-[0.08em] text-oh-gold">{reference.value}</p>
          </>
        ) : null}
        {state === "finishing" ? (
          <p role="status" className="m-0 flex items-center gap-3 text-base text-oh-cream/85">
            <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
            {finishingText}
          </p>
        ) : (
          <p role="alert" className="m-0 text-base leading-relaxed text-oh-cream/85" data-received-note>
            {state === "review" && reviewText ? reviewText : stuckText}
          </p>
        )}
      </div>
      {state !== "finishing" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {state === "stuck" && onRetry ? (
            <button type="button" onClick={onRetry} className={PRIMARY} data-finish-retry>
              {t("retry")}
            </button>
          ) : null}
          <button type="button" onClick={() => chappy.openChappy()} className={SECONDARY}>
            {t("askChappy")}
          </button>
          <a href={`/${locale}/contact`} className={SECONDARY}>
            {t("contact")}
          </a>
        </div>
      ) : null}
    </div>
  );
}
