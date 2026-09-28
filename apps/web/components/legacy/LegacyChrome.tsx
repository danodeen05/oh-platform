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
 *
 * Task G2a: it also brings what the shared layers used to give every page
 * and now give only legacy ones: the legacy Google Fonts set (LegacyFonts)
 * and every message namespace but the plan's (ScopedIntl). And Clerk: its
 * <ClerkProvider> (WithClerk), with ClerkSiteAuth publishing it to shared code
 * that reads identity through lib/site/auth.tsx.
 */
import { headers } from "next/headers";
import type { ReactNode } from "react";
import ActiveOrderBanner from "@/components/ActiveOrderBanner";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { ScopedIntl } from "@/components/site/ScopedIntl";
import { ClerkSiteAuth } from "./ClerkSiteAuth";
import LanguageTracker from "@/components/LanguageTracker";
import { LegacyChappy } from "./LegacyChappy";
import { LegacyFonts } from "./LegacyFonts";
import { WithClerk } from "./WithClerk";

/** What every legacy page gets around it (Task G2a). */
function LegacyScope({ children }: { children: ReactNode }) {
  return (
    <WithClerk>
      <ClerkSiteAuth>
        <ScopedIntl scope="legacy">
          <LegacyFonts />
          {children}
        </ScopedIntl>
      </ClerkSiteAuth>
    </WithClerk>
  );
}

export async function LegacyChrome({ children }: { children: ReactNode }) {
  const h = await headers();
  if (h.get("x-embed") === "1") return <LegacyScope>{children}</LegacyScope>;

  return (
    <LegacyScope>
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
      <LanguageTracker />
    </LegacyScope>
  );
}
