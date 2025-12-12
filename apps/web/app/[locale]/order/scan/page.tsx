"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

function ScanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderQrCodeParam = searchParams.get("orderQrCode");

  const [orderQrCode, setOrderQrCode] = useState(orderQrCodeParam || "");
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch order details if we have the QR code
  useEffect(() => {
    if (!orderQrCode) return;

    async function fetchOrder() {
      try {
        const response = await fetch(`${BASE}/orders/status?orderQrCode=${encodeURIComponent(orderQrCode)}`, {
          headers: { "x-tenant-slug": "oh" },
        });
        if (response.ok) {
          const data = await response.json();
          setOrder(data.order);

          // If already confirmed at pod, redirect
          if (data.order.podConfirmedAt) {
            router.push(`/order/status?orderQrCode=${encodeURIComponent(orderQrCode)}`);
          }
        }
      } catch (error) {
        console.error("Failed to fetch order:", error);
      }
    }

    fetchOrder();
  }, [orderQrCode, router]);

  async function confirmPodScan(e: React.FormEvent) {
    e.preventDefault();

    if (!orderQrCode.trim()) {
      setError("Please scan or enter your order QR code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${BASE}/orders/confirm-pod`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ orderQrCode: orderQrCode.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/order/status?orderQrCode=${encodeURIComponent(orderQrCode.trim())}`);
        }, 1500);
      } else {
        setError(data.error || "Failed to confirm pod arrival");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!order) {
    return (
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
    );
  }

  if (success) {
    return (
      <div
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
            maxWidth: 400,
            width: "100%",
            background: "white",
            borderRadius: 16,
            padding: 48,
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "#22c55e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: "2.5rem",
              color: "white",
            }}
          >
            ✓
          </div>
          <h1 style={{ margin: 0, marginBottom: 8, fontSize: "1.8rem" }}>
            Pod Confirmed!
          </h1>
          <p style={{ color: "#666", fontSize: "1rem" }}>
            Your order is now being prepared
          </p>
        </div>
      </div>
    );
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
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📱</div>
          <h1 style={{ margin: 0, marginBottom: 8, fontSize: "1.8rem" }}>
            Confirm Pod Arrival
          </h1>
          <p style={{ color: "#666", fontSize: "1rem", margin: 0 }}>
            Scan or enter your order QR code at your assigned pod
          </p>
        </div>

        {/* Pod Info */}
        {order?.podNumber && (
          <div
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              color: "white",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.9rem", marginBottom: 4, opacity: 0.9 }}>
              Your Assigned Pod
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: "bold", letterSpacing: "0.1em" }}>
              POD {order.podNumber}
            </div>
          </div>
        )}

        {/* Manual Entry Form */}
        <form onSubmit={confirmPodScan}>
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
              Your Order QR Code:
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
                border: "2px solid #e5e7eb",
                borderRadius: 8,
                fontFamily: "monospace",
              }}
              autoFocus
            />
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>
              Same QR code from your order confirmation
            </p>
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
              padding: 14,
              background: loading || !orderQrCode.trim() ? "#e5e7eb" : "#7C7A67",
              color: loading || !orderQrCode.trim() ? "#9ca3af" : "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: loading || !orderQrCode.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Confirming..." : "Confirm I'm At My Pod"}
          </button>
        </form>

        {/* Help Text */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#f9fafb",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#666",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 8, color: "#111" }}>
            💡 What This Does
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Confirms you've arrived at your assigned pod</li>
            <li>Notifies the kitchen to start preparing your order</li>
            <li>You'll see real-time status updates on your screen</li>
          </ul>
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push(`/order/status?orderQrCode=${encodeURIComponent(orderQrCode)}`)}
          style={{
            width: "100%",
            marginTop: 16,
            padding: 12,
            background: "transparent",
            color: "#666",
            border: "none",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          ← Back to Order Status
        </button>
      </div>
    </main>
  );
}

export default function ScanPage() {
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
      <ScanContent />
    </Suspense>
  );
}
