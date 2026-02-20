"use client";
import { useState, useEffect, useCallback } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

// CNY Party 2026 location ID
const CNY_PARTY_LOCATION_ID = "cny-party-2026";

type CnyStats = {
  totalRsvps: number;
  ordersPlaced: number;
  notOrdered: Array<{ name: string; phone: string }>;
};

type Order = {
  id: string;
  orderNumber: string;
  kitchenOrderNumber?: string;
  status: string;
  totalCents: number;
  createdAt: string;
  estimatedArrival?: string;
  prepStartTime?: string;
  fulfillmentType: string;
  orderSource?: string; // EVENT for CNY orders
  guestName?: string; // Guest name directly on order
  guestZodiac?: string; // Zodiac animal for CNY orders (e.g., "Rabbit", "Dragon")
  arrivedAt?: string; // When customer checked in at kiosk
  podConfirmedAt?: string; // When customer confirmed arrival at pod
  parentOrderId?: string; // If this is an add-on order
  addOnType?: "PAID_ADDON" | "REFILL" | "EXTRA_VEG" | "DESSERT_READY"; // Type of add-on order
  items: Array<{
    id: string;
    quantity: number;
    selectedValue?: string;
    menuItem: {
      name: string;
      categoryType?: string;
    };
  }>;
  seat?: {
    number: string;
  };
  location: {
    name: string;
  };
  user?: {
    id: string;
    name?: string;
    membershipTier?: "CHOPSTICK" | "NOODLE_MASTER" | "BEEF_BOSS";
  };
  guest?: {
    id: string;
    name: string;
  };
};

