/**
 * Task D8: /member/orders (moved from (legacy) and rebuilt). The history is
 * the member's own (GET /users/:id/orders, requireSelf), so it loads on the
 * client in OrdersHistory.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrdersHistory } from "@/components/site/member/OrdersHistory";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("passport.orders");
  return { title: t("title") };
}

export default function MemberOrdersPage() {
  return <OrdersHistory />;
}
