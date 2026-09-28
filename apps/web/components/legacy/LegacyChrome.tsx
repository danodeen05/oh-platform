/**
 * The pre-overhaul site chrome (Task C4 layout split): Header,
 * ActiveOrderBanner, Footer and a floating Chappy launcher, around routes
 * that have not been rebuilt yet. It used to live in app/[locale]/layout.tsx
 * and was inherited by every route; now only the `(legacy)` group (and the
 * two stay-in-place routes that had it, agents and kiosk-unauthorized)
 * render it, while `(site)` routes get SiteShell instead.
 *
 * The DOM is the same as the old shared layout's, so legacy pages stay
 * pixel-identical. `.legacy-ui` scopes just the chrome; each caller decides
 * whether its own {children} need it.
 *
 * Embed contract: with the `x-embed` request header (`?embed=1`) this renders
 * the page alone, with no header, footer or chat.
 */
import { headers } from "next/headers";
import type { ReactNode } from "react";
import ActiveOrderBanner from "@/components/ActiveOrderBanner";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { LegacyChappy } from "./LegacyChappy";

export async function LegacyChrome({ children }: { children: ReactNode }) {
  const h = await headers();
  if (h.get("x-embed") === "1") return <>{children}</>;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="legacy-ui">
          <Header />
          <ActiveOrderBanner />
        </div>
        <main style={{ flex: 1 }}>{children}</main>
        <div className="legacy-ui">
          <Footer />
        </div>
      </div>
      {/* Task E1: the site's Chappy (built on site utilities, so NOT under
          .legacy-ui), opened from a floating launcher. */}
      <LegacyChappy />
    </>
  );
}
