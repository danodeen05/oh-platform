/**
 * Private events (/e/[slug]): the message namespaces this route's client
 * code reads (ROUTE_NAMESPACES["e"] in lib/site/client-messages.ts), on top
 * of the (site) base set. The event itself is fetched one level down, in
 * [slug]/layout.tsx.
 */
import type { ReactNode } from "react";
import { RouteIntl } from "@/components/site/ScopedIntl";

export default function Layout({ children }: { children: ReactNode }) {
  return <RouteIntl route="e">{children}</RouteIntl>;
}
