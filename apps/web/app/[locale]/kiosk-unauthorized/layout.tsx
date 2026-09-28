/**
 * Task C4: `/kiosk-unauthorized` is not a kiosk route to the middleware (no
 * x-pathname), so it used to inherit the shared legacy chrome from the
 * [locale] layout. It keeps that chrome. Its own content is inline-styled
 * and never had `.legacy-ui`, so its children stay unscoped as before.
 */
import { LegacyChrome } from "@/components/legacy/LegacyChrome";

export default function KioskUnauthorizedLayout({ children }: { children: React.ReactNode }) {
  return <LegacyChrome>{children}</LegacyChrome>;
}
