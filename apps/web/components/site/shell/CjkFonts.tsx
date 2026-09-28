"use client";

/**
 * Chinese web fonts for the rebuilt site (Task G2a): Noto Sans and Serif TC
 * on zh-TW pages only, SC on zh-CN only, nothing at all on en and es.
 *
 * Not next/font: next/font puts every face a module defines into the CSS of
 * every route that imports it, and the (site) routes serve all four locales,
 * so the CJK faces blocked render in English too (about 475 KB of CSS on
 * every page). Google's stylesheet is split into unicode-range slices, so a
 * page downloads only the slices its text uses.
 *
 * Those slices are still large: a zh-TW page pulls 1 to 2.5 MB of them. On
 * a phone connection that would starve the page's own image and scripts, so
 * the stylesheet is added only after the page has loaded (window `load`,
 * then an idle moment). Until then Chinese text shows in the phone's own
 * Chinese face (PingFang on iOS, Noto Sans CJK on Android) and swaps
 * (`display=swap`) when the web faces arrive. On a client navigation into a
 * zh page the page has long loaded, so it's added at once. Font files are
 * never preloaded.
 */
import { useEffect } from "react";

const FAMILIES: Record<string, string> = {
  "zh-TW": "family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;500;600;700",
  "zh-CN": "family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;500;600;700",
};

export function cjkFontsHref(locale: string): string | null {
  const families = FAMILIES[locale];
  return families ? `https://fonts.googleapis.com/css2?${families}&display=swap` : null;
}

export function CjkFonts({ locale }: { locale: string }) {
  const href = cjkFontsHref(locale);

  useEffect(() => {
    if (!href) return;
    let link: HTMLLinkElement | null = null;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const add = () => {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.cjkFonts = locale;
      document.head.appendChild(link);
    };
    const afterIdle = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(add, { timeout: 2000 });
      else timer = setTimeout(add, 200);
    };
    if (document.readyState === "complete") afterIdle();
    else window.addEventListener("load", afterIdle, { once: true });
    return () => {
      window.removeEventListener("load", afterIdle);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer !== undefined) clearTimeout(timer);
      link?.remove();
    };
  }, [href, locale]);

  return null;
}
