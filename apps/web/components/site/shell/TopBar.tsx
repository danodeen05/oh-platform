"use client";

/**
 * Slim top bar (at most 56px tall, plus the top safe-area inset). It sits on
 * the page's own background at the top and picks up a translucent charcoal
 * background, a blur and a hairline once the page scrolls.
 *
 * Phones: logo, account, and the More trigger (the dock carries the rest).
 * 768px and up: logo, the desktop nav, the language menu and account.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { AccountButton } from "./AccountButton";
import { DesktopNav } from "./DesktopNav";
import { LocaleSwitch } from "./LocaleSwitch";

// Task G2a: the More sheet (and framer-motion, which only the sheet uses in
// the shell, about 42 KB gzipped) loads on first open instead of with every
// page. Intent (hover, touch, focus on a trigger) starts the download early.
const loadMoreSheet = () => import("./MoreSheet");
const MoreSheet = dynamic(() => loadMoreSheet().then((m) => m.MoreSheet), { ssr: false });

const SCROLLED_AT = 8;

export function TopBar() {
  const t = useTranslations("site.shell");
  const locale = useLocale();
  const [scrolled, setScrolled] = useState(false);
  // Marks the bar interactive (tests wait for it before the first tap).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [moreOpen, setMoreOpen] = useState(false);
  // Mounted on first open and kept, so its close animation still plays.
  const [moreMounted, setMoreMounted] = useState(false);
  const openMore = () => {
    setMoreMounted(true);
    setMoreOpen(true);
  };
  const preloadMore = () => void loadMoreSheet();

  useEffect(() => {
    const onScroll = () => {
      // The More sheet pins <body> (iOS scroll lock), which zeroes scrollY;
      // keep the bar's state as it was while that's in effect.
      if (document.body.style.position === "fixed") return;
      setScrolled(window.scrollY > SCROLLED_AT);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        data-site-topbar
        data-scrolled={scrolled ? "true" : "false"}
        data-hydrated={hydrated ? "true" : undefined}
        className="sticky top-0 z-40 pt-[env(safe-area-inset-top,0px)] transition-[background-color,box-shadow,backdrop-filter] duration-300 data-[scrolled=true]:shadow-[inset_0_-1px_0_var(--color-oh-stone)] data-[scrolled=true]:bg-oh-charcoal/85 data-[scrolled=true]:backdrop-blur-md"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] md:pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <Link
            href={`/${locale}`}
            aria-label={t("home")}
            className="-ml-1 flex h-11 w-11 shrink-0 no-underline items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- G2a: a pre-sized static file; next/image's client code cost every page 5 KB of JS */}
            <img src="/brand/oh-mark-light-104.webp" alt="" width={34} height={34} decoding="async" className="h-[34px] w-[34px] object-contain" />
          </Link>

          <DesktopNav onOpenMore={openMore} onPreloadMore={preloadMore} moreOpen={moreOpen} />

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <div className="hidden md:block">
              <LocaleSwitch variant="compact" />
            </div>
            <AccountButton />
            <button
              type="button"
              data-site-more-trigger
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={openMore}
              onPointerEnter={preloadMore}
              onTouchStart={preloadMore}
              onFocus={preloadMore}
              className="flex h-11 w-11 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-oh-cream transition-colors hover:bg-oh-stone/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream md:hidden"
            >
              <Icon name="menu" size={24} title={t("more")} />
            </button>
          </div>
        </div>
      </header>
      {/* Outside <header>: its backdrop-filter would otherwise become the
          containing block for the sheet's position: fixed. */}
      {moreMounted ? <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} /> : null}
    </>
  );
}