type PodCall = {
  id: string;
  orderId: string;
  seatId: string;
  locationId: string;
  reason: "GENERAL" | "REFILL" | "ASSISTANCE" | "CHECK" | "CLEANUP";
  status: "PENDING" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  createdAt: string;
  acknowledgedAt?: string;
  seat: {
    number: string;
  };
  order: {
    id: string;
    orderNumber: string;
    kitchenOrderNumber?: string;
  };
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
function getCustomerName(order: Order): string | null {
  if (order.user?.name) return order.user.name;
  if (order.guest?.name) return order.guest.name;
  return null;
}

// Helper to get add-on type colors
function getAddOnTypeStyle(addOnType?: string): { bg: string; border: string; label: string; emoji: string } {
  switch (addOnType) {
    case "PAID_ADDON":
      return { bg: "#451a03", border: "#f59e0b", label: "Add-On Order", emoji: "🛒" };
    case "REFILL":
      return { bg: "#0c1f3f", border: "#3b82f6", label: "Drink Refill", emoji: "🥤" };
    case "EXTRA_VEG":
      return { bg: "#052e16", border: "#22c55e", label: "Extra Vegetables", emoji: "🥬" };
    case "DESSERT_READY":
      return { bg: "#4a1942", border: "#ec4899", label: "Ready for Dessert", emoji: "🍨" };
    default:
      return { bg: "#1f2937", border: "#374151", label: "", emoji: "" };
  }
}

// Helper to get pod call reason display
function getPodCallReasonDisplay(reason: string): { label: string; emoji: string } {
  switch (reason) {
    case "REFILL":
      return { label: "Drink Refill", emoji: "🥤" };
    case "ASSISTANCE":
      return { label: "Need Help", emoji: "❓" };
    case "CHECK":
      return { label: "Request Check", emoji: "💳" };
    case "CLEANUP":
      return { label: "Cleanup Needed", emoji: "🧹" };
    case "GENERAL":
    default:
      return { label: "Call Staff", emoji: "🔔" };
  }
}

export default function KitchenDisplay({ locations }: { locations: any[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [podCalls, setPodCalls] = useState<PodCall[]>([]);
  const [stats, setStats] = useState({
    queued: 0,
    prepping: 0,
    ready: 0,
    serving: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [avgProcessingTime, setAvgProcessingTime] = useState({
    averageSeconds: 0,
    averageMinutes: 0,
    count: 0,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cnyStats, setCnyStats] = useState<CnyStats | null>(null);
  const [showNotOrderedModal, setShowNotOrderedModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Check if CNY Party 2026 is selected
  const isCnyPartySelected = selectedLocation === CNY_PARTY_LOCATION_ID;

  // Update time on client only to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  async function loadOrders() {
    try {
      const params = new URLSearchParams({ status: "active" });
      if (selectedLocation !== "all") {
        params.append("locationId", selectedLocation);
      }

      const response = await fetch(
        `${BASE}/kitchen/orders?${params.toString()}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );
      const data = await response.json();

      // Ensure data is always an array
      setOrders(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load orders:", error);
      setOrders([]); // Set empty array on error
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const params = new URLSearchParams();
      if (selectedLocation !== "all") {
        params.append("locationId", selectedLocation);
      }

      const queryString = params.toString();
      const response = await fetch(
        `${BASE}/kitchen/stats${queryString ? `?${queryString}` : ""}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );
      const data = await response.json();

      // Ensure stats has default values
      setStats({
        queued: data.queued || 0,
        prepping: data.prepping || 0,
        ready: data.ready || 0,
        serving: data.serving || 0,
        total: data.total || 0,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
      setStats({ queued: 0, prepping: 0, ready: 0, serving: 0, total: 0 });
    }
  }

  async function loadAvgProcessingTime() {
    try {
      const params = new URLSearchParams();
      if (selectedLocation !== "all") {
        params.append("locationId", selectedLocation);
      }
      const queryString = params.toString();
      const response = await fetch(
        `${BASE}/kitchen/average-processing-time${queryString ? `?${queryString}` : ""}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );
      const data = await response.json();
      setAvgProcessingTime(data);
    } catch (error) {
      console.error("Failed to load average processing time:", error);
    }
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    try {
      await fetch(`${BASE}/kitchen/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      loadOrders();
      loadStats();
    } catch (error) {
      console.error("Failed to update order:", error);
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

      loadOrders();
      loadStats();
    } catch (error) {
      console.error("Failed to confirm arrival:", error);
    }
  }

  async function loadPodCalls() {
    try {
      const params = new URLSearchParams();
      if (selectedLocation !== "all") {
        params.append("locationId", selectedLocation);
      }
      const queryString = params.toString();
      const response = await fetch(
        `${BASE}/pod-calls${queryString ? `?${queryString}` : ""}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );
      const data = await response.json();
      setPodCalls(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load pod calls:", error);
      setPodCalls([]);
    }
  }

  async function loadCnyStats() {
    if (selectedLocation !== CNY_PARTY_LOCATION_ID) {
      setCnyStats(null);
      return;
    }
    try {
      const response = await fetch(`${BASE}/kitchen/cny-stats`, {
        headers: { "x-tenant-slug": "oh" },
      });
      const data = await response.json();
      setCnyStats(data);
    } catch (error) {
      console.error("Failed to load CNY stats:", error);
      setCnyStats(null);
    }
  }

  async function acknowledgePodCall(callId: string) {
    try {
      const response = await fetch(`${BASE}/pod-calls/${callId}/acknowledge`, {
        method: "PATCH",
        headers: {
          "x-tenant-slug": "oh",
        },
      });
      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to acknowledge pod call:", error);
        return;
      }
      // Immediately update local state to show acknowledged status
      setPodCalls(prev =>
        prev.map(call =>
          call.id === callId
            ? { ...call, status: "ACKNOWLEDGED" as const, acknowledgedAt: new Date().toISOString() }
            : call
        )
      );
    } catch (error) {
      console.error("Failed to acknowledge pod call:", error);
    }
  }

  async function resolvePodCall(callId: string) {
    try {
      const response = await fetch(`${BASE}/pod-calls/${callId}/resolve`, {
        method: "PATCH",
        headers: {
          "x-tenant-slug": "oh",
        },
      });
      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to resolve pod call:", error);
        return;
      }
      // Remove the resolved call from the list immediately
      setPodCalls(prev => prev.filter(call => call.id !== callId));
    } catch (error) {
      console.error("Failed to resolve pod call:", error);
    }
  }

  useEffect(() => {
    loadOrders();
    loadStats();
    loadAvgProcessingTime();
    loadPodCalls();
    loadCnyStats();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadOrders();
      loadStats();
      loadAvgProcessingTime();
      loadPodCalls();
      loadCnyStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedLocation]);

  function getOrderAge(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    return `${diffMins} mins ago`;
  }

  function getAgeColor(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMins = Math.floor((now.getTime() - created.getTime()) / 60000);

    if (diffMins < 5) return "#22c55e"; // Green
    if (diffMins < 10) return "#f59e0b"; // Orange
    return "#ef4444"; // Red
  }

  const queuedOrders = orders.filter((o) => o.status === "QUEUED");
  const preppingOrders = orders.filter((o) => o.status === "PREPPING");
  const readyOrders = orders.filter((o) => o.status === "READY");
  const servingOrders = orders.filter((o) => o.status === "SERVING");

  // Calculate color for average processing time
  const getProcessingTimeColor = () => {
    const mins = avgProcessingTime.averageMinutes;
    if (mins >= 7) return "#ef4444"; // Red for 7+ minutes
    if (mins >= 4) return "#f59e0b"; // Orange for 4-7 minutes
    return "#22c55e"; // Green for < 4 minutes
  };

  // Format average time as M:SS
  const formatAvgProcessingTime = () => {
    const minutes = Math.floor(avgProcessingTime.averageSeconds / 60);
    const seconds = avgProcessingTime.averageSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  function OrderCard({ order }: { order: Order }) {
    const ageColor = getAgeColor(order.createdAt);

    // Check if customer hasn't arrived at pod yet (order paid, pod reserved, but not confirmed)
    const isArriving = order.status === "QUEUED" && !order.podConfirmedAt && order.seat;

    // Check if customer is a VIP (Beef Boss tier)
    const customerIsVIP = isVIP(order.user?.membershipTier);
    const tierEmoji = getTierEmoji(order.user?.membershipTier);

    // Check if this is an add-on order (child order placed during meal)
    const isAddOnOrder = !!order.addOnType;
    const addOnStyle = getAddOnTypeStyle(order.addOnType);

    // Split items into bowl configuration (MAIN + SLIDER) vs add-ons (ADDON, SIDE, DRINK, DESSERT)
    const bowlItems = order.items.filter(
      (item) =>
        item.menuItem.categoryType === "MAIN" ||
        item.menuItem.categoryType === "SLIDER"
    );
    const addonItems = order.items.filter(
      (item) =>
        item.menuItem.categoryType === "ADDON" ||
        item.menuItem.categoryType === "SIDE" ||
        item.menuItem.categoryType === "DRINK" ||
        item.menuItem.categoryType === "DESSERT"
    );

    // Helper to determine if item should show quantity
    const shouldShowQty = (categoryType?: string) => {
      return (
        categoryType === "ADDON" ||
        categoryType === "SIDE" ||
        categoryType === "DESSERT"
      );
    };

    // Check if a selection should be highlighted (No Beef, Soup Only, etc.)
    const isSpecialDietSelection = (item: any) => {
      const selectedValue = item.selectedValue?.toLowerCase() || "";
      const menuItemName = item.menuItem?.name?.toLowerCase() || "";
      return selectedValue.includes("no beef") || selectedValue.includes("soup only") || selectedValue.includes("vegetarian") ||
             menuItemName.includes("no beef") || menuItemName.includes("soup only") || menuItemName.includes("vegetarian");
    };

    const renderItem = (item: any, showQty: boolean, isCnyOrder = false, isMainBowlItem = false) => {
      const isSpecial = isSpecialDietSelection(item);
      // For CNY orders, make main bowl items (not toppings) 1.5x larger
      const baseFontSize = isCnyOrder && isMainBowlItem ? "1.275rem" : "0.85rem";

      return (
        <div
          style={{
            padding: isCnyOrder && isMainBowlItem ? "6px 0" : "4px 0",
            fontSize: baseFontSize,
          }}
        >
          {item.selectedValue ? (
            // Combine menu item with selection on same line
            <div>
              <span style={{ color: "#9ca3af" }}>{item.menuItem.name}: </span>
              <span
                style={{
                  fontWeight: "bold",
                  color: isSpecial && isCnyOrder ? "#ef4444" : "inherit",
                  textShadow: isSpecial && isCnyOrder ? "0 0 5px #ef4444, 0 0 10px #ef4444, 0 0 15px #ef4444" : "none",
                  animation: isSpecial && isCnyOrder ? "pulse-glow 1.5s ease-in-out infinite" : "none",
                }}
              >
                {showQty && item.quantity > 0 && `${item.quantity}x `}
                {item.selectedValue}
              </span>
            </div>
          ) : (
            // No selection, just show item name
            <div
              style={{
                fontWeight: "bold",
                color: isSpecial && isCnyOrder ? "#ef4444" : "inherit",
                textShadow: isSpecial && isCnyOrder ? "0 0 10px #ef4444, 0 0 20px #ef4444, 0 0 30px #ef4444" : "none",
                animation: isSpecial && isCnyOrder ? "pulse-glow 1.5s ease-in-out infinite" : "none",
              }}
            >
              {showQty && item.quantity > 0 && `${item.quantity}x `}
              {item.menuItem.name}
            </div>
          )}
        </div>
      );
    };

    // Determine card styling based on order type
    const getCardBackground = () => {
      if (isAddOnOrder) return addOnStyle.bg;
      if (isArriving) return "#1e293b";
      if (customerIsVIP) return "#2d1f1f";
      return "#1f2937";
    };

    const getCardBorder = () => {
      if (isAddOnOrder) return `2px solid ${addOnStyle.border}`;
      if (isArriving) return "2px solid #f59e0b";
      if (customerIsVIP) return "2px solid #dc2626";
      return "2px solid #374151";
    };

    return (
      <div
        style={{
          background: getCardBackground(),
          border: getCardBorder(),
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          opacity: isArriving ? 0.85 : 1,
          boxShadow: isAddOnOrder
            ? `0 0 15px ${addOnStyle.border}40, 0 0 30px ${addOnStyle.border}20`
            : customerIsVIP && !isArriving
              ? "0 0 15px rgba(220, 38, 38, 0.5), 0 0 30px rgba(220, 38, 38, 0.3)"
              : "none",
          position: "relative" as const,
        }}
      >
        {/* Add-On Order Banner */}
        {isAddOnOrder && (
          <div
            style={{
              background: addOnStyle.border,
              color: "#000",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: "0.75rem",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {addOnStyle.emoji} {addOnStyle.label}
          </div>
        )}

        {/* Arriving Banner */}
        {isArriving && !isAddOnOrder && (
          <div
            style={{
              background: "#f59e0b",
              color: "#000",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: "0.75rem",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            ⏳ Customer Arriving - Do Not Prep
          </div>
        )}

        {/* Tier Emoji Badge (Top Right) */}
        {order.user && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              fontSize: "1.5rem",
              filter: customerIsVIP ? "drop-shadow(0 0 4px rgba(220, 38, 38, 0.8))" : "none",
            }}
            title={`${order.user.membershipTier || "CHOPSTICK"} tier`}
          >
            {tierEmoji}
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            marginBottom: 10,
            paddingRight: order.user ? 40 : 0, // Make room for tier emoji
          }}
        >
          <div>
            <div style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: 2 }}>
              #{order.kitchenOrderNumber || order.orderNumber.slice(-6)}
            </div>
            <div
              style={{
                fontSize: order.orderSource === "EVENT" ? "1.45rem" : "1.275rem",
                fontWeight: "bold",
                color: isArriving ? "#f59e0b" : customerIsVIP ? "#dc2626" : order.orderSource === "EVENT" ? "#D7B66E" : "#3b82f6",
              }}
            >
              {order.orderSource === "EVENT"
                ? `${order.guestName || order.guest?.name || "CNY Guest"}${order.guestZodiac ? ` (${order.guestZodiac})` : ""}`
                : order.seat
                  ? `Pod ${order.seat.number}`
                  : "Dine-In"
              }
            </div>
            {order.orderSource !== "EVENT" && getCustomerName(order) && (
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: 2 }}>
                {getCustomerName(order)}
              </div>
            )}
          </div>
          <div
            style={{
              background: ageColor + "20",
              color: ageColor,
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: "0.85rem",
              fontWeight: "bold",
            }}
          >
            {getOrderAge(order.createdAt)}
          </div>
        </div>

        {/* Bowl Configuration Section */}
        {bowlItems.length > 0 && (() => {
          const isCny = order.orderSource === "EVENT";
          // Topping names to separate into 2-column grid for CNY
          const toppingNames = ["baby bok choy", "green onions", "cilantro", "sprouts"];
          const isTopping = (item: any) =>
            toppingNames.some(t => item.menuItem.name.toLowerCase().includes(t));

          const mainBowlItems = isCny ? bowlItems.filter(item => !isTopping(item)) : bowlItems;
          const toppingItems = isCny ? bowlItems.filter(item => isTopping(item)) : [];

          return (
            <div
              style={{
                background: "#111827",
                padding: 10,
                borderRadius: 6,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#9ca3af",
                  fontWeight: "bold",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Bowl Configuration
              </div>
              {mainBowlItems.map((item) => (
                <div key={item.id}>{renderItem(item, shouldShowQty(item.menuItem.categoryType), isCny, true)}</div>
              ))}
              {/* Toppings in 2-column grid for CNY */}
              {toppingItems.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px 16px",
                    marginTop: 8,
                  }}
                >
                  {toppingItems.map((item) => (
                    <div key={item.id}>{renderItem(item, false, isCny)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Add-ons Section */}
        {addonItems.length > 0 && (
          <div
            style={{
              background: "#111827",
              padding: 10,
              borderRadius: 6,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#9ca3af",
                fontWeight: "bold",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Add-ons & Extras
            </div>
            {addonItems.map((item) => (
              <div key={item.id}>{renderItem(item, shouldShowQty(item.menuItem.categoryType))}</div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          {order.status === "QUEUED" && !isArriving && (
            <button
              onClick={() => updateOrderStatus(order.id, "PREPPING")}
              style={{
                flex: 1,
                padding: 12,
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              Start Prep
            </button>
          )}

          {order.status === "QUEUED" && isArriving && (
            <button
              onClick={() => confirmArrival(order.id)}
              style={{
                flex: 1,
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

          {/* Add-on orders get a simplified flow: just "Delivered" button */}
          {order.status === "PREPPING" && isAddOnOrder && (
            <button
              onClick={() => updateOrderStatus(order.id, "COMPLETED")}
              style={{
                flex: 1,
                padding: 12,
                background: addOnStyle.border,
                color: "#000",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              {addOnStyle.emoji} Delivered
            </button>
          )}

          {/* Regular orders go through full flow */}
          {order.status === "PREPPING" && !isAddOnOrder && (
            <button
              onClick={() => updateOrderStatus(order.id, "READY")}
              style={{
                flex: 1,
                padding: 12,
                background: "#22c55e",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              Mark Ready
            </button>
          )}

          {order.status === "READY" && (
            <button
              onClick={() => updateOrderStatus(order.id, "SERVING")}
              style={{
                flex: 1,
                padding: 12,
                background: "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              Deliver to Pod
            </button>
          )}

          {order.status === "SERVING" && (
            <button
              onClick={() => updateOrderStatus(order.id, "COMPLETED")}
              style={{
                flex: 1,
                padding: 12,
                background: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              ✓ Mark Complete
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedLocationName = selectedLocation === "all"
    ? "All Locations"
    : locations.find(l => l.id === selectedLocation)?.name || "Unknown";

  // Fullscreen toggle icons
  const ExpandIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );

  const CompressIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );

  const content = (
    <>
      {/* Header with Location Name */}
      <div
        style={{
          background: "#1f2937",
          padding: "16px 24px",
          borderBottom: "1px solid #374151",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" }}>
          {!isFullscreen && "🍜"}
          Kitchen Display for {selectedLocationName}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
            {currentTime || "--:--:--"}
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              background: "#374151",
              border: "none",
              borderRadius: 6,
              padding: "8px",
              cursor: "pointer",
              color: "#9ca3af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
          </button>
        </div>
      </div>

      {/* Location Selector - Above Kitchen Display */}
      <div style={{
        background: "#1f2937",
        padding: "16px 24px",
        borderBottom: "1px solid #374151",
        display: "flex",
        gap: 16,
        alignItems: "center"
      }}>
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

        {/* CNY Orders vs RSVPs Indicator */}
        {isCnyPartySelected && cnyStats && (
          <button
            onClick={() => setShowNotOrderedModal(true)}
            style={{
              background: cnyStats.ordersPlaced < cnyStats.totalRsvps ? "#f59e0b20" : "#22c55e20",
              border: `1px solid ${cnyStats.ordersPlaced < cnyStats.totalRsvps ? "#f59e0b" : "#22c55e"}`,
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: cnyStats.ordersPlaced < cnyStats.totalRsvps ? "#f59e0b" : "#22c55e" }}>
              {cnyStats.ordersPlaced} of {cnyStats.totalRsvps}
            </span>
            <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
              orders
            </span>
            {cnyStats.notOrdered.length > 0 && (
              <span style={{ fontSize: "0.7rem", color: "#f59e0b", marginLeft: 4 }}>
                ({cnyStats.notOrdered.length} pending)
              </span>
            )}
          </button>
        )}

        {/* Average Processing Time */}
        <div style={{ marginLeft: "auto", textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 4 }}>
            Average Order Processing Time
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: getProcessingTimeColor() }}>
            {avgProcessingTime.count > 0 ? formatAvgProcessingTime() : "--:--"}
          </div>
          {avgProcessingTime.count > 0 && (
            <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
              ({avgProcessingTime.count} orders)
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#f59e0b" }}
            >
              {stats.queued}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>QUEUED</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#3b82f6" }}
            >
              {stats.prepping}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              PREPPING
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#22c55e" }}
            >
              {stats.ready}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>READY</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#8b5cf6" }}
            >
              {stats.serving}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>SERVING</div>
          </div>
        </div>
      </div>

      {/* Pod Calls Notification Banner */}
      {podCalls.length > 0 && (
        <div
          style={{
            background: "#7c2d12",
            borderBottom: "2px solid #ea580c",
            padding: "12px 24px",
            animation: "pulse 2s infinite",
          }}
        >
          <style>
            {`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.85; }
              }
              @keyframes pulse-glow {
                0%, 100% {
                  text-shadow: 0 0 5px #ef4444, 0 0 10px #ef4444, 0 0 15px #ef4444;
                  opacity: 1;
                }
                50% {
                  text-shadow: 0 0 10px #ef4444, 0 0 20px #ef4444, 0 0 30px #ef4444;
                  opacity: 0.95;
                }
              }
            `}
          </style>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: podCalls.length > 1 ? 12 : 0,
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>🔔</span>
            <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
              {podCalls.length} Pod Call{podCalls.length > 1 ? "s" : ""} Waiting
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {podCalls.map((call) => {
              const reasonDisplay = getPodCallReasonDisplay(call.reason);
              const ageMs = Date.now() - new Date(call.createdAt).getTime();
              const ageMins = Math.floor(ageMs / 60000);

              return (
                <div
                  key={call.id}
                  style={{
                    background: call.status === "ACKNOWLEDGED" ? "#166534" : "#1f2937",
                    border: call.status === "ACKNOWLEDGED" ? "2px solid #22c55e" : "2px solid #ea580c",
                    borderRadius: 8,
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem" }}>{reasonDisplay.emoji}</div>
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "bold",
                        color: call.status === "ACKNOWLEDGED" ? "#22c55e" : "#ea580c",
                      }}
                    >
                      Pod {call.seat.number}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", color: "#d4d4d4" }}>
                      {reasonDisplay.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                      {ageMins < 1 ? "Just now" : `${ageMins} min${ageMins > 1 ? "s" : ""} ago`}
                    </div>
                    {call.status === "ACKNOWLEDGED" && (
                      <div style={{ fontSize: "0.7rem", color: "#22c55e", marginTop: 2 }}>
                        ✓ Staff on the way
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {call.status === "PENDING" && (
                      <button
                        onClick={() => acknowledgePodCall(call.id)}
                        style={{
                          padding: "6px 12px",
                          background: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        On My Way
                      </button>
                    )}
                    <button
                      onClick={() => resolvePodCall(call.id)}
                      style={{
                        padding: "6px 12px",
                        background: call.status === "ACKNOWLEDGED" ? "#16a34a" : "#4b5563",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: 24 }}>

      {/* Order Columns */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "calc(100vh - 250px)",
          }}
        >
          <img
            src="/Oh_Logo_Mark_Light.png"
            alt="Oh!"
            style={{
              maxHeight: "70vh",
              maxWidth: "70vw",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              opacity: 0.9,
            }}
          />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
          }}
        >
          {/* Queued Column */}
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
              QUEUED ({queuedOrders.length})
            </div>
            {queuedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {/* Prepping Column */}
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
              PREPPING ({preppingOrders.length})
            </div>
            {preppingOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {/* Ready Column */}
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
              READY ({readyOrders.length})
            </div>
            {readyOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {/* Serving Column */}
          <div>
            <div
              style={{
                background: "#8b5cf620",
                color: "#8b5cf6",
                padding: 12,
                borderRadius: 8,
                fontWeight: "bold",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              SERVING ({servingOrders.length})
            </div>
            {servingOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}
      </div>
    </>
  );

  // Not Ordered Modal
  const notOrderedModal = showNotOrderedModal && cnyStats && (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={() => setShowNotOrderedModal(false)}
    >
      <div
        style={{
          background: "#1f2937",
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          border: "2px solid #f59e0b",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#f59e0b" }}>
            Guests Who Haven't Ordered ({cnyStats.notOrdered.length})
          </h2>
          <button
            onClick={() => setShowNotOrderedModal(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#9ca3af",
              fontSize: "1.5rem",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {cnyStats.notOrdered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "#22c55e" }}>
            🎉 Everyone has ordered!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...cnyStats.notOrdered].sort((a, b) => a.name.localeCompare(b.name)).map((guest, index) => (
              <div
                key={index}
                style={{
                  background: "#111827",
                  padding: "12px 16px",
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: "bold", color: "#fff" }}>{guest.name}</span>
                <span style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{guest.phone}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
            {cnyStats.ordersPlaced} of {cnyStats.totalRsvps} guests have placed orders
          </div>
        </div>
      </div>
    </div>
  );

  // In fullscreen mode, render content in a fixed container that covers the entire viewport
  if (isFullscreen) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#111827",
          color: "white",
          zIndex: 1000,
          overflow: "auto",
        }}
      >
        {/* Centered overlay logo at top */}
        <div
          style={{
            position: "fixed",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            pointerEvents: "none",
          }}
        >
          <img
            src="/Oh_Logo_Mark_Light.png"
            alt="Oh!"
            style={{ height: "112px", width: "auto" }}
          />
        </div>
        {content}
        {notOrderedModal}
      </div>
    );
  }

  return (
    <div>
      {content}
      {notOrderedModal}
    </div>
  );
}
