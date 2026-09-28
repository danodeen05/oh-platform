/**
 * Task D10: /store/cart, the bag. Client-side (the bag lives in this
 * browser); prices come from the shelf until the server prices the order.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CartView } from "@/components/site/store/CartView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("store");
  return { title: `${t("bag.title")} | ${t("hero.eyebrow")}` };
}

export default function CartPage() {
  return <CartView />;
}
