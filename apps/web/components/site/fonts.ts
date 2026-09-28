/**
 * Site typography (spec 4). Promoted from lib/plan/fonts.ts in Task C1 so the
 * whole site can use these families, not just /plan: Instrument Serif for
 * display type, Noto Serif TC/SC for Chinese display, Noto Sans TC/SC for
 * Chinese body copy. Latin body copy stays Raleway, loaded as a Google Fonts
 * <link> in app/layout.tsx (not next/font) so legacy, kiosk and CNY pages
 * that already reference it keep working unchanged.
 */
import {
  Instrument_Serif,
  Noto_Sans_SC,
  Noto_Sans_TC,
  Noto_Serif_SC,
  Noto_Serif_TC,
} from "next/font/google";

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

export const notoSerifTC = Noto_Serif_TC({
  weight: ["400", "500", "600", "700"],
  preload: false,
  variable: "--font-noto-serif-tc",
  display: "swap",
});

export const notoSerifSC = Noto_Serif_SC({
  weight: ["400", "500", "600", "700"],
  preload: false,
  variable: "--font-noto-serif-sc",
  display: "swap",
});

/**
 * Put this on the plan wrapper so `font-display` and `font-cjk` resolve.
 * Unchanged from the pre-promotion set (Instrument Serif + Noto Sans TC/SC)
 * so /plan stays pixel-identical.
 */
export const planFontVariables = `${instrumentSerif.variable} ${notoSansTC.variable} ${notoSansSC.variable}`;

/**
 * The full site font set, for components/site/Text.tsx (Display/Title use
 * the serif faces, Body/Eyebrow use the sans faces).
 */
export const siteFontVariables = `${instrumentSerif.variable} ${notoSerifTC.variable} ${notoSerifSC.variable} ${notoSansTC.variable} ${notoSansSC.variable}`;
