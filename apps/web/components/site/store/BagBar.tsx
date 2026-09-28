"use client";

/**
 * The bag bar (Task D10): pinned above the phone dock on the store pages
 * while the bag has something in it. One tap to the bag. The amount is the
 * items' shelf prices; shipping and tax come from the server at checkout.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/contexts/cart-context";
import { Icon } from "@/components/site/icons/Icon";
import { formatCents } from "@/lib/site/order-flow";

export function BagBar() {
  const t = useTranslations("store.bag");
  const locale = useLocale();
  const { itemCount, subtotalCents } = useCart();
  if (itemCount === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[var(--dock-h)] z-30 px-4 pb-3 md:pb-6">
      <Link
        href={`/${locale}/store/cart`}
        data-bag-bar
        className="pointer-events-auto mx-auto flex min-h-14 w-full max-w-md items-center gap-3 rounded-full bg-oh-cream py-2 pl-3 pr-5 text-oh-charcoal no-underline shadow-[0_16px_36px_-14px_rgba(0,0,0,0.75)] transition-transform duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ember-deep motion-reduce:transition-none"
      >
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep text-oh-cream">
          <Icon name="store" size={20} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px]" aria-live="polite">
          {t("summary", { count: itemCount, amount: formatCents(subtotalCents, locale) })}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold">
          {t("view")}
          <Icon name="arrow" size={18} />
        </span>
      </Link>
    </div>
  );
}
