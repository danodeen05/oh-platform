"use client";
import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  createdAt: string;
  estimatedArrival?: string;
  prepStartTime?: string;
  items: Array<{
    id: string;
    quantity: number;
    menuItem: {
      name: string;
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
    total: 0,
  });
  const [loading, setLoading] = useState(true);

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
        total: data.total || 0,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
      setStats({ queued: 0, prepping: 0, ready: 0, total: 0 });
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

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadOrders();
      loadStats();
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

  function OrderCard({ order }: { order: Order }) {
    const ageColor = getAgeColor(order.createdAt);

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
            marginBottom: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: "bold",
                marginBottom: 4,
              }}
            >
              #{order.orderNumber}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
              {order.seat ? `Seat ${order.seat.number}` : "Pickup"} •{" "}
              {order.location.name}
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

        {/* Items */}
        <div style={{ marginBottom: 12 }}>
          {order.items.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: "8px 0",
                borderBottom:
                  idx < order.items.length - 1 ? "1px solid #374151" : "none",
                display: "flex",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "#374151",
                  color: "white",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                  flexShrink: 0,
                }}
              >
                {item.quantity}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold" }}>{item.menuItem.name}</div>
              </div>
            </div>
          ))}
        </div>

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
              Complete
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Location Filter & Stats */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          style={{
            padding: "8px 16px",
            background: "#1f2937",
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

        <div style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
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
        </div>
      </div>

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
            gridTemplateColumns: "repeat(3, 1fr)",
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
        </div>
      )}
    </div>
  );
}
