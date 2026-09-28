/**
 * Chinese web fonts for the rebuilt site (Task G2a): Noto Sans and Serif TC
 * on zh-TW pages only, SC on zh-CN only, nothing at all on en and es.
 *
 * Not next/font: next/font puts every face a module defines into the CSS of
 * every route that imports it, and the (site) routes serve all four locales,
 * so the CJK faces would block render in English too (they did: about 475 KB
 * of CSS on every page). Google's stylesheet is split into unicode-range
 * slices, so a page downloads only the slices its text uses.
 *
 * It must not block first paint either. The link starts as `media="print"`
 * (fetched at low priority, never render-blocking) and switches to "all"
 * once it has loaded: the inline script does that during the first HTML
 * parse, before React hydrates, and CjkFontsActivator does it after a client
 * navigation (React doesn't run inline scripts it inserts). `display=swap`:
 * text shows at once in the system's Chinese face and swaps when the web
 * face arrives. Font files are never preloaded.
 */
import { preconnect } from "react-dom";
import { CjkFontsActivator } from "./CjkFontsActivator";

const FAMILIES: Record<string, string> = {
  "zh-TW": "family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;500;600;700",
  "zh-CN": "family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;500;600;700",
};

export function cjkFontsHref(locale: string): string | null {
  const families = FAMILIES[locale];
  return families ? `https://fonts.googleapis.com/css2?${families}&display=swap` : null;
}

const ID = "oh-cjk-fonts";
const ACTIVATE = `(function(){var l=document.getElementById("${ID}");if(!l)return;var on=function(){l.media="all"};if(l.sheet)on();else l.addEventListener("load",on)})();`;

export function CjkFonts({ locale }: { locale: string }) {
  const href = cjkFontsHref(locale);
  if (!href) return null;
  preconnect("https://fonts.googleapis.com");
  preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
  return (
    <>
      {/* The key remounts the link when the locale changes on a client navigation. */}
      <link key={href} id={ID} rel="stylesheet" href={href} media="print" suppressHydrationWarning />
      <script dangerouslySetInnerHTML={{ __html: ACTIVATE }} />
      <CjkFontsActivator id={ID} href={href} />
    </>
  );
}
