"use client";
import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type Pod = {
  id: string;
  number: string;
  qrCode: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  locationId: string;
  createdAt: string;
  orders?: Array<{
    id: string;
    kitchenOrderNumber?: string;
    orderNumber: string;
    status: string;
    podConfirmedAt?: string;
    items?: Array<{
      quantity: number;
      menuItem: { name: string };
    }>;
    user?: {
      id: string;
      name?: string;
      membershipTier?: "CHOPSTICK" | "NOODLE_MASTER" | "BEEF_BOSS";
    };
    guest?: {
      id: string;
      name: string;
    };
  }>;
};

// Helper to get tier emoji
function getTierEmoji(tier?: string): string {
  switch (tier) {
    case "BEEF_BOSS":
      return "🥩";
    case "NOODLE_MASTER":
      return "🍜";
    case "CHOPSTICK":
    default:
      return "🥢";
  }
}

// Helper to check if VIP
function isVIP(tier?: string): boolean {
  return tier === "BEEF_BOSS";
}

// Helper to get customer name from order (user or guest)
function getCustomerName(order: Pod["orders"][0] | undefined): string | null {
  if (!order) return null;
  if (order.user?.name) return order.user.name;
  if (order.guest?.name) return order.guest.name;
  return null;
}

type Location = {
  id: string;
  name: string;
};

