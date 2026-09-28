/**
 * Kiosk layout. The kiosk's own (client) layout is KioskLayoutClient.tsx,
 * unchanged; Task G2a added this server wrapper only to give it Clerk's
 * provider, which the shared [locale] layout used to supply to every page
 * (see components/legacy/WithClerk.tsx).
 */
import type { ReactNode } from "react";
import { WithClerk } from "@/components/legacy/WithClerk";
import KioskLayoutClient from "./KioskLayoutClient";

export default function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <WithClerk>
      <KioskLayoutClient>{children}</KioskLayoutClient>
    </WithClerk>
  );
}
