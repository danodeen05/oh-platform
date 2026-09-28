/**
 * Task D10: /store/item/:qrCode, the product behind a shelf tag.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { InStoreItem } from "@/components/site/store/InStoreItem";
import { PANEL, PRIMARY, SECONDARY } from "@/components/site/store/ui";
import { getProductByQr } from "@/lib/site/store-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("store");
  return { title: `${t("item.eyebrow")} | ${t("hero.eyebrow")}` };
}

export default async function InStoreItemPage({ params }: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await params;
  const locale = await getLocale();
  const t = await getTranslations("store");
  const product = await getProductByQr(decodeURIComponent(qrCode));
  if (product && product !== "missing") return <InStoreItem product={product} />;
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-10" data-store-item-missing>
      <div className={PANEL}>
        <h1 className="m-0 text-2xl font-semibold text-oh-cream">{product === "missing" ? t("item.notFoundTitle") : t("loadError")}</h1>
        {product === "missing" ? <p className="m-0 mt-2 text-base text-oh-cream/80">{t("item.notFoundBody")}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/${locale}/store/scan`} className={PRIMARY}>
            {t("item.scanAgain")}
          </Link>
          <Link href={`/${locale}/store`} className={SECONDARY}>
            {t("scan.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
