/**
 * Task C1 ROUTE-GROUP ruling: every existing customer route now lives under
 * this `(legacy)` group (a route group, so it does not change any URL). It
 * scopes the retired global element rules (button, input, textarea, a,
 * h1-h6, p, see app/globals.css) back on for pages that have not yet been
 * rebuilt with components/site/* primitives.
 *
 * Task C4: it also renders the legacy chrome (Header, ActiveOrderBanner,
 * Footer, floating Chappy) that the shared [locale] layout used to provide,
 * and honors the `x-embed` contract (LegacyChrome renders the page alone).
 *
 * Rebuilt pages move out of `(legacy)` and into `(site)` one at a time
 * (Phase D), whose own layout uses SiteShell instead.
 */
import { LegacyChrome } from "@/components/legacy/LegacyChrome";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <LegacyChrome>
      <div className="legacy-ui">{children}</div>
    </LegacyChrome>
  );
}
