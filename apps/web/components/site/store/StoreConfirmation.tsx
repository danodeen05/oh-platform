"use client";

/**
 * Store order placed (Task D10, /store/confirmation/:orderNumber).
 *
 * Also Stripe's redirect return (3D Secure, wallets): it lands here with
 * ?shopOrderId=&payment_intent=, and the page asks the API to verify that
 * PaymentIntent (POST /shop/orders/:id/confirm-payment) before it says
 * anything is placed. If the savings or stock changed, the API refunds the
 * charge in full and answers 409: the page says the visitor was not charged
 * and sends them back to checkout with the bag intact.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/contexts/cart-context";
import { useGuest } from "@/contexts/guest-context";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Display, Eyebrow } from "@/components/site/Text";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { shopConfirmPayment } from "@/lib/site/orders";
import { storeErrorCode } from "@/lib/site/store";
import { PANEL, PRIMARY, SECONDARY } from "./ui";

type State = { kind: "done" } | { kind: "confirming" } | { kind: "failed"; text: string };

export function StoreConfirmation({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("store.confirmation");
  const te = useTranslations("store.errors");
  const tn = useTranslations("store.notCharged");
  const locale = useLocale();
  const search = useSearchParams();
  const api = useSiteApi();
  const member = useMemberId();
  const { guest, isLoading: guestLoading } = useGuest();
  const { clearCart } = useCart();
  const shopOrderId = search.get("shopOrderId");
  const paymentIntentId = search.get("payment_intent");
  const [state, setState] = useState<State>(shopOrderId && paymentIntentId ? { kind: "confirming" } : { kind: "done" });
  const started = useRef(false);

  useEffect(() => {
    if (!shopOrderId || !paymentIntentId || guestLoading || !member.ready || started.current) return;
    started.current = true;
    shopConfirmPayment(shopOrderId, paymentIntentId, {
      fetcher: api,
      baseUrl: SITE_API_URL,
      headers: !member.signedIn && guest?.sessionToken ? { "x-guest-session": guest.sessionToken } : undefined,
    }).then((res) => {
      if (res.ok) {
        clearCart();
        setState({ kind: "done" });
        return;
      }
      const code = storeErrorCode(res.error.code, res.status);
      if (res.error.needsReview) setState({ kind: "failed", text: te("NEEDS_REVIEW") });
      else if (res.error.refunded === true) setState({ kind: "failed", text: tn(code === "CREDIT_SHORT" || code === "GIFT_CARD_CHANGED" || code === "OUT_OF_STOCK" ? code : "GENERIC") });
      else setState({ kind: "failed", text: te(code === "CREDIT_SHORT" || code === "GIFT_CARD_CHANGED" || code === "OUT_OF_STOCK" ? "HELD" : code) });
    });
  }, [shopOrderId, paymentIntentId, guestLoading, member.ready, member.signedIn, guest?.sessionToken, api, clearCart, te, tn]);

  if (state.kind === "confirming") {
    return (
      <div className="mx-auto flex min-h-[50svh] max-w-2xl items-center justify-center gap-3 px-4 text-oh-mute" role="status" data-store-confirming>
        <span aria-hidden="true" className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
        {t("confirming")}
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-10" data-store-confirm-failed>
        <div className={PANEL}>
          <p className="m-0 text-xl font-semibold text-oh-cream">{t("failedTitle")}</p>
          <p role="alert" className="m-0 mt-3 text-base leading-relaxed text-oh-cream/85">
            {state.text}
          </p>
          <Link href={`/${locale}/store/checkout`} className={`${PRIMARY} mt-6`}>
            {t("backToCheckout")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 md:pt-14" data-store-confirmation>
      <Reveal from="scale">
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-oh-olive/30 text-oh-olive-light">
          <Icon name="check" size={30} />
        </span>
        <Eyebrow locale={locale} as="p" className="m-0 mt-6 text-oh-ember-light">
          {t("eyebrow")}
        </Eyebrow>
        <Display locale={locale} className="m-0 mt-2 text-oh-cream">
          {t("title")}
        </Display>
      </Reveal>

      <Reveal delay={80} className="mt-8 rounded-3xl border border-dashed border-oh-stone bg-oh-ink px-5 py-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("number")}</p>
        <p className="m-0 mt-1 break-all font-mono text-2xl tracking-[0.08em] text-oh-gold" data-order-number>
          {orderNumber}
        </p>
        <p className="m-0 mt-2 text-sm text-oh-mute">{t("emailNote")}</p>
      </Reveal>

      <Reveal delay={160} className={`${PANEL} mt-5`}>
        <h2 className="m-0 mb-3 text-lg font-semibold text-oh-cream">{t("nextTitle")}</h2>
        <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] leading-relaxed text-oh-cream/85">
          {(["shipStep", "pickupStep", "helpStep"] as const).map((k) => (
            <li key={k} className="flex gap-3">
              <Icon name={k === "shipStep" ? "store" : k === "pickupStep" ? "pin" : "mail"} size={18} className="mt-1 shrink-0 text-oh-ember-light" />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/${locale}/store`} className={PRIMARY} data-keep-shopping>
          {t("keepShopping")}
        </Link>
        <Link href={`/${locale}/order`} className={SECONDARY}>
          {t("order")}
        </Link>
      </div>
    </div>
  );
}
