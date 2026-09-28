/**
 * Task C4: the `(site)` route group holds the REBUILT customer routes
 * (Phase D moves each one here from `(legacy)`). They render inside the new
 * SiteShell: top bar, phone dock, More sheet, desktop nav, footer. No
 * `.legacy-ui` anywhere in this tree.
 */
import type { Viewport } from "next";
import { ScopedIntl } from "@/components/site/ScopedIntl";
import { SiteShell } from "@/components/site/shell/SiteShell";

// Lets the shell's env(safe-area-inset-*) padding take effect on notched
// phones (the dock sits on the home indicator's inset, not under it).
export const viewport: Viewport = { viewportFit: "cover" };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  // Task G2a: only the message namespaces (site) client components read.
  return (
    <ScopedIntl scope="site">
      <SiteShell>{children}</SiteShell>
    </ScopedIntl>
  );
}
