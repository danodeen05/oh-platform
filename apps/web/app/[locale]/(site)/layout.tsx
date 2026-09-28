/**
 * Task C4: the `(site)` route group holds the REBUILT customer routes
 * (Phase D moves each one here from `(legacy)`). They render inside the new
 * SiteShell: top bar, phone dock, More sheet, desktop nav, footer. No
 * `.legacy-ui` anywhere in this tree.
 *
 * Task G2a (mobile budget): this layout provides what the shared [locale]
 * layout used to give every page, trimmed to what these pages need:
 * - ScopedIntl: only the message namespaces (site) client components read.
 * - DeferredClerk: identity from the verified session on the server, with
 *   Clerk's client loaded after first paint instead of before it.
 */
import type { Viewport } from "next";
import { auth } from "@clerk/nextjs/server";
import { getLocale } from "next-intl/server";
import { DeferredClerk } from "@/components/site/auth/DeferredClerk";
import { ScopedIntl } from "@/components/site/ScopedIntl";
import { SiteShell } from "@/components/site/shell/SiteShell";

// Lets the shell's env(safe-area-inset-*) padding take effect on notched
// phones (the dock sits on the home indicator's inset, not under it).
export const viewport: Viewport = { viewportFit: "cover" };

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ userId }, locale] = await Promise.all([auth(), getLocale()]);
  return (
    <ScopedIntl scope="site">
      <DeferredClerk initialSignedIn={Boolean(userId)} locale={locale}>
        <SiteShell>{children}</SiteShell>
      </DeferredClerk>
    </ScopedIntl>
  );
}
