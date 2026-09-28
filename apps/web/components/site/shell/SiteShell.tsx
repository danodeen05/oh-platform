/**
 * The customer site shell (Task C4): a slim top bar, the phone dock, the
 * More sheet, the desktop nav and a quiet footer, around every `(site)`
 * route. Mobile first: the dock is the primary navigation below 768px; at
 * 768px and up it hides and the top bar carries the nav instead.
 *
 * `--dock-h` is published on the shell root (the dock's height including
 * its hairline and the bottom safe-area inset on phones, 0 on desktop) so
 * pages can pad anything fixed or full-height against it. The shell itself
 * pads its bottom by it, so ordinary page content never hides under the dock.
 *
 * Embed contract: with the `x-embed` request header (`?embed=1`, set by
 * middleware) the shell drops its chrome (skip link, top bar, footer, active
 * order pill, dock and Chappy) but keeps the wrapper: the site fonts, the
 * night palette and text rendering, so an embedded page (the business plan's
 * phone frame) still looks like the site. `--dock-h` is 0 there.
 *
 * `text-rendering: geometricPrecision` on the root: without it, Chromium's
 * mobile text path (Android Chrome) rounds each glyph advance to a whole CSS
 * pixel, which opens visible gaps inside small labels ("Me nu").
 */
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { siteDisplayFont, siteFontCss } from "@/components/site/site-fonts";
import { CjkFonts } from "./CjkFonts";
import { ChappyProvider } from "@/components/site/chappy/ChappyLauncher";
import { ActiveOrderPill } from "./ActiveOrderPill";
import { Dock } from "./Dock";
import { Footer } from "./Footer";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";

/** The wrapper classes every site page gets, embedded or not. */
function rootClass(cjk: boolean): string {
  return [
    siteDisplayFont.variable,
    cjk ? "font-cjk" : "font-body",
    // shrink-0: <body> is a flex column (globals.css); without it the
    // shell shrinks to the viewport and the page past the fold shows
    // the body's light background.
    "flex min-h-svh shrink-0 flex-col bg-oh-charcoal text-oh-cream antialiased [text-rendering:geometricPrecision]",
  ].join(" ");
}

export async function SiteShell({ children }: { children: ReactNode }) {
  const h = await headers();
  const locale = await getLocale();
  const cjk = locale.startsWith("zh");
  // Task G2a: the site's font custom properties on <html> (so portals get
  // them too) and, on zh pages only, the non-blocking CJK stylesheet.
  const fonts = (
    <>
      <style dangerouslySetInnerHTML={{ __html: siteFontCss(locale) }} />
      <CjkFonts locale={locale} />
    </>
  );

  if (h.get("x-embed") === "1") {
    return (
      <div data-site-shell="embed" className={`${rootClass(cjk)} [--dock-h:0px]`}>
        {fonts}
        {children}
      </div>
    );
  }

  return (
    <ChappyProvider>
      <div
        data-site-shell="full"
        className={[
          rootClass(cjk),
          // The dock is h-16 plus its 1px top border plus the bottom inset.
          "[--dock-h:calc(4rem+1px+env(safe-area-inset-bottom,0px))] md:[--dock-h:0px]",
          "pb-[var(--dock-h)]",
        ].join(" ")}
      >
        {fonts}
        <SkipLink />
        <TopBar />
        <main id="site-main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <Footer year={new Date().getFullYear()} />
        <ActiveOrderPill />
        <Dock />
      </div>
    </ChappyProvider>
  );
}
