/**
 * The pod page (Task D6): /{locale}/pod?qr=POD-... (the QR code on a pod's table).
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PodView } from "@/components/site/order/PodView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("afterOrder.pod");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

type Search = Record<string, string | string[] | undefined>;

export default async function PodPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const qr = Array.isArray(q.qr) ? q.qr[0] : q.qr;
  return <PodView key={qr || "none"} qr={qr || null} />;
}
