/**
 * Order confirmation (Task D6): /{locale}/order/confirmation?orderId=...
 * The Stripe return params, the group code and the pay step's `podFrom`
 * are passed to the client view, which verifies the payment (idempotent).
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmationView } from "@/components/site/order/ConfirmationView";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("afterOrder.confirmation");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  return (
    <ConfirmationView
      key={one(q.orderId) || "none"}
      orderId={one(q.orderId)}
      orderNumber={one(q.orderNumber)}
      totalParam={one(q.total)}
      paid={one(q.paid) === "true"}
      groupCode={one(q.groupCode)}
      clientSecret={one(q.payment_intent_client_secret)}
      redirectStatus={one(q.redirect_status)}
      podFrom={one(q.podFrom)}
    />
  );
}
