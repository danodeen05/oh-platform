/**
 * Task D10: /store/confirmation/:orderNumber. Also the Stripe redirect
 * return, which is verified by the API before anything is shown as placed.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StoreConfirmation } from "@/components/site/store/StoreConfirmation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("store");
  return { title: `${t("confirmation.meta")} | ${t("hero.eyebrow")}` };
}

export default async function StoreConfirmationPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return (
    <Suspense>
      <StoreConfirmation orderNumber={decodeURIComponent(orderNumber)} />
    </Suspense>
  );
}
