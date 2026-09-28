"use client";

/**
 * The phone dock (below 768px): four thumb-reach actions from
 * lib/site/nav.ts. Order is the one filled button (ember-deep, cream text).
 * Every target is at least 44x44; labels truncate rather than overflow in
 * long locales; the current route carries aria-current="page". Its height
 * (with the bottom safe-area inset) is the shell's `--dock-h`.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useChappy } from "@/components/site/chappy/ChappyLauncher";
import { NavGlyph } from "./NavGlyph";
import { DOCK_ITEMS, isNavActive, isNavLink, localizedHref } from "@/lib/site/nav";
import { isOrderBuildPath } from "@/lib/site/order-routes";

const ITEM =
  "group relative flex h-12 min-h-11 w-full min-w-11 cursor-pointer appearance-none flex-col border-0 font-[inherit] no-underline items-center justify-center gap-0.5 rounded-2xl px-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const QUIET = "bg-transparent text-oh-mute hover:text-oh-cream aria-[current=page]:text-oh-cream aria-expanded:text-oh-cream";
const PRIMARY = "bg-oh-ember-deep text-oh-cream shadow-[0_8px_24px_-10px] shadow-oh-ember-deep active:bg-oh-ember";
// 600, not 500: at 12px under Chromium's mobile text path, Raleway 500 left a
// visible gap after "C" in "Chappy"; kerning settings did not change it (C4 fix round 2).
const LABEL = "block max-w-full truncate text-xs font-semibold leading-tight";

export function Dock() {
  const t = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();
  const chappy = useChappy();

  // Task D5: the order flow keeps the thumb zone for its own call to action.
  if (isOrderBuildPath(pathname)) return null;

  return (
    <nav
      data-site-dock
      aria-label={t("shell.dock")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-oh-stone/70 bg-oh-ink pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      <ul className="m-0 mx-auto grid h-16 list-none py-0 max-w-md grid-cols-4 items-center gap-0.5 px-[max(0.25rem,env(safe-area-inset-left,0px))]">
        {DOCK_ITEMS.map((item) => {
          const label = t(`nav.${item.key}`);
          if (!isNavLink(item)) {
            return (
              <li key={item.key} className="min-w-0">
                <button
                  type="button"
                  data-dock-item={item.key}
                  aria-haspopup="dialog"
                  aria-expanded={chappy.isOpen}
                  onClick={() => (chappy.isOpen ? chappy.closeChappy() : chappy.openChappy())}
                  className={`${ITEM} ${QUIET}`}
                >
                  <NavGlyph glyph={item} active={chappy.isOpen} />
                  <span data-dock-label className={LABEL}>
                    {label}
                  </span>
                </button>
              </li>
            );
          }
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.key} className="min-w-0">
              <Link
                data-dock-item={item.key}
                href={localizedHref(locale, item.href)}
                aria-current={active ? "page" : undefined}
                className={`${ITEM} ${item.primary ? PRIMARY : QUIET}`}
              >
                <NavGlyph glyph={item} active={active} />
                <span data-dock-label className={LABEL}>
                  {label}
                </span>
                {active && !item.primary ? (
                  <span aria-hidden="true" className="absolute bottom-0.5 h-1 w-1 rounded-full bg-oh-ember-light" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
