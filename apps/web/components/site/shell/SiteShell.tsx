/**
 * The customer site shell (Task C4): a slim top bar, the phone dock, the
 * More sheet, the desktop nav and a quiet footer, around every `(site)`
 * route. Mobile first: the dock is the primary navigation below 768px; at
 * 768px and up it hides and the top bar carries the nav instead.
 *
 * `--dock-h` is published on the shell root (the dock's height including
 * the bottom safe-area inset on phones, 0 on desktop) so pages can pad
 * anything fixed or full-height against it. The shell itself pads its
 * bottom by it, so ordinary page content never hides under the dock.
 *
 * Embed contract: with the `x-embed` request header (`?embed=1`, set by
 * middleware) the shell renders its children only, with no top bar, dock,
 * footer or Chappy (the business plan embeds pages in a phone frame).
 */
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { siteFontVariables } from "@/components/site/fonts";
import { ChappyProvider } from "@/components/site/chappy/ChappyLauncher";
import { ActiveOrderPill } from "./ActiveOrderPill";
import { Dock } from "./Dock";
import { Footer } from "./Footer";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";

export async function SiteShell({ children }: { children: ReactNode }) {
  const h = await headers();
  if (h.get("x-embed") === "1") return <>{children}</>;

  const locale = await getLocale();
  const cjk = locale.startsWith("zh");

  return (
    <ChappyProvider>
      <div
        data-site-shell
        className={[
          siteFontVariables,
          cjk ? "font-cjk" : "font-body",
          // shrink-0: <body> is a flex column (globals.css); without it the
          // shell shrinks to the viewport and the page past the fold shows
          // the body's light background.
          "flex min-h-svh shrink-0 flex-col bg-oh-charcoal text-oh-cream antialiased",
          "[--dock-h:calc(4rem+env(safe-area-inset-bottom,0px))] md:[--dock-h:0px]",
          "pb-[var(--dock-h)]",
        ].join(" ")}
      >
        <SkipLink />
        <TopBar />
        <main id="site-main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <Footer />
        <ActiveOrderPill />
        <Dock />
      </div>
    </ChappyProvider>
  );
}
