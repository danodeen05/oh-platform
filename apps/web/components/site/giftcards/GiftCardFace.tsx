"use client";

/**
 * The gift card itself (Task D10): the bowl-flatlay photograph under a tint
 * for the chosen face (Linen, Night, Gold), the Oh! mark and the amount.
 * Card proportions (ISO/IEC 7810 ID-1, 85.6 x 54 mm).
 */
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { formatCents } from "@/lib/site/order-flow";
import type { GiftDesign } from "@/lib/site/store";

const TINT: Record<GiftDesign, string> = {
  classic: "bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-oh-linen)_10%,transparent)_0%,color-mix(in_oklab,var(--color-oh-charcoal)_72%,transparent)_100%)]",
  dark: "bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-oh-charcoal)_70%,transparent)_0%,color-mix(in_oklab,var(--color-oh-charcoal)_92%,transparent)_100%)]",
  gold: "bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-oh-gold)_40%,transparent)_0%,color-mix(in_oklab,var(--color-oh-clay)_88%,transparent)_100%)]",
};

export function GiftCardFace({ design, amount, className = "" }: { design: GiftDesign; amount: number | null; className?: string }) {
  const t = useTranslations("giftCards.card");
  const locale = useLocale();
  const value = amount !== null ? formatCents(amount * 100, locale) : null;
  return (
    <div
      role={value ? "img" : undefined}
      aria-label={value ? t("faceAlt", { amount: value }) : undefined}
      aria-hidden={value ? undefined : true}
      data-gift-face={design}
      className={`relative isolate aspect-[1.586] overflow-hidden rounded-[1.25rem] shadow-[0_28px_60px_-28px_rgba(0,0,0,0.85)] ring-1 ring-oh-cream/10 ${className}`}
    >
      <SitePicture image="bowl-flatlay" sizes="(min-width: 768px) 420px, 90vw" alt="" className="absolute inset-0 -z-20 block [&>img]:h-full [&>img]:w-full [&>img]:object-cover" />
      <div aria-hidden="true" className={`absolute inset-0 -z-10 transition-[background] duration-500 motion-reduce:transition-none ${TINT[design]}`} />
      <div aria-hidden="true" className="flex h-full flex-col justify-between p-[6%] text-oh-cream">
        <div className="flex items-start justify-between gap-3">
          <Image src="/Oh_Logo_Mark_Light.png" alt="" width={48} height={48} className="h-[clamp(2rem,9vw,3rem)] w-auto object-contain" />
          <span className="text-[clamp(0.65rem,2.6vw,0.8rem)] font-semibold uppercase tracking-[0.2em] text-oh-cream/90">{t("label")}</span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="min-w-0 truncate text-[clamp(0.7rem,2.8vw,0.85rem)] text-oh-cream/85">{t("brand")}</span>
          {value ? <span className="shrink-0 font-display text-[clamp(1.75rem,8vw,2.75rem)] leading-none tabular-nums">{value}</span> : null}
        </div>
      </div>
    </div>
  );
}
