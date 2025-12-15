"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function GroupPaymentForm({
  groupCode,
  totalCents,
  orderIds,
  seatingOption,
  locationId,
  hostOrderId,
  hostOrderNumber,
}: {
  groupCode: string;
  totalCents: number;
  orderIds: string[];
  seatingOption: number | null;
  locationId: string;
  hostOrderId: string;
  hostOrderNumber: string;
}) {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleGroupPayment() {
    setProcessing(true);
    setError("");

    try {
      // Mark all orders as paid
      for (const orderId of orderIds) {
        const response = await fetch(`${BASE}/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentStatus: "PAID",
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to process order ${orderId}`);
        }
      }

      // Update group status to PAID
      await fetch(`${BASE}/group-orders/${groupCode}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ status: "PAID" }),
      });

      // Complete the group order with seating assignment
      if (seatingOption) {
        // Fetch available seats to assign based on seating option
        const seatsRes = await fetch(`${BASE}/locations/${locationId}/seats`, {
          headers: { "x-tenant-slug": "oh" },
        });

        if (seatsRes.ok) {
          const seats = await seatsRes.json();
          const availableSeats = seats.filter((s: any) => s.status === "AVAILABLE");
          const seatsNeeded = orderIds.length;

          // Assign seats based on seating option
          let assignedSeatIds: string[] = [];
          if (availableSeats.length >= seatsNeeded) {
            const startIndex = seatingOption === 1 ? 0 :
                              seatingOption === 2 ? Math.floor(availableSeats.length / 3) :
                              Math.floor(availableSeats.length * 2 / 3);
            assignedSeatIds = availableSeats.slice(startIndex, startIndex + seatsNeeded).map((s: any) => s.id);
          }

          // Call complete endpoint to assign pods and notify kitchen
          await fetch(`${BASE}/group-orders/${groupCode}/complete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-slug": "oh",
            },
            body: JSON.stringify({
              seatIds: assignedSeatIds,
              seatingOption,
            }),
          });
        }
      }

      // Redirect to confirmation with host's order details
      router.push(
        `/order/confirmation?orderId=${hostOrderId}&orderNumber=${hostOrderNumber}&groupCode=${groupCode}&orderCount=${orderIds.length}&total=${totalCents}&paid=true`
      );
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setProcessing(false);
    }
  }

  if (!isLoaded) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: 16 }}>Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div
        style={{
          background: "rgba(124, 122, 103, 0.1)",
          border: "2px solid #7C7A67",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>*</div>
        <h3 style={{ marginBottom: 12 }}>Sign in to pay for the group</h3>
        <p style={{ color: "#666", marginBottom: 24 }}>
          As the host, you'll need to sign in to complete the group payment.
        </p>
        <SignInButton mode="modal">
          <button
            style={{
              padding: "16px 32px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Sign In / Sign Up
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div>
      {/* Payment Method */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Payment Method</h3>
        <div
          style={{
            border: "2px solid #7C7A67",
            borderRadius: 12,
            padding: 20,
            background: "rgba(124, 122, 103, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
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
              *
            </div>
            <div>
              <div style={{ fontWeight: "bold" }}>Test Payment</div>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>Demo mode - no real charge</div>
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
            This is a demo payment. Real Stripe integration coming soon!
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
        onClick={handleGroupPayment}
        disabled={processing}
        style={{
          width: "100%",
          padding: 16,
          background: processing ? "#d1d5db" : "#7C7A67",
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
          ? "Processing Group Payment..."
          : `Pay for Group ($${(totalCents / 100).toFixed(2)})`}
      </button>

      <p
        style={{
          textAlign: "center",
          fontSize: "0.75rem",
          color: "#9ca3af",
          marginTop: 16,
        }}
      >
        Secure checkout powered by Stripe (test mode)
      </p>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <a
          href={`/group/${groupCode}`}
          style={{
            color: "#7C7A67",
            textDecoration: "none",
            fontSize: "0.9rem",
          }}
        >
          Return to Group
        </a>
      </div>
    </div>
  );
}