function TimeInPod({ podConfirmedAt }: { podConfirmedAt?: string }) {
  const [timeString, setTimeString] = useState("");
  const [timeColor, setTimeColor] = useState("#ffffff");

  useEffect(() => {
    if (!podConfirmedAt) {
      setTimeString("--:--");
      setTimeColor("#9ca3af");
      return;
    }

    const updateTime = () => {
      const now = new Date().getTime();
      const confirmed = new Date(podConfirmedAt).getTime();
      const diff = Math.floor((now - confirmed) / 1000); // seconds

      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;

      setTimeString(
        `${minutes}:${seconds.toString().padStart(2, "0")}`
      );

      // Set color based on time thresholds
      if (minutes >= 20) {
        setTimeColor("#ef4444"); // Red for 20+ minutes
      } else if (minutes >= 15) {
        setTimeColor("#f59e0b"); // Orange for 15-20 minutes
      } else {
        setTimeColor("#ffffff"); // White for < 15 minutes
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [podConfirmedAt]);

  return <span style={{ color: timeColor }}>{timeString}</span>;
}

export default function PodsManager({ locations }: { locations: Location[] }) {
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgCleaningTime, setAvgCleaningTime] = useState({
    averageSeconds: 0,
    averageMinutes: 0,
    count: 0,
  });

  async function loadPods() {
    if (!selectedLocation) return;

    try {
      setLoading(true);

      if (selectedLocation === "all") {
        // Fetch pods from all locations
        const allPods: Pod[] = [];
        for (const loc of locations) {
          const response = await fetch(`${BASE}/locations/${loc.id}/seats`, {
            headers: { "x-tenant-slug": "oh" },
          });
          const data = await response.json();
          allPods.push(...data);
        }
        setPods(allPods);
      } else {
        const response = await fetch(`${BASE}/locations/${selectedLocation}/seats`, {
          headers: { "x-tenant-slug": "oh" },
        });
        const data = await response.json();
        setPods(data);
      }
    } catch (error) {
      console.error("Failed to load pods:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAvgCleaningTime() {
    try {
      const params = new URLSearchParams();
      if (selectedLocation !== "all") {
        params.append("locationId", selectedLocation);
      }
      const queryString = params.toString();
      const response = await fetch(
        `${BASE}/cleaning/average-time${queryString ? `?${queryString}` : ""}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );
      const data = await response.json();
      setAvgCleaningTime(data);
    } catch (error) {
      console.error("Failed to load average cleaning time:", error);
    }
  }

  useEffect(() => {
    loadPods();
    loadAvgCleaningTime();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      loadPods();
      loadAvgCleaningTime();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedLocation]);

  async function startCleaning(podId: string, orderId: string) {
    try {
      // First, mark the order as COMPLETED
      await fetch(`${BASE}/kitchen/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      // Pod status will automatically be set to CLEANING by the API
      loadPods();
    } catch (error) {
      console.error("Failed to start cleaning:", error);
    }
  }

  async function markClean(podId: string) {
    try {
      const response = await fetch(`${BASE}/seats/${podId}/clean`, {
        method: "PATCH",
        headers: {
          "x-tenant-slug": "oh",
        },
      });

      if (response.ok) {
        loadPods();
      } else {
        const error = await response.json();
        console.error("Failed to mark pod clean:", error);
        alert(`Failed to mark pod clean: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to mark pod as clean:", error);
      alert(`Error: ${error}`);
    }
  }

  async function confirmArrival(orderId: string) {
    try {
      // Set podConfirmedAt to confirm customer has arrived at pod
      await fetch(`${BASE}/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ podConfirmedAt: new Date().toISOString() }),
      });

      // Also move the order to PREPPING status
      await fetch(`${BASE}/kitchen/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ status: "PREPPING" }),
      });

      loadPods();
    } catch (error) {
      console.error("Failed to confirm arrival:", error);
    }
  }

  const selectedLocationName =
    selectedLocation === "all"
      ? "All Locations"
      : locations.find((l) => l.id === selectedLocation)?.name || "Unknown";

  // Calculate color for average cleaning time
  const getCleaningTimeColor = () => {
    const mins = avgCleaningTime.averageMinutes;
    if (mins >= 5) return "#ef4444"; // Red for 5+ minutes
    if (mins >= 3) return "#f59e0b"; // Orange for 3-5 minutes
    return "#22c55e"; // Green for < 3 minutes
  };

  // Format average time as M:SS
  const formatAvgTime = () => {
    const minutes = Math.floor(avgCleaningTime.averageSeconds / 60);
    const seconds = avgCleaningTime.averageSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const statusColors = {
    AVAILABLE: { bg: "#22c55e", label: "Available" },
    OCCUPIED: { bg: "#ef4444", label: "Occupied" },
    RESERVED: { bg: "#f59e0b", label: "Reserved" },
    CLEANING: { bg: "#3b82f6", label: "Cleaning" },
  };

  const podsByStatus = {
    OCCUPIED: pods
      .filter((p) => p.status === "OCCUPIED")
      .sort((a, b) => {
        // Sort by longest time in pod first (oldest podConfirmedAt first)
        const aTime = a.orders?.[0]?.podConfirmedAt
          ? new Date(a.orders[0].podConfirmedAt).getTime()
          : Date.now();
        const bTime = b.orders?.[0]?.podConfirmedAt
          ? new Date(b.orders[0].podConfirmedAt).getTime()
          : Date.now();
        return aTime - bTime; // Oldest first (longest time in pod)
      }),
    CLEANING: pods.filter((p) => p.status === "CLEANING"),
    AVAILABLE: pods.filter((p) => p.status === "AVAILABLE"),
    RESERVED: pods.filter((p) => p.status === "RESERVED"),
  };

  return (
    <div>
      {/* Location Selector */}
      <div
        style={{
          background: "#1f2937",
          padding: "16px 24px",
          borderBottom: "1px solid #374151",
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <label style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
          Location:
        </label>
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          style={{
            padding: "8px 16px",
            background: "#111827",
            color: "white",
            border: "1px solid #374151",
            borderRadius: 8,
            fontSize: "1rem",
          }}
        >
          <option value="all">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        {/* Average Cleaning Time */}
        <div style={{ marginLeft: "auto", textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 4 }}>
            Average Cleaning Time for Today
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: getCleaningTimeColor() }}>
            {avgCleaningTime.count > 0 ? formatAvgTime() : "--:--"}
          </div>
          {avgCleaningTime.count > 0 && (
            <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
              ({avgCleaningTime.count} completed)
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#f59e0b" }}
            >
              {podsByStatus.RESERVED.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>ARRIVING</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#ef4444" }}
            >
              {podsByStatus.OCCUPIED.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>OCCUPIED</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#3b82f6" }}
            >
              {podsByStatus.CLEANING.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>CLEANING</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#22c55e" }}
            >
              {podsByStatus.AVAILABLE.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>AVAILABLE</div>
          </div>
        </div>
      </div>

      {/* Pods Columns */}
      <div style={{ padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
            Loading pods...
          </div>
        ) : pods.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
            No pods configured for {selectedLocationName}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
            }}
          >
            {/* Arriving/Reserved Column */}
            <div>
              <div
                style={{
                  background: "#f59e0b20",
                  color: "#f59e0b",
                  padding: 12,
                  borderRadius: 8,
                  fontWeight: "bold",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                ARRIVING ({podsByStatus.RESERVED.length})
              </div>
              {podsByStatus.RESERVED.map((pod) => {
                const currentOrder = pod.orders?.[0];
                const customerIsVIP = isVIP(currentOrder?.user?.membershipTier);
                const tierEmoji = getTierEmoji(currentOrder?.user?.membershipTier);

                return (
                  <div
                    key={pod.id}
                    style={{
                      background: customerIsVIP ? "#2d1f1f" : "#1f2937",
                      border: customerIsVIP ? "2px solid #dc2626" : "2px solid #f59e0b",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      boxShadow: customerIsVIP
                        ? "0 0 15px rgba(220, 38, 38, 0.5), 0 0 30px rgba(220, 38, 38, 0.3)"
                        : "none",
                      position: "relative" as const,
                    }}
                  >
                    {/* Tier Emoji Badge (Top Right) */}
                    {currentOrder?.user && (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          fontSize: "1.5rem",
                          filter: customerIsVIP ? "drop-shadow(0 0 4px rgba(220, 38, 38, 0.8))" : "none",
                        }}
                        title={`${currentOrder.user.membershipTier || "CHOPSTICK"} tier`}
                      >
                        {tierEmoji}
                      </div>
                    )}

                    {/* Arriving Banner */}
                    <div
                      style={{
                        background: customerIsVIP ? "#dc2626" : "#f59e0b",
                        color: customerIsVIP ? "#fff" : "#000",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        textAlign: "center",
                        marginBottom: 12,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                      }}
                    >
                      {customerIsVIP ? "🥩 VIP Arriving" : "⏳ Customer Arriving"}
                    </div>

                    {/* Pod Number */}
                    <div
                      style={{
                        fontSize: "2rem",
                        fontWeight: "bold",
                        textAlign: "center",
                        marginBottom: 8,
                        color: customerIsVIP ? "#dc2626" : "#f59e0b",
                      }}
                    >
                      Pod {pod.number}
                    </div>

                    {/* Order Number */}
                    {currentOrder && (
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "#9ca3af",
                          textAlign: "center",
                          marginBottom: 4,
                        }}
                      >
                        Order #{currentOrder.kitchenOrderNumber || currentOrder.orderNumber?.slice(-6)}
                      </div>
                    )}

                    {/* Customer Name */}
                    {getCustomerName(currentOrder) && (
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "#d1d5db",
                          textAlign: "center",
                          marginBottom: 12,
                        }}
                      >
                        {getCustomerName(currentOrder)}
                      </div>
                    )}

                    {/* Confirm Arrival Button */}
                    {currentOrder && (
                      <button
                        onClick={() => confirmArrival(currentOrder.id)}
                        style={{
                          width: "100%",
                          padding: 12,
                          background: "#f59e0b",
                          color: "#000",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: "bold",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                      >
                        Confirm Arrival
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Occupied Column */}
            <div>
              <div
                style={{
                  background: "#ef444420",
                  color: "#ef4444",
                  padding: 12,
                  borderRadius: 8,
                  fontWeight: "bold",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                OCCUPIED ({podsByStatus.OCCUPIED.length})
              </div>
              {podsByStatus.OCCUPIED.map((pod) => {
                const currentOrder = pod.orders?.[0];

                // Map status to readable text and colors
                const statusMap: Record<string, string> = {
                  QUEUED: "Queued",
                  PREPPING: "Preparing",
                  READY: "Ready",
                  SERVING: "Serving",
                };
                const statusColors: Record<string, string> = {
                  QUEUED: "#f59e0b",    // Orange (matches Kitchen Display)
                  PREPPING: "#3b82f6",  // Blue (matches Kitchen Display)
                  READY: "#22c55e",     // Green (matches Kitchen Display)
                  SERVING: "#8b5cf6",   // Purple (matches Kitchen Display)
                };
                const statusText = currentOrder?.status
                  ? statusMap[currentOrder.status] || currentOrder.status
                  : "Unknown";
                const statusColor = currentOrder?.status
                  ? statusColors[currentOrder.status] || "#9ca3af"
                  : "#9ca3af";

                // Check if customer is VIP
                const customerIsVIP = isVIP(currentOrder?.user?.membershipTier);
                const tierEmoji = getTierEmoji(currentOrder?.user?.membershipTier);

                return (
                  <div
                    key={pod.id}
                    style={{
                      background: customerIsVIP ? "#2d1f1f" : "#1f2937",
                      border: customerIsVIP ? "2px solid #dc2626" : "2px solid #374151",
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 12,
                      boxShadow: customerIsVIP
                        ? "0 0 15px rgba(220, 38, 38, 0.5), 0 0 30px rgba(220, 38, 38, 0.3)"
                        : "none",
                      position: "relative" as const,
                    }}
                  >
                    {/* Tier Emoji Badge (Top Right) */}
                    {currentOrder?.user && (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          fontSize: "1.5rem",
                          filter: customerIsVIP ? "drop-shadow(0 0 4px rgba(220, 38, 38, 0.8))" : "none",
                        }}
                        title={`${currentOrder.user.membershipTier || "CHOPSTICK"} tier`}
                      >
                        {tierEmoji}
                      </div>
                    )}

                    {/* Pod Number - Large */}
                    <div
                      style={{
                        fontSize: "2.5rem",
                        fontWeight: "bold",
                        textAlign: "center",
                        marginBottom: 16,
                        color: customerIsVIP ? "#dc2626" : "#ffffff",
                      }}
                    >
                      Pod {pod.number}
                    </div>

                    {/* Customer Name */}
                    {getCustomerName(currentOrder) && (
                      <div
                        style={{
                          fontSize: "1rem",
                          color: "#d1d5db",
                          textAlign: "center",
                          marginBottom: 8,
                        }}
                      >
                        {getCustomerName(currentOrder)}
                      </div>
                    )}

                    {/* Order Status */}
                    <div
                      style={{
                        fontSize: "1rem",
                        color: "#9ca3af",
                        textAlign: "center",
                        marginBottom: 8,
                      }}
                    >
                      Status:{" "}
                      <span
                        style={{
                          color: statusColor,
                          fontWeight: "bold",
                        }}
                      >
                        {statusText}
                      </span>
                    </div>

                    {/* Time in Pod */}
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        textAlign: "center",
                        marginBottom: 16,
                        fontFamily: "monospace",
                      }}
                    >
                      <TimeInPod podConfirmedAt={currentOrder?.podConfirmedAt} />
                    </div>

                    {/* Action Button */}
                    {currentOrder && (
                      <button
                        onClick={() => startCleaning(pod.id, currentOrder.id)}
                        style={{
                          width: "100%",
                          padding: 16,
                          background: currentOrder.status === "SERVING" ? "#3b82f6" : "#6b7280",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: "bold",
                          cursor: "pointer",
                          fontSize: "1rem",
                        }}
                      >
                        {currentOrder.status === "SERVING"
                          ? "🧹 Customer Left - Start Cleaning"
                          : "🧹 Ready to Clean"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cleaning Column */}
            <div>
              <div
                style={{
                  background: "#3b82f620",
                  color: "#3b82f6",
                  padding: 12,
                  borderRadius: 8,
                  fontWeight: "bold",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                CLEANING ({podsByStatus.CLEANING.length})
              </div>
              {podsByStatus.CLEANING.map((pod) => (
                <div
                  key={pod.id}
                  style={{
                    background: "#1f2937",
                    border: "2px solid #374151",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  {/* Pod Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: "bold",
                      }}
                    >
                      Pod {pod.number}
                    </div>
                    <div
                      style={{
                        background: "#3b82f620",
                        color: "#3b82f6",
                        padding: "4px 12px",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                      }}
                    >
                      Cleaning
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => markClean(pod.id)}
                    style={{
                      width: "100%",
                      padding: 16,
                      background: "#22c55e",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    ✓ Cleaning Complete
                  </button>
                </div>
              ))}
            </div>

            {/* Available Column */}
            <div>
              <div
                style={{
                  background: "#22c55e20",
                  color: "#22c55e",
                  padding: 12,
                  borderRadius: 8,
                  fontWeight: "bold",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                AVAILABLE ({podsByStatus.AVAILABLE.length})
              </div>
              {podsByStatus.AVAILABLE.map((pod) => (
                <div
                  key={pod.id}
                  style={{
                    background: "#1f2937",
                    border: "2px solid #374151",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  {/* Pod Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: "bold",
                      }}
                    >
                      Pod {pod.number}
                    </div>
                    <div
                      style={{
                        background: "#22c55e20",
                        color: "#22c55e",
                        padding: "4px 12px",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                      }}
                    >
                      Available
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
