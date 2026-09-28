import { headers } from "next/headers";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { LEGACY_FONTS_HREF } from "@/components/legacy/LegacyFonts";
import { GuestProvider } from "@/contexts/guest-context";
import "./globals.css";

export const metadata = {
  title: "Oh Beef Noodle Soup",
  description: "Order your favorite noodle soup",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set by middleware; the [locale] layout below already makes every page dynamic via headers().
  const h = await headers();
  const lang = h.get("x-locale") ?? "en";
  // x-pathname is set by middleware for the plan, kiosk and CNY only.
  const pathname = h.get("x-pathname") ?? "";
  // The business plan is private and loads its own display and CJK fonts
  // (components/site/fonts.ts, via next/font), so it skips Google Analytics
  // and needs only the Raleway body face from Google Fonts.
  const isPlan = /\/plan(\/|$)/.test(pathname);
  // Kiosk and CNY keep the full legacy Google Fonts set from here, as before.
  // Chosen on the first request only (this layout never re-renders), so a
  // client navigation from a site page into /kiosk or /cny would arrive
  // without it. Rare: both are opened directly (kiosk device, CNY subdomain).
  const isKioskOrCny = pathname.includes("/kiosk") || pathname.includes("/cny");
  // Task G2a: nothing else gets a font stylesheet from the root any more.
  // This layout is never re-rendered on a client navigation, so a per-route
  // choice here would stick to whatever page was opened first. Instead:
  // legacy pages (LegacyChrome) load components/legacy/LegacyFonts.tsx,
  // and rebuilt (site) pages self-host Raleway and Instrument Serif
  // (components/site/site-fonts.ts) and load CJK faces only on zh pages
  // (components/site/shell/CjkFonts.tsx). They used to get the full legacy
  // set, a 275 KB render-blocking third-party stylesheet, on every page.
  const googleFontsHref = isPlan
    ? "https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap"
    : isKioskOrCny
      ? LEGACY_FONTS_HREF
      : null;
  return (
    <html lang={lang}>
      <head>
        {isPlan ? null : <GoogleAnalytics />}
        {googleFontsHref ? (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href={googleFontsHref} rel="stylesheet" />
          </>
        ) : null}
      </head>
      <body>
        <GuestProvider>{children}</GuestProvider>
      </body>
    </html>
  );
}
