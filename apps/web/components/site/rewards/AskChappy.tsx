"use client";

/**
 * Task D7: the page's last word. Opens Chappy (useChappy, from the site
 * shell) with a translated question already typed; Chappy never moves
 * money without a human tap, so this only starts a conversation.
 */
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useChappy } from "@/components/site/chappy/ChappyLauncher";
import { CHAPPY_AVATAR } from "@/lib/site/nav";

export function AskChappy() {
  const t = useTranslations("rewards.chappy");
  const chappy = useChappy();
  return (
    <div className="flex flex-col items-start gap-5 rounded-[2rem] border border-oh-stone/70 bg-oh-ink p-6 sm:flex-row sm:items-center md:p-8">
      <Image src={CHAPPY_AVATAR} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-2xl font-semibold leading-tight text-oh-cream">{t("title")}</h2>
        <p className="m-0 mt-1 text-base text-oh-cream/75">{t("body")}</p>
      </div>
      <button
        type="button"
        data-rewards-chappy
        aria-haspopup="dialog"
        onClick={() => chappy.openChappy(t("prompt"))}
        className="inline-flex min-h-12 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border border-oh-cream/35 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
      >
        {t("cta")}
      </button>
    </div>
  );
}
