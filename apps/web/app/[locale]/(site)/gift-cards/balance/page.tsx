/**
 * Task D10: /gift-cards/balance.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GiftBalance } from "@/components/site/giftcards/GiftBalance";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("giftCards");
  return { title: `${t("balance.meta")} | ${t("hero.eyebrow")}` };
}

export default function GiftBalancePage() {
  return (
    <Suspense>
      <GiftBalance />
    </Suspense>
  );
}
