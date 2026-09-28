/**
 * Task G2b: the message namespaces this route's client code reads
 * (ROUTE_NAMESPACES["challenges"] in lib/site/client-messages.ts), on top of the
 * (site) base set.
 */
import type { ReactNode } from "react";
import { RouteIntl } from "@/components/site/ScopedIntl";

export default function Layout({ children }: { children: ReactNode }) {
  return <RouteIntl route="challenges">{children}</RouteIntl>;
}
