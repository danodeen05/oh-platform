"use client";

/**
 * Top-bar navigation from 768px up (the dock hides there). Same items as the
 * dock plus the More list, from lib/site/nav.ts. The More items show inline
 * from 1280px; between 768 and 1279px a More button opens the same sheet the
 * phone uses, so nothing is ever unreachable or crowded.
 *
 * 2026-09-28 (the 68px logo and the Giving item): from 1280px the inline
 * list is measured, and if it doesn't fit beside Order in this language
 * (Spanish labels run long), it collapses to the More button the same way.
 * It expands again once there is room for the width it needed.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useChappy } from "@/components/site/chappy/ChappyLauncher";
import { Icon } from "@/components/site/icons/Icon";
import { DOCK_ITEMS, MORE_ITEMS, isNavActive, isNavLink, localizedHref, type NavLink } from "@/lib/site/nav";

/** Where the More items show inline (Tailwind's xl). */
const INLINE_FROM = "(min-width: 1280px)";

/**
 * True when the inline More items would overflow the list. Measures the list
 * while expanded (its scrollWidth is the width it needs) and, once collapsed,
 * compares that need with the room the nav leaves beside the Order pill.
 */
function useCollapsedInline(locale: string) {
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const orderRef = useRef<HTMLAnchorElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);
  const neededRef = useRef(0);

  useEffect(() => {
    const nav = navRef.current;
    const list = listRef.current;
    if (!nav || !list) return;
    const set = (next: boolean) => {
      collapsedRef.current = next;
      setCollapsed(next);
    };
    // A new language means new label widths: start expanded and measure again.
    set(false);
    neededRef.current = 0;
    const check = () => {
      if (!window.matchMedia(INLINE_FROM).matches) {
        if (collapsedRef.current) set(false);
        return;
      }
      if (!collapsedRef.current) {
        if (list.scrollWidth > list.clientWidth + 1) {
          neededRef.current = list.scrollWidth;
          set(true);
        }
        return;
      }
      // The nav's flex gap (12px) sits between the list and Order.
      const room = nav.clientWidth - (orderRef.current?.offsetWidth ?? 0) - 12;
      if (room >= neededRef.current) set(false);
    };
    let frame = requestAnimationFrame(check);
    const observer = new ResizeObserver(() => check());
    observer.observe(nav);
    // Crossing 1280px shows the inline items without resizing the nav (the
    // bar is capped at max-w-6xl), so the breakpoint itself triggers a check.
    const media = window.matchMedia(INLINE_FROM);
    const onMedia = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    };
    media.addEventListener("change", onMedia);
    void document.fonts?.ready.then(check);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", onMedia);
    };
  }, [locale]);

  // After expanding, confirm it really fits (a font swap can change widths).
  useEffect(() => {
    if (collapsed || !listRef.current || !window.matchMedia(INLINE_FROM).matches) return;
    const list = listRef.current;
    if (list.scrollWidth > list.clientWidth + 1) {
      neededRef.current = list.scrollWidth;
      collapsedRef.current = true;
      setCollapsed(true);
    }
  }, [collapsed]);

  return { navRef, listRef, orderRef, collapsed };
}

const LINK =
  "inline-flex h-11 cursor-pointer appearance-none items-center whitespace-nowrap rounded-full border-0 bg-transparent px-3 xl:px-2.5 font-[inherit] no-underline text-sm tracking-wide text-oh-cream/80 transition-colors hover:bg-oh-stone/50 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream aria-[current=page]:text-oh-cream aria-[current=page]:underline aria-[current=page]:decoration-oh-ember-light aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8";

export function DesktopNav({
  onOpenMore,
  onPreloadMore,
  moreOpen,
}: {
  onOpenMore: () => void;
  /** Starts downloading the lazily loaded More sheet (hover or focus). */
  onPreloadMore?: () => void;
  moreOpen: boolean;
}) {
  const t = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();
  const chappy = useChappy();
  const { navRef, listRef, orderRef, collapsed } = useCollapsedInline(locale);

  const order = DOCK_ITEMS.find((i): i is NavLink => isNavLink(i) && !!i.primary);
  const secondary = DOCK_ITEMS.filter((i) => !(isNavLink(i) && i.primary));

  return (
    <nav
      ref={navRef}
      data-site-desktop-nav
      data-inline-collapsed={collapsed ? "true" : undefined}
      aria-label={t("shell.mainNav")}
      className="group/nav ml-4 hidden min-w-0 flex-1 items-center gap-3 md:flex"
    >
      <ul ref={listRef} className="m-0 flex min-w-0 list-none items-center gap-0.5 p-0">
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
          <li key={item.key} className="hidden xl:block xl:group-data-[inline-collapsed=true]/nav:hidden">
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
        <li className="xl:hidden xl:group-data-[inline-collapsed=true]/nav:block">
          <button
            type="button"
            data-desktop-more-trigger
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={onOpenMore}
            onPointerEnter={onPreloadMore}
            onFocus={onPreloadMore}
            className={`${LINK} gap-1`}
          >
            {t("shell.more")}
            <Icon name="chevron" size={16} className="rotate-90" />
          </button>
        </li>
      </ul>

      {order ? (
        <Link
          ref={orderRef}
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
