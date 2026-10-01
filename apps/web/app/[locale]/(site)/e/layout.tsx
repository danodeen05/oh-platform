/**
 * Private events (/e/[slug]): the message namespaces this route's client
 * code reads (ROUTE_NAMESPACES["e"] in lib/site/client-messages.ts), on top
 * of the (site) base set. The event itself is fetched one level down, in
 * [slug]/layout.tsx. Like the order flow, event pages have no dock: they
 * pin their own call to action.
 */
import type { ReactNode } from "react";
import { RouteIntl } from "@/components/site/ScopedIntl";

export default function Layout({ children }: { children: ReactNode }) {
  // data-order-flow: the shell drops --dock-h to 0 here (the dock itself hides via isEventPath).
  return (
    <RouteIntl route="e">
      <div data-order-flow data-event-route className="flex min-h-[calc(100svh-4.75rem-env(safe-area-inset-top,0px))] flex-col">
        {children}
      </div>
    </RouteIntl>
  );
}
