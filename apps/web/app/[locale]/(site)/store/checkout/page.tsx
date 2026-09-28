/**
 * Task D10: /store/checkout. The order is created and priced by the API
 * (POST /shop/orders) and paid through a server-priced PaymentIntent; see
 * components/site/store/Checkout.tsx. `?pickup=1` (from a shelf tag) starts
 * on in-restaurant pickup.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Checkout } from "@/components/site/store/Checkout";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("store");
  return { title: `${t("checkout.title")} | ${t("hero.eyebrow")}` };
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ pickup?: string }> }) {
  const { pickup } = await searchParams;
  return <Checkout initialFulfillment={pickup === "1" ? "IN_STORE_PICKUP" : "SHIPPING"} />;
}
