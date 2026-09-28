"use client";

/**
 * Top-bar navigation from 768px up (the dock hides there). Same items as the
 * dock plus the More list, from lib/site/nav.ts. The More items show inline
 * from 1280px; between 768 and 1279px a More button opens the same sheet the
 * phone uses, so nothing is ever unreachable or crowded.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useChappy } from "@/components/site/chappy/ChappyLauncher";
import { Icon } from "@/components/site/icons/Icon";
import { DOCK_ITEMS, MORE_ITEMS, isNavActive, isNavLink, localizedHref, type NavLink } from "@/lib/site/nav";

const LINK =
  "inline-flex h-11 cursor-pointer appearance-none items-center whitespace-nowrap rounded-full border-0 bg-transparent px-3 font-[inherit] no-underline text-sm tracking-wide text-oh-cream/80 transition-colors hover:bg-oh-stone/50 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream aria-[current=page]:text-oh-cream aria-[current=page]:underline aria-[current=page]:decoration-oh-ember-light aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8";

export function DesktopNav({ onOpenMore, moreOpen }: { onOpenMore: () => void; moreOpen: boolean }) {
  const t = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();
  const chappy = useChappy();

  const order = DOCK_ITEMS.find((i): i is NavLink => isNavLink(i) && !!i.primary);
  const secondary = DOCK_ITEMS.filter((i) => !(isNavLink(i) && i.primary));

  return (
    <nav data-site-desktop-nav aria-label={t("shell.mainNav")} className="ml-4 hidden min-w-0 flex-1 items-center md:flex">
      <ul className="m-0 flex min-w-0 list-none items-center gap-0.5 p-0">
        {secondary.map((item) =>
          isNavLink(item) ? (
            <li key={item.key}>
              <Link
                data-nav-item={item.key}
                href={localizedHref(locale, item.href)}
                aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
                className={LINK}
              >
                {t(`nav.${item.key}`)}
              </Link>
            </li>
          ) : (
            <li key={item.key}>
              <button
                type="button"
                data-nav-item={item.key}
                aria-haspopup="dialog"
                aria-expanded={chappy.isOpen}
                onClick={() => (chappy.isOpen ? chappy.closeChappy() : chappy.openChappy())}
                className={LINK}
              >
                {t(`nav.${item.key}`)}
              </button>
            </li>
          ),
        )}
        {MORE_ITEMS.map((item) => (
          <li key={item.key} className="hidden xl:block">
            <Link
              data-nav-item={item.key}
              href={localizedHref(locale, item.href)}
              aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
              className={LINK}
            >
              {t(`nav.${item.key}`)}
            </Link>
          </li>
        ))}
        <li className="xl:hidden">
          <button
            type="button"
            data-desktop-more-trigger
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={onOpenMore}
            className={`${LINK} gap-1`}
          >
            {t("shell.more")}
            <Icon name="chevron" size={16} className="rotate-90" />
          </button>
        </li>
      </ul>

      {order ? (
        <Link
          data-nav-item={order.key}
          href={localizedHref(locale, order.href)}
          aria-current={isNavActive(pathname, order.href) ? "page" : undefined}
          className="ml-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-oh-ember-deep no-underline px-5 text-sm font-semibold tracking-wide text-oh-cream shadow-[0_6px_20px_-8px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        >
          {"icon" in order ? <Icon name={order.icon} size={20} /> : null}
          {t(`nav.${order.key}`)}
        </Link>
      ) : null}
    </nav>
  );
}
