"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PodInfo {
  pod: {
    id: string;
    number: string;
    qrCode: string;
    status: string;
  };
  location: {
    id: string;
    name: string;
    city: string;
  };
  hasActiveOrder: boolean;
  activeOrder: {
    id: string;
    orderNumber: string;
    kitchenOrderNumber: string;
    orderQrCode: string;
    alreadyConfirmed: boolean;
    userId: string | null;
  } | null;
}

function PodContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qrCode = searchParams.get("qr");

  const [podInfo, setPodInfo] = useState<PodInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmResult, setConfirmResult] = useState<any>(null);

  // Fetch pod info
  useEffect(() => {
    if (!qrCode) {
      setError("No QR code provided");
      setLoading(false);
      return;
    }

    async function fetchPodInfo() {
      try {
        const response = await fetch(
          `${BASE}/pods/info?qrCode=${encodeURIComponent(qrCode)}`,
          {
            headers: { "x-tenant-slug": "oh" },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setPodInfo(data);

          // If already confirmed, redirect to order status
          if (data.activeOrder?.alreadyConfirmed && data.activeOrder?.orderQrCode) {
            router.push(
              `/order/status?orderQrCode=${encodeURIComponent(data.activeOrder.orderQrCode)}`
            );
          }
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to load pod information");
        }
      } catch (err) {
        console.error("Failed to fetch pod info:", err);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchPodInfo();
  }, [qrCode, router]);

  async function handleConfirmArrival() {
    if (!qrCode || !podInfo?.hasActiveOrder) return;

    setConfirming(true);
    setError(null);

    try {
      // Get userId from localStorage if available
      const userId = localStorage.getItem("userId");

      const response = await fetch(`${BASE}/pods/confirm-arrival`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          podQrCode: qrCode,
          userId: userId || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setConfirmed(true);
        setConfirmResult(data);

        // Redirect to order status after a short delay
        setTimeout(() => {
          if (data.order?.orderQrCode) {
            router.push(
              `/order/status?orderQrCode=${encodeURIComponent(data.order.orderQrCode)}`
            );
          }
        }, 2000);
      } else {
        setError(data.error || "Failed to confirm arrival");
      }
    } catch (err) {
      console.error("Failed to confirm arrival:", err);
      setError("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E5E5E5",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>
              🍜
            </span>
          </div>
          <div style={{ color: "#666", fontSize: "1.2rem" }}>Loading pod info...</div>
        </div>
      </main>
    );
  }

  if (!qrCode) {
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
            maxWidth: 400,
            width: "100%",
            background: "white",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔍</div>
          <h1 style={{ margin: 0, marginBottom: 8, fontSize: "1.5rem" }}>
            No QR Code Detected
          </h1>
          <p style={{ color: "#666", marginBottom: 24 }}>
            Please scan the QR code on your pod table to check in.
          </p>
          <button
            onClick={() => router.push("/order")}
            style={{
              padding: "12px 24px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Place an Order
          </button>
        </div>
      </main>
    );
  }

  if (error && !podInfo) {
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
            maxWidth: 400,
            width: "100%",
            background: "white",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>❌</div>
          <h1 style={{ margin: 0, marginBottom: 8, fontSize: "1.5rem", color: "#dc2626" }}>
            {error}
          </h1>
          <p style={{ color: "#666", marginBottom: 24 }}>
            The QR code may be invalid or damaged. Please ask staff for assistance.
          </p>
          <button
            onClick={() => router.push("/order")}
            style={{
              padding: "12px 24px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Place an Order
          </button>
        </div>
      </main>
    );
  }

  if (confirmed) {
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
            Welcome to Pod {podInfo?.pod.number}!
          </h1>
          <p style={{ color: "#666", fontSize: "1rem", marginBottom: 16 }}>
            Your order is now being prepared.
          </p>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
            Redirecting to order status...
          </p>
        </div>
      </main>
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
        {/* Pod Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            color: "white",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.9rem", marginBottom: 4, opacity: 0.9 }}>
            {podInfo?.location.name}
          </div>
          <div
            style={{
              fontSize: "3rem",
              fontWeight: "bold",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            POD {podInfo?.pod.number}
          </div>
          <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
            {podInfo?.location.city}
          </div>
        </div>

        {/* Order Info or No Order Message */}
        {podInfo?.hasActiveOrder ? (
          <>
            <div
              style={{
                background: "#f0fdf4",
                border: "2px solid #22c55e",
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🍜</div>
              <h2 style={{ margin: 0, marginBottom: 8, fontSize: "1.2rem", color: "#166534" }}>
                Your Order is Ready to Confirm!
              </h2>
              <p style={{ color: "#15803d", margin: 0, fontSize: "0.9rem" }}>
                Order #{podInfo.activeOrder?.kitchenOrderNumber || podInfo.activeOrder?.orderNumber?.slice(-6)}
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
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleConfirmArrival}
              disabled={confirming}
              style={{
                width: "100%",
                padding: 16,
                background: confirming ? "#e5e7eb" : "#22c55e",
                color: confirming ? "#9ca3af" : "white",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: confirming ? "not-allowed" : "pointer",
                marginBottom: 16,
              }}
            >
              {confirming ? "Confirming..." : "I'm Here - Start My Order!"}
            </button>

            <p
              style={{
                textAlign: "center",
                fontSize: "0.85rem",
                color: "#666",
                margin: 0,
              }}
            >
              Tap the button above to let the kitchen know you've arrived.
            </p>
          </>
        ) : (
          <>
            <div
              style={{
                background: "#fef3c7",
                border: "2px solid #f59e0b",
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🪑</div>
              <h2 style={{ margin: 0, marginBottom: 8, fontSize: "1.2rem", color: "#92400e" }}>
                This Pod is Available!
              </h2>
              <p style={{ color: "#b45309", margin: 0, fontSize: "0.9rem" }}>
                No order is currently assigned to this pod.
              </p>
            </div>

            <div
              style={{
                background: "#f9fafb",
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <h3 style={{ margin: 0, marginBottom: 12, fontSize: "1rem", color: "#111" }}>
                How to get this pod:
              </h3>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  color: "#666",
                  fontSize: "0.9rem",
                  lineHeight: 1.8,
                }}
              >
                <li>Place your order online</li>
                <li>Select this pod during checkout</li>
                <li>Come back here and scan again to confirm</li>
              </ol>
            </div>

            <button
              onClick={() => router.push("/order")}
              style={{
                width: "100%",
                padding: 16,
                background: "#7C7A67",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Place an Order
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function PodPage() {
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
      <PodContent />
    </Suspense>
  );
}
