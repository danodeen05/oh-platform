/**
 * Check in (Task D6): /{locale}/order/check-in?orderQrCode=...
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckInView } from "@/components/site/order/CheckInView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("afterOrder.checkIn");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

type Search = Record<string, string | string[] | undefined>;

export default async function CheckInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const code = Array.isArray(q.orderQrCode) ? q.orderQrCode[0] : q.orderQrCode;
  return <CheckInView key={code || "none"} initialCode={code || null} />;
}
