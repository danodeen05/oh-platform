/**
 * The pre-overhaul Google Fonts set (Task G2a moved it out of app/layout.tsx):
 * Bebas Neue, LXGW WenKai TC, Ma Shan Zheng, Raleway and Noto Serif TC.
 * Legacy pages still name them inline and in globals.css (`--font-heading`
 * is Noto Serif TC in every locale, LXGW WenKai TC is the zh body face), so
 * every page that renders LegacyChrome loads it, exactly as before. Kiosk and
 * CNY get the same link from app/layout.tsx. Rebuilt (site) pages don't load
 * it at all: it was a 275 KB render-blocking third-party stylesheet.
 *
 * `precedence` hoists it into <head> like the old link.
 */
import { preconnect } from "react-dom";

export const LEGACY_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=LXGW+WenKai+TC:wght@300;400;700&family=Ma+Shan+Zheng&family=Raleway:wght@300;400;500;600;700&family=Noto+Serif+TC:wght@400;500;600;700&display=swap";

export function LegacyFonts() {
  preconnect("https://fonts.googleapis.com");
  preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
  return <link rel="stylesheet" href={LEGACY_FONTS_HREF} precedence="default" />;
}
