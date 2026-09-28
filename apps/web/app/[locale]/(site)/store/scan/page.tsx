/**
 * Task D10: /store/scan, for the shelf tags in the restaurant.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScanView } from "@/components/site/store/ScanView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("store");
  return { title: `${t("scan.meta")} | ${t("hero.eyebrow")}` };
}

export default function ScanPage() {
  return <ScanView />;
}
