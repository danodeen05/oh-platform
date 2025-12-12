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

interface Fortune {
  fortune: string;
  luckyNumbers: number[];
  thisDayInHistory: {
    year: number;
    event: string;
  } | null;
  learnChinese: {
    traditional: string;
    pinyin: string;
    english: string;
    category: string;
    funFact: string;
    source: string;
  } | null;
  source: string;
  orderNumber: string;
  customerName: string | null;
}

interface OrderRoast {
  roast: string;
  highlights: string[];
  source: string;
  customerName: string | null;
}

interface OrderCommentary {
  commentary: string | null;
  status: string;
  source: string;
  customerName: string | null;
  podNumber: string | null;
}

interface OrderBackstory {
  backstories: string[];
  source: string;
  customerName: string | null;
}

function StatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderQrCode = searchParams.get("orderQrCode");

  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [fortuneLoading, setFortuneLoading] = useState(false);
  const [fortuneOpened, setFortuneOpened] = useState(false);
  const [roast, setRoast] = useState<OrderRoast | null>(null);
  const [roastLoading, setRoastLoading] = useState(false);
  const [roastOpened, setRoastOpened] = useState(false);
  const [commentary, setCommentary] = useState<OrderCommentary | null>(null);
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [backstory, setBackstory] = useState<OrderBackstory | null>(null);
  const [backstoryLoading, setBackstoryLoading] = useState(false);
  const [backstoryOpened, setBackstoryOpened] = useState(false);
  const [lastCommentaryStatus, setLastCommentaryStatus] = useState<string | null>(null);

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

        // Fetch commentary when status is in active cooking stages
        if (data.order?.status) {
          fetchCommentary(data.order.status);
        }

        // Clear active order from localStorage when completed
        if (data.order?.status === "COMPLETED") {
          localStorage.removeItem("activeOrderQrCode");
        }
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

  // Fetch fortune cookie
  async function fetchFortune() {
    if (!orderQrCode || fortune || fortuneLoading) return;

    setFortuneLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/fortune?orderQrCode=${encodeURIComponent(orderQrCode)}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFortune(data);
      }
    } catch (err) {
      console.error("Failed to fetch fortune:", err);
    } finally {
      setFortuneLoading(false);
    }
  }

  // Fetch order roast
  async function fetchRoast() {
    if (!orderQrCode || roast || roastLoading) return;

    setRoastLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/roast?orderQrCode=${encodeURIComponent(orderQrCode)}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRoast(data);
      }
    } catch (err) {
      console.error("Failed to fetch roast:", err);
    } finally {
      setRoastLoading(false);
    }
  }

  // Fetch live commentary (called when status changes)
  async function fetchCommentary(currentStatus: string) {
    if (!orderQrCode || commentaryLoading) return;
    // Only fetch if status changed and is a commentary-worthy status
    if (!["QUEUED", "PREPPING", "READY", "SERVING"].includes(currentStatus)) return;
    if (currentStatus === lastCommentaryStatus) return;

    setCommentaryLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/commentary?orderQrCode=${encodeURIComponent(orderQrCode)}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCommentary(data);
        setLastCommentaryStatus(currentStatus);
      }
    } catch (err) {
      console.error("Failed to fetch commentary:", err);
    } finally {
      setCommentaryLoading(false);
    }
  }

  // Fetch backstory
  async function fetchBackstory(orderId: string) {
    if (!orderId || backstory || backstoryLoading) return;

    setBackstoryLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/${orderId}/backstory`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBackstory(data);
      }
    } catch (err) {
      console.error("Failed to fetch backstory:", err);
    } finally {
      setBackstoryLoading(false);
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
        return { icon: "✅", label: "Paid", color: "#7C7A67" };
      case "QUEUED":
        return { icon: "⏳", label: "In Queue", color: "#6366f1" };
      case "PREPPING":
        return { icon: "👨‍🍳", label: "Preparing", color: "#f59e0b" };
      case "READY":
        return { icon: "🔔", label: "Ready for Delivery", color: "#7C7A67" };
      case "SERVING":
        return { icon: "🍜", label: "Enjoy Your Meal!", color: "#7C7A67" };
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
                background: "linear-gradient(90deg, #7C7A67 0%, #5a584a 100%)",
                height: "100%",
                width: `${getProgress()}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Live AI Commentary - Shows during active cooking stages */}
          {["QUEUED", "PREPPING", "READY", "SERVING"].includes(order.status) && (
            <div
              style={{
                background: "linear-gradient(135deg, #3d3c35 0%, #2a2924 100%)",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
                border: "1px solid #5a584a",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Animated background effect */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "radial-gradient(circle at 20% 50%, rgba(199, 168, 120, 0.08) 0%, transparent 50%)",
                  animation: "pulse 3s infinite",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>
                    {order.status === "QUEUED" && "⏳"}
                    {order.status === "PREPPING" && "🔥"}
                    {order.status === "READY" && "✨"}
                    {order.status === "SERVING" && "🚀"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: "bold",
                      color: "#C7A878",
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                    }}
                  >
                    Live Kitchen Feed
                  </span>
                </div>

                {commentaryLoading ? (
                  <div
                    style={{
                      color: "#a09a8a",
                      fontSize: "0.95rem",
                      fontStyle: "italic",
                    }}
                  >
                    Listening to the kitchen...
                  </div>
                ) : commentary?.commentary ? (
                  <p
                    style={{
                      color: "#E5E5E5",
                      fontSize: "1rem",
                      margin: 0,
                      lineHeight: 1.6,
                      fontStyle: "italic",
                    }}
                  >
                    "{commentary.commentary}"
                  </p>
                ) : (
                  <p
                    style={{
                      color: "#a09a8a",
                      fontSize: "0.95rem",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    The kitchen is suspiciously quiet. They're up to something.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pod Assignment or Queue Status */}
          {order.podNumber && (
            <div
              style={{
                background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
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
                      color: "#5a584a",
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
                      background: "#7C7A67",
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
                      background: "#7C7A67",
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
                      background: "#7C7A67",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>Order Started</span>
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
                      background: "#7C7A67",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>Order Quality Check</span>
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
                      background: "#7C7A67",
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
              {/* Total Time - from payment to delivery */}
              {order.paidAt && order.deliveredAt && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Total Time</span>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#7C7A67" }}>
                    {(() => {
                      const paidTime = new Date(order.paidAt).getTime();
                      const deliveredTime = new Date(order.deliveredAt).getTime();
                      const totalMinutes = Math.round((deliveredTime - paidTime) / 60000);
                      if (totalMinutes < 60) {
                        return `${totalMinutes} min`;
                      }
                      const hours = Math.floor(totalMinutes / 60);
                      const mins = totalMinutes % 60;
                      return `${hours}h ${mins}m`;
                    })()}
                  </span>
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

        {/* Fortune Cookie - Show after pod check-in to pass time while waiting */}
        {order.podConfirmedAt && (
          <div
            style={{
              background: "linear-gradient(135deg, #f5f5f0 0%, #e8e6dc 100%)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(124, 122, 103, 0.15)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              border: "1px solid #d4d2c7",
            }}
          >
            {!fortuneOpened ? (
              <>
                <div style={{ fontSize: "4rem", marginBottom: 16 }}>
                  🥠
                </div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "1.3rem",
                    color: "#5a584a",
                  }}
                >
                  Your Digital Fortune Cookie
                </h3>
                <p
                  style={{
                    color: "#7C7A67",
                    fontSize: "0.9rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  While you wait, crack open your personalized fortune
                </p>
                <button
                  onClick={() => {
                    setFortuneOpened(true);
                    fetchFortune();
                  }}
                  style={{
                    padding: "12px 32px",
                    background: "#7C7A67",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "1rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(124, 122, 103, 0.3)",
                  }}
                >
                  🥠 Crack It Open
                </button>
              </>
            ) : fortuneLoading ? (
              <>
                <div
                  style={{
                    fontSize: "3rem",
                    marginBottom: 16,
                    animation: "pulse 1s infinite",
                  }}
                >
                  ✨
                </div>
                <p style={{ color: "#5a584a", fontSize: "1rem" }}>
                  Reading your fortune...
                </p>
              </>
            ) : fortune ? (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>
                  🥠✨
                </div>

                {/* Fortune Message */}
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                    border: "1px solid #e8e6dc",
                  }}
                >
                  <p
                    style={{
                      fontStyle: "italic",
                      fontSize: "1.1rem",
                      color: "#3d3c35",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    "{fortune.fortune}"
                  </p>
                </div>

                {/* Lucky Numbers */}
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      color: "#5a584a",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Lucky Numbers
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {fortune.luckyNumbers.map((num, i) => (
                      <span
                        key={i}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#7C7A67",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                          fontSize: "0.9rem",
                        }}
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                </div>

                {/* This Day in History */}
                {fortune.thisDayInHistory && (
                  <div
                    style={{
                      background: "rgba(124, 122, 103, 0.1)",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: "0.85rem",
                      color: "#5a584a",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: 4,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      📜 This Day in History ({fortune.thisDayInHistory.year})
                    </div>
                    <div style={{ lineHeight: 1.5 }}>
                      {fortune.thisDayInHistory.event}
                    </div>
                  </div>
                )}

                {/* Learn Chinese */}
                {fortune.learnChinese && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                      borderRadius: 12,
                      padding: 16,
                      marginTop: 16,
                      color: "white",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Decorative background pattern */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "30%",
                        background: "rgba(255,255,255,0.05)",
                        clipPath: "polygon(30% 0, 100% 0, 100% 100%, 0% 100%)",
                      }}
                    />

                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: 12,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        opacity: 0.9,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      📖 Learn Chinese
                    </div>

                    {/* Main Chinese Character(s) with audio button */}
                    <button
                      onClick={() => {
                        if ('speechSynthesis' in window) {
                          const utterance = new SpeechSynthesisUtterance(fortune.learnChinese!.traditional);
                          utterance.lang = 'zh-TW';
                          utterance.rate = 0.8;
                          // Try to find a Chinese voice
                          const voices = speechSynthesis.getVoices();
                          const chineseVoice = voices.find(v =>
                            v.lang.startsWith('zh') || v.lang.includes('Chinese')
                          );
                          if (chineseVoice) {
                            utterance.voice = chineseVoice;
                          }
                          speechSynthesis.speak(utterance);
                        }
                      }}
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderRadius: 12,
                        padding: "16px 24px",
                        width: "100%",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 16,
                        marginBottom: 12,
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.25)";
                        e.currentTarget.style.transform = "scale(1.02)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                      title="Tap to hear pronunciation"
                    >
                      <span
                        style={{
                          fontSize: "2.5rem",
                          fontWeight: "bold",
                          color: "white",
                          textShadow: "2px 2px 4px rgba(0,0,0,0.2)",
                        }}
                      >
                        {fortune.learnChinese.traditional}
                      </span>
                      <span
                        style={{
                          fontSize: "1.5rem",
                          opacity: 0.9,
                        }}
                      >
                        🔊
                      </span>
                    </button>

                    {/* Pinyin and English */}
                    <div style={{ textAlign: "center", marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "600",
                          marginBottom: 4,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {fortune.learnChinese.pinyin}
                      </div>
                      <div
                        style={{
                          fontSize: "0.95rem",
                          opacity: 0.9,
                        }}
                      >
                        {fortune.learnChinese.english}
                      </div>
                    </div>

                    {/* Fun Fact */}
                    <div
                      style={{
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 8,
                        padding: 10,
                        fontSize: "0.8rem",
                        lineHeight: 1.5,
                        opacity: 0.95,
                      }}
                    >
                      <span style={{ marginRight: 6 }}>💡</span>
                      {fortune.learnChinese.funFact}
                    </div>

                    {/* Category badge */}
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          background: "rgba(255,255,255,0.2)",
                          padding: "4px 12px",
                          borderRadius: 12,
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {fortune.learnChinese.category}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🥠</div>
                <p style={{ color: "#7C7A67", fontSize: "0.9rem" }}>
                  Fortune unavailable - but your meal is still going to be amazing!
                </p>
              </>
            )}
          </div>
        )}

        {/* Order Roast - Sarcastic analysis of their choices */}
        {order.podConfirmedAt && (
          <div
            style={{
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.2)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              border: "1px solid #fcd34d",
            }}
          >
            {!roastOpened ? (
              <>
                <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>
                  🔥
                </div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "1.2rem",
                    color: "#92400e",
                  }}
                >
                  The Roast Zone
                </h3>
                <p
                  style={{
                    color: "#b45309",
                    fontSize: "0.85rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  Want our brutally honest (and hilarious) take on your order choices?
                </p>
                <button
                  onClick={() => {
                    setRoastOpened(true);
                    fetchRoast();
                  }}
                  style={{
                    padding: "12px 28px",
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "0.95rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(245, 158, 11, 0.4)",
                  }}
                >
                  🔥 Roast My Order
                </button>
              </>
            ) : roastLoading ? (
              <>
                <div
                  style={{
                    fontSize: "3rem",
                    marginBottom: 16,
                    animation: "pulse 1s infinite",
                  }}
                >
                  🤔
                </div>
                <p style={{ color: "#92400e", fontSize: "1rem" }}>
                  Analyzing your life choices...
                </p>
              </>
            ) : roast ? (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>
                  🔥😏
                </div>

                {/* Roast Message */}
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 12,
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                    border: "1px solid #fde68a",
                  }}
                >
                  <p
                    style={{
                      fontSize: "1.05rem",
                      color: "#78350f",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {roast.roast}
                  </p>
                </div>

                {/* Roast Highlights */}
                {roast.highlights && roast.highlights.length > 0 && (
                  <div
                    style={{
                      background: "rgba(146, 64, 14, 0.1)",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: "0.8rem",
                      color: "#92400e",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: 6,
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      🎯 What caught our attention:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
                      {roast.highlights.map((highlight, i) => (
                        <li key={i}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🔥</div>
                <p style={{ color: "#b45309", fontSize: "0.9rem" }}>
                  Our roast chef is on break. Your order is probably fine. Probably.
                </p>
              </>
            )}
          </div>
        )}

        {/* Behind the Scenes - Ingredient Backstories */}
        {order.podConfirmedAt && ["PREPPING", "READY", "SERVING"].includes(order.status) && (
          <div
            style={{
              background: "linear-gradient(135deg, #C7A878 0%, #a8895d 100%)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(199, 168, 120, 0.3)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              border: "1px solid #d4b88a",
            }}
          >
            {!backstoryOpened ? (
              <>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>
                  🎬
                </div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "1.2rem",
                    color: "#2a2924",
                  }}
                >
                  Behind the Scenes
                </h3>
                <p
                  style={{
                    color: "#3d3c35",
                    fontSize: "0.85rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  Ever wonder about the secret lives of your ingredients?
                </p>
                <button
                  onClick={() => {
                    setBackstoryOpened(true);
                    fetchBackstory(order.id);
                  }}
                  style={{
                    padding: "12px 28px",
                    background: "linear-gradient(135deg, #3d3c35 0%, #222222 100%)",
                    color: "#E5E5E5",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "0.95rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(34, 34, 34, 0.3)",
                  }}
                >
                  🎬 Tell Me Everything
                </button>
              </>
            ) : backstoryLoading ? (
              <>
                <div
                  style={{
                    fontSize: "3rem",
                    marginBottom: 16,
                    animation: "pulse 1s infinite",
                  }}
                >
                  🎬
                </div>
                <p style={{ color: "#3d3c35", fontSize: "1rem" }}>
                  Digging up the dirt...
                </p>
              </>
            ) : backstory && backstory.backstories.length > 0 ? (
              <>
                <div style={{ fontSize: "2rem", marginBottom: 16 }}>
                  🎬✨
                </div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 16,
                    fontSize: "1rem",
                    color: "#2a2924",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  The Untold Stories
                </h3>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    textAlign: "left",
                  }}
                >
                  {backstory.backstories.map((story, i) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.25)",
                        borderRadius: 10,
                        padding: 14,
                        borderLeft: "3px solid #3d3c35",
                      }}
                    >
                      <p
                        style={{
                          color: "#2a2924",
                          fontSize: "0.9rem",
                          margin: 0,
                          lineHeight: 1.6,
                        }}
                      >
                        {story}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🎬</div>
                <p style={{ color: "#3d3c35", fontSize: "0.9rem" }}>
                  The ingredients prefer to remain anonymous. Mysterious bunch.
                </p>
              </>
            )}
          </div>
        )}

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
                background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(124, 122, 103, 0.4)",
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
