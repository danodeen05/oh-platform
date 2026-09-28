"use client";

/** Sign in to go on (E1's working card, now native, Task E2). */
import { useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { CardFrame, Eyebrow, PrimaryButton, useCardContext } from "./CardKit";

export function SignInCard() {
  const t = useTranslations("chappyWeb");
  const { onSignIn } = useCardContext();
  return (
    <CardFrame type="sign-in" label={t("cards.signIn.label")}>
      <div className="flex items-start gap-3 p-4">
        <Icon name="user" size={24} className="mt-0.5 shrink-0 text-oh-ember-light" />
        <div className="min-w-0 flex-1">
          <Eyebrow>{t("cards.signIn.title")}</Eyebrow>
          <p className="m-0 mt-1 text-[0.95rem] leading-snug text-oh-cream/85">{t("cards.signIn.body")}</p>
          <PrimaryButton onClick={onSignIn} full={false} className="mt-3">
            {t("signIn")}
          </PrimaryButton>
        </div>
      </div>
    </CardFrame>
  );
}
