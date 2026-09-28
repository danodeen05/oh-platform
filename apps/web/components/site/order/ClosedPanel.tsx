"use client";

/**
 * The closed states (Task D5): online ordering switched off by the owner
 * (the dine-in flag, POST /orders answers 403 DINE_IN_DISABLED), or outside
 * ordering hours (no arrival times left today).
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { SITE_IMAGES } from "@/lib/site/images";

export function ClosedPanel({ variant = "dineIn" }: { variant?: "dineIn" | "hours" }) {
  const t = useTranslations("orderFlow.closed");
  const tRoot = useTranslations();
  const locale = useLocale();
  return (
    <div data-order-closed={variant} className="overflow-hidden rounded-3xl bg-oh-ink">
      <div className="relative aspect-[16/9] w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
        <SitePicture image="storefront-dusk" sizes="(min-width: 768px) 640px, 100vw" alt={tRoot(SITE_IMAGES["storefront-dusk"].alt)} className="block h-full w-full" />
      </div>
      <div className="flex flex-col gap-3 p-5">
        <h2 className="m-0 text-xl font-semibold text-oh-cream">{variant === "hours" ? t("hoursTitle") : t("title")}</h2>
        <p className="m-0 text-[15px] leading-relaxed text-oh-mute">{variant === "hours" ? t("hoursBody") : t("body")}</p>
        <Link
          href={`/${locale}/locations`}
          className="mt-1 inline-flex min-h-11 items-center self-start rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline hover:border-oh-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
