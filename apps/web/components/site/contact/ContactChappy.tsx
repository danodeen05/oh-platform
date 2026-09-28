"use client";

/** Task D11: opens Chappy from the contact page with a question already typed. Chappy only talks; it never moves money on its own. */
import { useTranslations } from "next-intl";
import { useChappy } from "@/components/site/chappy/ChappyLauncher";

export function ContactChappy() {
  const t = useTranslations("contactPage.other.chappy");
  const chappy = useChappy();
  return (
    <button
      type="button"
      data-contact-chappy
      aria-haspopup="dialog"
      onClick={() => chappy.openChappy(t("prompt"))}
      className="mt-3 inline-flex min-h-11 cursor-pointer appearance-none items-center justify-center rounded-full border border-oh-cream/35 bg-transparent px-5 font-[inherit] text-base font-semibold text-oh-cream transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
    >
      {t("cta")}
    </button>
  );
}
