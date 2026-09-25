/**
 * Plan typography (spec 3.2). Loaded only inside the plan layouts so the
 * marketing site keeps its Google Fonts <link>. Body stays Raleway via the
 * site's --font-primary; these add the display serif and CJK fallbacks.
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

/** Put this on the plan wrapper so `font-display` and `font-cjk` resolve. */
export const planFontVariables = `${instrumentSerif.variable} ${notoSansTC.variable} ${notoSansSC.variable}`;
