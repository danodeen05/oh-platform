/**
 * Task C1 ROUTE-GROUP ruling: every existing customer route now lives under
 * this `(legacy)` group (a route group, so it does not change any URL). Its
 * one job is to scope the retired global element rules (button, input,
 * textarea, a, h1-h6, p, see app/globals.css) back on for pages that have
 * not yet been rebuilt with components/site/* primitives.
 *
 * Rebuilt pages move out of `(legacy)` and into `(site)` one at a time
 * (Phase D), whose own layout (C4) uses SiteShell instead.
 */
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return <div className="legacy-ui">{children}</div>;
}
