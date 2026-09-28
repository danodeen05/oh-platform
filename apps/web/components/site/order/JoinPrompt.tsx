"use client";

/**
 * Signed out on the status page (Task D6): "Earn rewards on this order".
 * Creating an account (or signing in) from here links this order to it:
 * the order code is kept as `pendingOrderLink`, and `usePendingOrderLink`
 * finishes the link when the guest comes back signed in (same key and
 * route as the legacy page, POST /orders/link-to-account).
 */
import { SignInTrigger, SignUpTrigger } from "@/components/site/auth/AuthTriggers";
import { useLocale, useTranslations } from "next-intl";
import { Eyebrow, Title } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { PRIMARY } from "./PodCard";

export function JoinPrompt({ orderId, orderQrCode, orderNumber, returnTo }: { orderId: string; orderQrCode: string; orderNumber: string; returnTo: string }) {
  const t = useTranslations("afterOrder.status.join");
  const locale = useLocale();
  const remember = () => {
    try {
      localStorage.setItem("pendingOrderLink", JSON.stringify({ orderQrCode, orderId }));
    } catch {
      /* storage blocked: the order can still be linked from the account page */
    }
  };
  return (
    <section data-join-prompt data-status-section aria-labelledby="join-title" className="overflow-hidden rounded-[1.75rem] bg-oh-linen px-5 py-6 text-oh-charcoal">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oh-ember-deep text-oh-cream">
          <Icon name="seal" size={22} />
        </span>
        <Eyebrow locale={locale} className="text-oh-ember-deep">
          {t("eyebrow")}
        </Eyebrow>
      </div>
      <Title id="join-title" locale={locale} as="h2" className="m-0 mt-4 !text-[1.75rem] text-oh-charcoal">
        {t("title")}
      </Title>
      <p className="m-0 mt-2 text-[15px] leading-relaxed text-oh-charcoal/80">{t("lede", { number: orderNumber })}</p>
      <ul className="m-0 mt-4 list-none space-y-2 p-0">
        {(["one", "two", "three"] as const).map((k) => (
          <li key={k} className="flex gap-2.5 text-[15px] leading-relaxed">
            <Icon name="check" size={18} className="mt-0.5 shrink-0 text-oh-ember-deep" />
            <span className="min-w-0">{t(`benefits.${k}`)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-2">
        <SignUpTrigger returnTo={returnTo}>
          <button type="button" data-join-create onClick={remember} className={PRIMARY}>
            {t("create")}
          </button>
        </SignUpTrigger>
        <SignInTrigger returnTo={returnTo}>
          <button
            type="button"
            onClick={remember}
            className="min-h-12 cursor-pointer appearance-none rounded-full border-0 bg-transparent px-5 font-[inherit] text-[15px] font-semibold text-oh-charcoal underline decoration-oh-ember-deep decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-charcoal"
          >
            {t("signIn")}
          </button>
        </SignInTrigger>
      </div>
    </section>
  );
}
