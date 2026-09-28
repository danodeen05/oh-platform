"use client";

/**
 * The visitor's in-progress order, as a small pill just above the dock on
 * phones (bottom right on desktop). Same data source as the legacy
 * ActiveOrderBanner (lib/site/active-order.ts). Hidden on the order flow
 * pages, which already show the order.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { activeOrderStatusKey, isOrderFlowPath, useActiveOrder } from "@/lib/site/active-order";
import { isOrderBuildPath } from "@/lib/site/order-routes";

export function ActiveOrderPill() {
  const t = useTranslations("site.shell");
  const locale = useLocale();
  const pathname = usePathname();
  const order = useActiveOrder();

  // Task D5: also off the building and paying steps, where the CTA bar owns the bottom edge.
  if (!order || isOrderFlowPath(pathname) || (isOrderBuildPath(pathname) && !/\/order\/?$/.test(pathname || ""))) return null;

  const title = order.kitchenOrderNumber ? t("activeOrder", { number: order.kitchenOrderNumber }) : t("activeOrderNoNumber");
  const status = t(`orderStatus.${activeOrderStatusKey(order)}`);

  return (
    <Link
      data-site-active-order
      href={`/${locale}/order/status?orderQrCode=${encodeURIComponent(order.orderQrCode)}`}
      className="fixed bottom-[calc(var(--dock-h)+0.75rem)] no-underline left-1/2 z-30 flex min-h-11 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full bg-oh-cream py-2 pl-3 pr-4 text-sm text-oh-charcoal shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ember-deep md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
    >
      <span aria-hidden="true" className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-oh-ember opacity-60 motion-reduce:animate-none" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-oh-ember-deep" />
      </span>
      <span className="truncate font-semibold">{title}</span>
      <span aria-hidden="true" className="text-oh-ash">
        /
      </span>
      <span className="truncate">{status}</span>
      <span className="sr-only">{t("viewOrder")}</span>
    </Link>
  );
}
