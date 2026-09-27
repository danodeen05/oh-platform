"use client";

import { useState, useEffect, useCallback } from "react";
import StatCard from "../../../analytics/components/StatCard";
import DataTable from "../../../analytics/components/DataTable";
import type { Rsvp, CateringOrder } from "../../_components/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface OrdersTabProps {
  eventId: string;
  minimumBowls: number;
}

export default function OrdersTab({ eventId, minimumBowls }: OrdersTabProps) {
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [rsvpRes, orderRes] = await Promise.all([
        fetch(`${BASE}/admin/catering/events/${eventId}/rsvps`),
        fetch(`${BASE}/admin/catering/events/${eventId}/orders`),
      ]);
      if (rsvpRes.ok) {
        const d = await rsvpRes.json();
        setRsvps(Array.isArray(d) ? d : []);
      }
      if (orderRes.ok) {
        const d = await orderRes.json();
        setOrders(Array.isArray(d) ? d : []);
      }
    } catch (err) {
      console.error("Failed to fetch orders/rsvps:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalBowls = orders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const orderedCount = orders.length;
  const notOrdered = rsvps.length - orderedCount;

  if (loading) {
    return <p style={{ color: "#6b7280" }}>Loading...</p>;
  }

  const SPECIAL_DIET = ["no beef", "no meat", "no noodles", "soup only", "vegetarian"];
  const isSpecialDiet = (o: CateringOrder) =>
    o.items.some((i) => {
      const hay = `${i.menuItem?.name || ""} ${i.selectedValue || ""}`.toLowerCase();
      return SPECIAL_DIET.some((t) => hay.includes(t));
    });

  const rsvpRows = rsvps.map((r) => ({
    name: r.name,
    phone: r.phone || "—",
    zodiac: r.zodiac || "—",
    rsvpAt: new Date(r.createdAt).toLocaleString(),
  }));

  const orderRows = orders.map((o) => ({
    attendee: o.guestName || o.guest?.name || "—",
    items: o.items
      .map(
        (item) =>
          `${item.quantity > 1 ? `${item.quantity}x ` : ""}${item.menuItem?.name || ""}${item.selectedValue ? ` (${item.selectedValue})` : ""}`
      )
      .join(", "),
    dietary: isSpecialDiet(o) ? (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: "0.75rem",
          fontWeight: 600,
          backgroundColor: "#fee2e2",
          color: "#991b1b",
        }}
      >
        Special Diet
      </span>
    ) : (
      <span style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Standard</span>
    ),
    time: new Date(o.createdAt).toLocaleString(),
  }));

  return (
    <div>
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard title="RSVP'd" value={rsvps.length} color="blue" />
        <StatCard title="Ordered" value={orderedCount} color="green" />
        <StatCard
          title="Not Ordered"
          value={notOrdered > 0 ? notOrdered : 0}
          color={notOrdered > 0 ? "yellow" : "default"}
        />
        <StatCard
          title="Total Bowls"
          value={totalBowls}
          subtitle={`${minimumBowls} min`}
          color={totalBowls >= minimumBowls ? "green" : "yellow"}
        />
      </div>

      {/* RSVPs table */}
      <div style={{ marginBottom: 24 }}>
        <DataTable
          title={`RSVPs (${rsvps.length})`}
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "zodiac", label: "Zodiac" },
            { key: "rsvpAt", label: "RSVP'd At" },
          ]}
          data={rsvpRows as Record<string, unknown>[]}
          expandable
          defaultLimit={10}
        />
      </div>

      {/* Orders table */}
      <DataTable
        title={`Orders (${orders.length})`}
        columns={[
          { key: "attendee", label: "Attendee" },
          { key: "items", label: "Items" },
          { key: "dietary", label: "Dietary" },
          { key: "time", label: "Time" },
        ]}
        data={orderRows as Record<string, unknown>[]}
        expandable
        defaultLimit={10}
      />

      <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#9ca3af" }}>
        Auto-refreshing every 10 seconds
      </div>
    </div>
  );
}
