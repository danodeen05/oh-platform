"use client";

/**
 * Guests sign in to order (owner decision). Signed-out visitors browse the
 * bowl builder freely; from the arrival step on, the step shows this panel
 * instead. The draft stays in sessionStorage, and the Clerk modal returns
 * to the same step, so nothing is lost.
 */
import { SignInTrigger, SignUpTrigger } from "@/components/site/auth/AuthTriggers";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { CTA_CLASS } from "./StepSheet";

export function SignInGate({ returnTo }: { returnTo: string }) {
  const t = useTranslations("orderFlow.signIn");
  return (
    <div data-order-signin className="flex flex-col gap-5 rounded-3xl bg-oh-ink p-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-oh-stone text-oh-cream">
        <Icon name="user" size={24} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-xl font-semibold text-oh-cream">{t("title")}</h2>
        <p className="m-0 text-[15px] leading-relaxed text-oh-mute">{t("body")}</p>
      </div>
      <SignInTrigger returnTo={returnTo}>
        <button type="button" data-order-signin-button className={`${CTA_CLASS} w-full`}>
          {t("cta")}
        </button>
      </SignInTrigger>
      <SignUpTrigger returnTo={returnTo}>
        <button
          type="button"
          className="min-h-11 cursor-pointer appearance-none border-0 bg-transparent p-0 font-[inherit] text-[15px] text-oh-cream underline decoration-oh-ember-light decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        >
          {t("create")}
        </button>
      </SignUpTrigger>
    </div>
  );
}
