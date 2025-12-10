"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface OrderStatus {
  order: {
    id: string;
    orderNumber: string;
    kitchenOrderNumber: string | null;
    orderQrCode: string;
    status: string;
    totalCents: number;
    estimatedArrival: string | null;
    paidAt: string | null;
    arrivedAt: string | null;
    queuedAt: string | null;
    prepStartTime: string | null;
    readyTime: string | null;
    deliveredAt: string | null;
    completedTime: string | null;
    podNumber: string | null;
    podAssignedAt: string | null;
    podConfirmedAt: string | null;
    queuePosition: number | null;
    estimatedWaitMinutes: number | null;
    location: {
      id: string;
      name: string;
      city: string;
    };
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      selectedValue: string | null;
      priceCents: number;
    }>;
  };
}

function StatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderQrCode = searchParams.get("orderQrCode");

  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch order status
  async function fetchStatus() {
    if (!orderQrCode) return;

    try {
      const response = await fetch(
        `${BASE}/orders/status?orderQrCode=${encodeURIComponent(orderQrCode)}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
      } else {
        setError("Order not found");
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
      setError("Failed to load order status");
    } finally {
      setLoading(false);
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [orderQrCode]);

  // Poll every 5 seconds
  useEffect(() => {
    if (!orderQrCode) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [orderQrCode]);

  if (!orderQrCode) {
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
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#111" }}>No order code provided</h1>
          <button
            onClick={() => router.push("/order")}
            style={{
              marginTop: 20,
              padding: "12px 24px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Place New Order
          </button>
        </div>
      </main>
    );
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
          <div
            style={{
              fontSize: "3rem",
              marginBottom: 16,
            }}
          >
            ⏳
          </div>
          <div style={{ color: "#666", fontSize: "1.2rem" }}>
            Loading order status...
          </div>
        </div>
      </main>
    );
  }

  if (error || !status) {
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
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#111" }}>{error || "Order not found"}</h1>
          <button
            onClick={() => router.push("/order")}
            style={{
              marginTop: 20,
              padding: "12px 24px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Place New Order
          </button>
        </div>
      </main>
    );
  }

  const order = status.order;

  // Status display logic
  const getStatusDisplay = () => {
    switch (order.status) {
      case "PENDING_PAYMENT":
        return { icon: "💳", label: "Pending Payment", color: "#f59e0b" };
      case "PAID":
        return { icon: "✅", label: "Paid", color: "#10b981" };
      case "QUEUED":
        return { icon: "⏳", label: "In Queue", color: "#6366f1" };
      case "PREPPING":
        return { icon: "👨‍🍳", label: "Preparing", color: "#f59e0b" };
      case "READY":
        return { icon: "🔔", label: "Ready for Delivery", color: "#10b981" };
      case "SERVING":
        return { icon: "🍜", label: "Enjoy Your Meal!", color: "#10b981" };
      case "COMPLETED":
        return { icon: "🎉", label: "Completed", color: "#6b7280" };
      default:
        return { icon: "❓", label: order.status, color: "#6b7280" };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Progress calculation
  const getProgress = () => {
    const statuses = ["PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"];
    const currentIndex = statuses.indexOf(order.status);
    if (currentIndex === -1) return 0;
    return ((currentIndex + 1) / statuses.length) * 100;
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#E5E5E5",
        padding: 24,
        paddingTop: 40,
      }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: "4rem", marginBottom: 12 }}>
              {statusDisplay.icon}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.8rem",
                color: statusDisplay.color,
                marginBottom: 8,
              }}
            >
              {statusDisplay.label}
            </h1>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>
              Order #{order.kitchenOrderNumber || order.orderNumber}
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              background: "#e5e7eb",
              height: 8,
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                height: "100%",
                width: `${getProgress()}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Pod Assignment or Queue Status */}
          {order.podNumber && (
            <div
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: 12,
                padding: 20,
                color: "white",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: 4 }}>
                Your Pod
              </div>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  letterSpacing: "0.1em",
                }}
              >
                POD {order.podNumber}
              </div>
              {!order.podConfirmedAt ? (
                <>
                  <div style={{ fontSize: "0.85rem", marginTop: 8, opacity: 0.9 }}>
                    Go to your pod and confirm arrival
                  </div>
                  <button
                    onClick={() =>
                      router.push(
                        `/order/scan?orderQrCode=${encodeURIComponent(order.orderQrCode)}`
                      )
                    }
                    style={{
                      marginTop: 12,
                      padding: "10px 20px",
                      background: "white",
                      color: "#667eea",
                      border: "none",
                      borderRadius: 8,
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    🪑 Confirm I'm At My Pod
                  </button>
                </>
              ) : (
                <div style={{ fontSize: "0.85rem", marginTop: 8, opacity: 0.9 }}>
                  ✓ You're checked in!
                </div>
              )}
            </div>
          )}

          {order.queuePosition && !order.podNumber && (
            <div
              style={{
                background: "#fef3c7",
                borderRadius: 12,
                padding: 20,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: "0.9rem", color: "#92400e", marginBottom: 4 }}>
                Queue Position
              </div>
              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: "bold",
                  color: "#92400e",
                }}
              >
                #{order.queuePosition}
              </div>
              {order.estimatedWaitMinutes && (
                <div style={{ fontSize: "0.9rem", color: "#92400e", marginTop: 8 }}>
                  Estimated wait: {order.estimatedWaitMinutes} minutes
                </div>
              )}
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#92400e",
                  marginTop: 12,
                  opacity: 0.8,
                }}
              >
                We'll notify you when a pod is ready!
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: "bold",
                color: "#7C7A67",
                marginBottom: 12,
              }}
            >
              Order Timeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {order.paidAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>Paid</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.paidAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {order.arrivedAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>Checked In</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.arrivedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {order.prepStartTime && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>Cooking Started</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.prepStartTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {order.readyTime && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>Ready</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.readyTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {order.deliveredAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>Delivered</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.deliveredAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: "bold",
              color: "#7C7A67",
              marginBottom: 8,
            }}
          >
            Location
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 500 }}>
            {order.location.name}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>
            {order.location.city}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "grid", gap: 12 }}>
          {/* Show "I'm Done Eating" button when order is SERVING */}
          {order.status === "SERVING" && (
            <button
              onClick={async () => {
                if (confirm("Are you finished eating? This will notify staff to clean your pod.")) {
                  try {
                    await fetch(`${BASE}/kitchen/orders/${order.id}/status`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        "x-tenant-slug": "oh",
                      },
                      body: JSON.stringify({ status: "COMPLETED" }),
                    });
                    fetchStatus(); // Refresh status immediately
                  } catch (error) {
                    console.error("Failed to mark as done:", error);
                    alert("Failed to update status. Please try again.");
                  }
                }
              }}
              style={{
                width: "100%",
                padding: 16,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
              }}
            >
              ✓ I'm Done Eating
            </button>
          )}

          <button
            onClick={() => router.push("/member")}
            style={{
              width: "100%",
              padding: 14,
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            View My Profile
          </button>

          <button
            onClick={() => router.push("/order")}
            style={{
              width: "100%",
              padding: 14,
              background: "white",
              color: "#7C7A67",
              border: "2px solid #7C7A67",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Order Again
          </button>
        </div>

        {/* Auto-refresh indicator */}
        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: "0.75rem",
            color: "#999",
          }}
        >
          Status updates automatically every 5 seconds
        </div>
      </div>
    </main>
  );
}

export default function OrderStatusPage() {
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
      <StatusContent />
    </Suspense>
  );
}
