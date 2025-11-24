"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function PaymentForm({
  orderId,
  totalCents,
  orderNumber,
}: {
  orderId: string;
  totalCents: number;
  orderNumber: string;
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleTestPayment() {
    setProcessing(true);
    setError("");

    try {
      // For now, just mark the order as paid (we'll add real Stripe later)
      const response = await fetch(`${BASE}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PAID",
          paymentStatus: "PAID",
        }),
      });

      if (!response.ok) throw new Error("Payment failed");

      // Redirect to confirmation
      router.push(
        `/order/confirmation?orderNumber=${orderNumber}&total=${totalCents}&paid=true`
      );
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setProcessing(false);
    }
  }

  return (
    <div>
      {/* Payment Method Selection */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Payment Method</h3>

        <div
          style={{
            border: "2px solid #667eea",
            borderRadius: 12,
            padding: 20,
            background: "#f0f4ff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
              }}
            >
              💳
            </div>
            <div>
              <div style={{ fontWeight: "bold" }}>Test Payment</div>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                Demo mode - no real charge
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fbbf24",
              borderRadius: 8,
              padding: 12,
              fontSize: "0.85rem",
              color: "#92400e",
            }}
          >
            ⚠️ This is a demo payment. Real Stripe integration coming soon!
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleTestPayment}
        disabled={processing}
        style={{
          width: "100%",
          padding: 16,
          background: processing ? "#d1d5db" : "#22c55e",
          color: "white",
          border: "none",
          borderRadius: 12,
          fontSize: "1.1rem",
          fontWeight: "bold",
          cursor: processing ? "not-allowed" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {processing
          ? "Processing Payment..."
          : `Pay $${(totalCents / 100).toFixed(2)}`}
      </button>

      <p
        style={{
          textAlign: "center",
          fontSize: "0.75rem",
          color: "#9ca3af",
          marginTop: 16,
        }}
      >
        🔒 Secure checkout powered by Stripe (test mode)
      </p>
    </div>
  );
}
