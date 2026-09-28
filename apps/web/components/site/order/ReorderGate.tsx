"use client";

/**
 * "Order again" (Task D6, carried from D8): /{locale}/order?reorder=<orderId>.
 * Reads the past order with the member's session (GET /orders/:id), and
 * only when it's the signed-in member's own order (the full view carries
 * its `userId`; anyone else gets the safe view, which doesn't) sends them
 * on to that order's location, where the order flow rebuilds the cart from
 * it (OrderFlow, `reorderId`) and re-prices it. Someone else's order id, or
 * one that doesn't exist, gives nothing but a short note.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { useMemberId, useSiteApi, SITE_API_URL } from "@/lib/site/api";
import { SignInGate } from "./SignInGate";
import { Spinner } from "./StepSheet";

export function ReorderGate({ orderId }: { orderId: string }) {
  const t = useTranslations("afterOrder.reorder");
  const locale = useLocale();
  const router = useRouter();
  const api = useSiteApi();
  const member = useMemberId();
  const [state, setState] = useState<"loading" | "missing">("loading");

  useEffect(() => {
    if (!member.ready || !member.signedIn || !member.userId) return;
    let live = true;
    (async () => {
      const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(orderId)}`).catch(() => null);
      const order = res && res.ok ? await res.json().catch(() => null) : null;
      if (!live) return;
      if (order && order.userId && order.userId === member.userId && order.locationId) {
        router.replace(`/${locale}/order/location/${encodeURIComponent(order.locationId)}?reorderId=${encodeURIComponent(orderId)}`);
        return;
      }
      setState("missing");
    })();
    return () => {
      live = false;
    };
  }, [member.ready, member.signedIn, member.userId, orderId, api, router, locale]);

  if (member.ready && !member.signedIn) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <SignInGate returnTo={`/${locale}/order?reorder=${encodeURIComponent(orderId)}`} />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4">
      {state === "missing" ? (
        <p data-reorder-missing role="status" className="m-0 flex items-start gap-2.5 rounded-2xl bg-oh-ink px-4 py-3 text-[15px] leading-relaxed text-oh-cream ring-1 ring-oh-stone">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
          {t("missing")}
        </p>
      ) : (
        <p data-reorder-loading role="status" className="m-0 flex items-center gap-2.5 text-[15px] text-oh-mute">
          <Spinner />
          {t("loading")}
        </p>
      )}
    </div>
  );
}
