"use client";

import { useState, useEffect, useTransition } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function OrderNowToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${BASE}/admin/site-config/order-now`);
      if (!res.ok) return;
      const data = await res.json();
      setEnabled(data.enabled);
    } catch (err) {
      console.error("Failed to fetch order-now status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle = () => {
    if (enabled === null) return;
    const next = !enabled;
    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/site-config/order-now`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to update site config");
          return;
        }
        setEnabled(next);
      } catch (err) {
        console.error("Failed to update order-now:", err);
        alert("Failed to update site config");
      }
    });
  };

  if (loading) {
    return (
      <div style={{ padding: "12px 16px", backgroundColor: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.85rem", color: "#6b7280" }}>
        Loading site config...
      </div>
    );
  }

  const isOn = enabled === true;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        backgroundColor: isOn ? "#d1fae5" : "#fef3c7",
        borderRadius: 8,
        border: `1px solid ${isOn ? "#10b981" : "#f59e0b"}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: isOn ? "#065f46" : "#92400e" }}>
          Dine-In Ordering: {isOn ? "LIVE" : "OFF (Catering-only CTA)"}
        </div>
        <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 2 }}>
          {isOn
            ? "Customers can place dine-in orders from the website."
            : "Website shows Book Catering CTA instead of Order Now."}
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={pending}
        style={{
          padding: "8px 20px",
          borderRadius: 6,
          border: "none",
          cursor: pending ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: "0.85rem",
          backgroundColor: isOn ? "#dc2626" : "#059669",
          color: "white",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Updating..." : isOn ? "Turn OFF" : "Turn ON"}
      </button>
    </div>
  );
}
