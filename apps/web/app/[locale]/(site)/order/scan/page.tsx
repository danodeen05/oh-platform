/**
 * Confirm at the pod (Task D6): /{locale}/order/scan?orderQrCode=...
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScanView } from "@/components/site/order/ScanView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("afterOrder.scan");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

type Search = Record<string, string | string[] | undefined>;

export default async function ScanPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const code = Array.isArray(q.orderQrCode) ? q.orderQrCode[0] : q.orderQrCode;
  return <ScanView key={code || "none"} initialCode={code || null} />;
}
