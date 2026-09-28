/**
 * The rebuilt site's own fonts (Task G2a). Split from components/site/fonts.ts,
 * which stays the business plan's set unchanged.
 *
 * Why a separate module: next/font bundles the @font-face CSS of EVERY font
 * defined in a module into each route that imports it. The site shell used to
 * import fonts.ts, so all four Noto CJK families (about 475 KB of
 * render-blocking CSS) landed on every page, English included.
 *
 * - Instrument Serif (display) and Raleway (Latin body) are self-hosted here,
 *   so an English or Spanish page needs no third-party font request at all.
 *   Raleway used to come from a render-blocking Google Fonts stylesheet.
 * - Chinese faces are NOT next/font: the (site) layout serves Google's
 *   Noto Sans/Serif TC stylesheet on zh-TW pages only, and SC on zh-CN only,
 *   without blocking render (components/site/shell/CjkFonts.tsx).
 * - Chop seals use their own 5 KB subset (components/site/seal/seal-font.ts).
 */
import { Instrument_Serif, Raleway } from "next/font/google";

export const siteDisplayFont = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

// One variable file covers every weight the site uses (300 to 700).
export const siteBodyFont = Raleway({
  subsets: ["latin"],
  display: "swap",
});

const SYSTEM_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/**
 * Custom properties the site's font utilities read (app/globals.css
 * `@theme inline`), set on <html> by SiteFontVars while a (site) page is
 * mounted, so portals (sheets, dialogs, toasts) resolve them too.
 *
 * The CJK names only resolve where their stylesheet loaded (zh pages) or the
 * device has the family installed; everywhere else the browser skips them.
 * The page's own script comes first: on zh-CN the "tc" slots name the SC
 * faces, so simplified text never renders in a TC face that happens to be
 * loaded (after a switch from zh-TW, say).
 *
 * `html[lang][lang]` outranks globals.css's `html[lang="zh-TW"]` rule, which
 * still sets the legacy LXGW WenKai body face for (legacy) pages.
 */
export function siteFontCss(locale: string): string {
  const [first, second] = locale === "zh-CN" ? ["SC", "TC"] : ["TC", "SC"];
  return [
    "html[lang][lang]{",
    `--font-primary:${siteBodyFont.style.fontFamily},${SYSTEM_SANS};`,
    `--font-instrument-serif:${siteDisplayFont.style.fontFamily};`,
    `--font-noto-tc:'Noto Sans ${first}';`,
    `--font-noto-sc:'Noto Sans ${second}';`,
    `--font-noto-serif-tc:'Noto Serif ${first}';`,
    `--font-noto-serif-sc:'Noto Serif ${second}';`,
    "}",
  ].join("");
}
