/**
 * Order status (Task D6): /{locale}/order/status?orderQrCode=...
 *
 * Also the business plan's phone demo (binding contract, see
 * components/site/order/StatusView.tsx and lib/site/order-status.ts):
 *   ?orderQrCode=DEMO-PLAN.<STAGE>&embed=1&demoSync=parent
 * `embed=1` is read by middleware (x-embed), which makes the (site) shell
 * render bare; this page reads it too, to tighten its own chrome.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StatusView } from "@/components/site/order/StatusView";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("afterOrder.status");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function OrderStatusPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const code = one(q.orderQrCode);
  return (
    <StatusView
      key={code || "none"}
      code={code}
      embedded={one(q.embed) === "1"}
      followParent={one(q.demoSync) === "parent"}
      demoStage={one(q.demoStage)}
      podFrom={one(q.podFrom)}
      podNone={one(q.podNone) === "1"}
    />
  );
}
