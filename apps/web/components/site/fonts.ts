/**
 * The business plan's typography (spec 4): Instrument Serif for display type
 * and Noto Sans TC/SC for Chinese copy, via next/font. Latin body copy is
 * Raleway, loaded as a Google Fonts <link> in app/layout.tsx.
 *
 * Task G2a: this module is the PLAN's font set again. The rebuilt site uses
 * components/site/site-fonts.ts instead, because next/font puts every face a
 * module defines into the CSS of every route that imports the module, and
 * the site must not ship CJK faces to English pages. The Noto Serif TC/SC
 * faces the site used to share from here are gone: nothing in the plan used
 * them (it never applied their variables), so the plan renders exactly as
 * before and simply stops downloading their unused CSS.
 */
import { Instrument_Serif, Noto_Sans_SC, Noto_Sans_TC } from "next/font/google";

export const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const notoSansTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  preload: false,
  variable: "--font-noto-tc",
  display: "swap",
});

export const notoSansSC = Noto_Sans_SC({
  weight: ["400", "500", "700"],
  preload: false,
  variable: "--font-noto-sc",
  display: "swap",
});

/**
 * Put this on the plan wrapper so `font-display` and `font-cjk` resolve.
 * Unchanged from the pre-promotion set (Instrument Serif + Noto Sans TC/SC)
 * so /plan stays pixel-identical.
 */
export const planFontVariables = `${instrumentSerif.variable} ${notoSansTC.variable} ${notoSansSC.variable}`;
