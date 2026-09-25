import { headers } from "next/headers";
import GoogleAnalytics from "@/components/GoogleAnalytics";
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
  // The business plan is private and loads its own display and CJK fonts
  // (lib/plan/fonts.ts), so it skips Google Analytics and the site's large
  // multi-family stylesheet; it only needs the Raleway body face.
  const isPlan = /\/plan(\/|$)/.test(h.get("x-pathname") ?? "");
  return (
    <html lang={lang}>
      <head>
        {isPlan ? null : <GoogleAnalytics />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href={
            isPlan
              ? "https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap"
              : "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=LXGW+WenKai+TC:wght@300;400;700&family=Ma+Shan+Zheng&family=Raleway:wght@300;400;500;600;700&family=Noto+Serif+TC:wght@400;500;600;700&display=swap"
          }
          rel="stylesheet"
        />
      </head>
      <body>
        <GuestProvider>{children}</GuestProvider>
      </body>
    </html>
  );
}
