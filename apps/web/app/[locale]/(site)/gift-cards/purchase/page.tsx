/**
 * Task D10: /gift-cards/purchase. Amount (whole dollars, $10 to $500), who
 * it's for, pay. No promo codes and no store credit on gift cards.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GiftPurchase } from "@/components/site/giftcards/GiftPurchase";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("giftCards");
  return { title: `${t("purchase.meta")} | ${t("hero.eyebrow")}` };
}

export default function GiftPurchasePage() {
  return (
    <Suspense>
      <GiftPurchase />
    </Suspense>
  );
}
