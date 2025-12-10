"use client";
import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

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
};

export default function KitchenDisplay({ locations }: { locations: any[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
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

  useEffect(() => {
    loadOrders();
    loadStats();
    loadAvgProcessingTime();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadOrders();
      loadStats();
      loadAvgProcessingTime();
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

    const renderItem = (item: any, showQty: boolean) => (
      <div
        style={{
          padding: "4px 0",
          fontSize: "0.85rem",
        }}
      >
        {item.selectedValue ? (
          // Combine menu item with selection on same line
          <div>
            <span style={{ color: "#9ca3af" }}>{item.menuItem.name}: </span>
            <span style={{ fontWeight: "bold" }}>
              {showQty && item.quantity > 0 && `${item.quantity}x `}
              {item.selectedValue}
            </span>
          </div>
        ) : (
          // No selection, just show item name
          <div style={{ fontWeight: "bold" }}>
            {showQty && item.quantity > 0 && `${item.quantity}x `}
            {item.menuItem.name}
          </div>
        )}
      </div>
    );

    return (
      <div
        style={{
          background: "#1f2937",
          border: "2px solid #374151",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: 2 }}>
              #{order.kitchenOrderNumber || order.orderNumber.slice(-6)}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#3b82f6",
              }}
            >
              {order.seat ? `Pod ${order.seat.number}` : "Dine-In"}
            </div>
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
        {bowlItems.length > 0 && (
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
            {bowlItems.map((item, idx) =>
              renderItem(item, shouldShowQty(item.menuItem.categoryType))
            )}
          </div>
        )}

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
            {addonItems.map((item, idx) =>
              renderItem(item, shouldShowQty(item.menuItem.categoryType))
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          {order.status === "QUEUED" && (
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

          {order.status === "PREPPING" && (
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
        </div>
      </div>
    );
  }

  const selectedLocationName = selectedLocation === "all"
    ? "All Locations"
    : locations.find(l => l.id === selectedLocation)?.name || "Unknown";

  return (
    <div>
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
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}>
          🍜 Kitchen Display for {selectedLocationName}
        </h1>
        <div style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
          {new Date().toLocaleTimeString()}
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

      <div style={{ padding: 24 }}>

      {/* Order Columns */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          No active orders
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
    </div>
  );
}
