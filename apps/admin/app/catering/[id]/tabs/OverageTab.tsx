"use client";

import { useState, useEffect, useTransition } from "react";
import StatCard from "../../../analytics/components/StatCard";
import type { Overage } from "../../_components/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface OverageTabProps {
  eventId: string;
  pricePerBowlCents: number;
}

export default function OverageTab({ eventId, pricePerBowlCents }: OverageTabProps) {
  const [overage, setOverage] = useState<Overage | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [invoiceResult, setInvoiceResult] = useState<{ invoiceUrl: string; status: string } | null>(null);

  const fetchOverage = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/catering/events/${eventId}/overage`);
      if (!res.ok) return;
      const data: Overage = await res.json();
      setOverage(data);
    } catch (err) {
      console.error("Failed to fetch overage:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverage();
  }, [eventId]);

  const handleInvoice = () => {
    if (!overage) return;
    const total = (overage.overageAmountCents / 100).toFixed(2);
    if (
      !confirm(
        `Charge client for ${overage.overageCount} extra bowl${overage.overageCount !== 1 ? "s" : ""} = $${total}?\n\nThis will create a Stripe invoice and send it to the client.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/catering/events/${eventId}/overage-invoice`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to create overage invoice");
          return;
        }
        const data = await res.json();
        setInvoiceResult({ invoiceUrl: data.invoiceUrl, status: data.status });
        await fetchOverage();
      } catch (err) {
        console.error("Failed to create overage invoice:", err);
        alert("Failed to create overage invoice");
      }
    });
  };

  if (loading) {
    return <p style={{ color: "#6b7280" }}>Loading...</p>;
  }

  if (!overage) {
    return (
      <p style={{ color: "#9ca3af" }}>No overage data available yet.</p>
    );
  }

  return (
    <div>
      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard title="Bowls Booked (committed)" value={overage.bowlsBooked} color="blue" />
        <StatCard title="Bowls Ordered (actual)" value={overage.bowlsOrdered} color="green" />
        <StatCard
          title="Overage Bowls"
          value={overage.overageCount}
          color={overage.overageCount > 0 ? "yellow" : "default"}
        />
        {overage.overageCount > 0 && (
          <StatCard
            title="Overage Amount"
            value={`$${(overage.overageAmountCents / 100).toFixed(2)}`}
            subtitle={`${overage.overageCount} x $${(pricePerBowlCents / 100).toFixed(2)}`}
            color="yellow"
          />
        )}
      </div>

      {/* Already charged */}
      {overage.charge && (
        <div
          style={{
            padding: 16,
            backgroundColor: "#d1fae5",
            borderRadius: 8,
            border: "1px solid #10b981",
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 600, color: "#065f46", marginBottom: 8 }}>
            Overage Invoice Sent
          </div>
          <div style={{ fontSize: "0.9rem", color: "#374151", marginBottom: 8 }}>
            Status:{" "}
            <span style={{ fontWeight: 500 }}>{overage.charge.status}</span>
          </div>
          <a
            href={overage.charge.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#4f46e5", fontSize: "0.9rem" }}
          >
            View Stripe Invoice
          </a>
        </div>
      )}

      {/* Invoice result after creating */}
      {invoiceResult && (
        <div
          style={{
            padding: 16,
            backgroundColor: "#d1fae5",
            borderRadius: 8,
            border: "1px solid #10b981",
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 600, color: "#065f46", marginBottom: 8 }}>
            Invoice Created Successfully
          </div>
          <div style={{ fontSize: "0.9rem", color: "#374151", marginBottom: 8 }}>
            Status: {invoiceResult.status}
          </div>
          <a
            href={invoiceResult.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#4f46e5", fontSize: "0.9rem" }}
          >
            View Stripe Invoice
          </a>
        </div>
      )}

      {/* Action to charge */}
      {overage.overageCount > 0 && !overage.charge && !invoiceResult && (
        <div
          style={{
            padding: 20,
            backgroundColor: "#fffbeb",
            borderRadius: 8,
            border: "1px solid #f59e0b",
          }}
        >
          <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
            Overage Detected
          </div>
          <div style={{ fontSize: "0.9rem", color: "#78350f", marginBottom: 16 }}>
            {overage.overageCount} extra bowl{overage.overageCount !== 1 ? "s" : ""} were ordered
            beyond the committed amount. Charge the client $
            {(overage.overageAmountCents / 100).toFixed(2)}.
          </div>
          <button
            onClick={handleInvoice}
            disabled={pending}
            style={{
              padding: "10px 24px",
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: pending ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending
              ? "Creating Invoice..."
              : `Charge Client for ${overage.overageCount} Extra Bowl${overage.overageCount !== 1 ? "s" : ""} ($${(overage.overageAmountCents / 100).toFixed(2)})`}
          </button>
        </div>
      )}

      {overage.overageCount === 0 && (
        <div
          style={{
            padding: 16,
            backgroundColor: "#f0fdf4",
            borderRadius: 8,
            border: "1px solid #10b981",
            fontSize: "0.9rem",
            color: "#065f46",
          }}
        >
          No overage — orders are within the committed amount.
        </div>
      )}
    </div>
  );
}
