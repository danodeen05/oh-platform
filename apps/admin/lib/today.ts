import type { AdminRole } from "./access";

export type TodayPayload = {
  date: string; ordersToday: number; activeDiners: number; openPodCalls: number; shopToShip: number; cateringNext7: number;
  salesCents?: number; unansweredQuestions?: number; countersignerMissing?: boolean;
};
export type AttentionRow = { key: string; label: string; count: number; href: string; tone: "alert" | "pending" | "info" };

/** The "Needs attention" rows for a role. Rows with nothing to do are dropped. */
export function attentionRows(t: TodayPayload, role: AdminRole): AttentionRow[] {
  const rows: AttentionRow[] = [
    { key: "podCalls", label: "Open pod calls", count: t.openPodCalls, href: "/kitchen", tone: "alert" },
    { key: "shop", label: "Shop orders to ship", count: t.shopToShip, href: "/shop-orders?fulfillmentStatus=PENDING", tone: "pending" },
    { key: "catering", label: "Catering in the next 7 days", count: t.cateringNext7, href: "/catering", tone: "info" },
  ];
  if (role === "owner") {
    rows.push({ key: "planQuestions", label: "Plan questions to answer", count: t.unansweredQuestions ?? 0, href: "/plan-access", tone: "pending" });
    rows.push({ key: "countersigner", label: "Adopt your NDA countersignature", count: t.countersignerMissing ? 1 : 0, href: "/plan-access", tone: "alert" });
  }
  return rows.filter((r) => r.count > 0);
}

/** "Sunday, Sep 27" for the Denver business day that starts at `iso`. */
export function denverDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Denver" });
}
