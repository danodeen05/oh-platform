"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { QRCodeSVG } from "qrcode.react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

function CheckInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderQrCodeParam = searchParams.get("orderQrCode");

  const [orderQrCode, setOrderQrCode] = useState(orderQrCodeParam || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();

    if (!orderQrCode.trim()) {
      setError("Please enter your order QR code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${BASE}/orders/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ orderQrCode: orderQrCode.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === "ASSIGNED") {
          // Pod assigned - redirect to status page
          router.push(`/order/status?orderQrCode=${encodeURIComponent(orderQrCode.trim())}`);
        } else if (data.status === "QUEUED") {
          // Added to queue - redirect to status page
          router.push(`/order/status?orderQrCode=${encodeURIComponent(orderQrCode.trim())}`);
        }
      } else {
        setError(data.error || "Check-in failed. Please try again.");
      }
    } catch (err) {
      console.error("Check-in error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#E5E5E5",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎫</div>
          <h1 style={{ margin: 0, marginBottom: 8, fontSize: "1.8rem", color: "#111" }}>
            Check-In Kiosk
          </h1>
          <p style={{ color: "#666", fontSize: "1rem", margin: 0 }}>
            Scan or enter your order QR code to get your pod assignment
          </p>
        </div>

        {/* Instructions */}
        <div
          style={{
            background: "#f9fafb",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.6 }}>
            <strong style={{ color: "#111", display: "block", marginBottom: 8 }}>
              How to check in:
            </strong>
            1. Find your order QR code (on your order confirmation page)
            <br />
            2. Scan it with the kiosk scanner or enter the code below
            <br />
            3. Get your pod assignment or queue position
          </div>
        </div>

        {/* QR Code Input Form */}
        <form onSubmit={handleCheckIn}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="orderQrCode"
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: "0.9rem",
                color: "#666",
                fontWeight: "500",
              }}
            >
              Order QR Code:
            </label>
            <input
              id="orderQrCode"
              type="text"
              value={orderQrCode}
              onChange={(e) => setOrderQrCode(e.target.value)}
              placeholder="ORDER-xxpmm5hf-1234567890-ABC123"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "0.9rem",
                border: error ? "2px solid #dc2626" : "2px solid #e5e7eb",
                borderRadius: 8,
                fontFamily: "monospace",
              }}
              autoFocus
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                color: "#dc2626",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !orderQrCode.trim()}
            style={{
              width: "100%",
              padding: 16,
              background: loading || !orderQrCode.trim() ? "#e5e7eb" : "#7C7A67",
              color: loading || !orderQrCode.trim() ? "#9ca3af" : "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: loading || !orderQrCode.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Checking in..." : "Check In"}
          </button>
        </form>

        {/* Help Section */}
        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: "#f9fafb",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#666",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 8, color: "#111" }}>
            💡 Need Help?
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Your QR code is on your order confirmation page</li>
            <li>It starts with "ORDER-" followed by numbers and letters</li>
            <li>Ask staff if you need assistance</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#E5E5E5",
          }}
        >
          <div style={{ color: "#222222", fontSize: "1.2rem" }}>Loading...</div>
        </div>
      }
    >
      <CheckInContent />
    </Suspense>
  );
}
