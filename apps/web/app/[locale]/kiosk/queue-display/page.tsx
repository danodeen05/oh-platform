"use client";
import { useState, useEffect, useCallback } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type QueueOrder = {
  id: string;
  orderNumber: string;
  guestName?: string;
  status: string;
  seatId?: string;
  seatLabel?: string;
  createdAt: string;
};

export default function QueueDisplayPage() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [recentlyReady, setRecentlyReady] = useState<QueueOrder[]>([]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch(`${BASE}/orders?status=PENDING,READY,PREPARING`, {
        headers: { "x-tenant-slug": "oh" },
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data);
        setLastUpdated(new Date());

        // Track recently ready orders for display
        const readyOrders = data.filter((o: QueueOrder) => o.status === "READY");
        setRecentlyReady(readyOrders.slice(0, 3));
      }
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    }
  }, []);

  // Poll for updates every 5 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingOrders = orders.filter((o) => o.status === "PENDING" || o.status === "PREPARING");
  const readyOrders = orders.filter((o) => o.status === "READY");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)",
        color: "white",
        padding: 48,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 48,
        }}
      >
        <div>
          <div style={{ fontSize: "3rem", fontWeight: 700 }}>Oh!</div>
          <div style={{ color: "#999", fontSize: "1rem" }}>Order Queue</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "3rem", fontWeight: 300, color: "#7C7A67" }}>
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div style={{ color: "#666", fontSize: "0.85rem" }}>
            {currentTime.toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Ready Now Section */}
      {readyOrders.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <div
            style={{
              background: "#22c55e",
              borderRadius: 24,
              padding: "32px 48px",
              textAlign: "center",
              animation: "pulse-bg 2s infinite",
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 16, opacity: 0.9 }}>
              NOW READY
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
              {readyOrders.slice(0, 4).map((order) => (
                <div
                  key={order.id}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 16,
                    padding: "20px 32px",
                    minWidth: 180,
                  }}
                >
                  <div style={{ fontSize: "3rem", fontWeight: 700 }}>#{order.orderNumber}</div>
                  {order.guestName && (
                    <div style={{ fontSize: "1.25rem", opacity: 0.9 }}>{order.guestName}</div>
                  )}
                  {order.seatLabel && (
                    <div style={{ marginTop: 8, fontSize: "1rem", fontWeight: 600 }}>
                      Pod {order.seatLabel}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
        }}
      >
        {/* Preparing Column */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#f59e0b",
              }}
            />
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Preparing</h2>
            <span style={{ color: "#666", fontSize: "1rem" }}>
              ({pendingOrders.length} orders)
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingOrders.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  textAlign: "center",
                  color: "#666",
                }}
              >
                No orders in queue
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "20px 24px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    borderLeft: "4px solid #f59e0b",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: "2rem", fontWeight: 700 }}>#{order.orderNumber}</div>
                    {order.guestName && (
                      <div style={{ color: "#999", fontSize: "1.1rem" }}>{order.guestName}</div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "8px 16px",
                      background: "rgba(245, 158, 11, 0.2)",
                      borderRadius: 8,
                      color: "#f59e0b",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    {order.status === "PREPARING" ? "Cooking" : "In Queue"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Ready for Pickup</h2>
            <span style={{ color: "#666", fontSize: "1rem" }}>
              ({readyOrders.length} orders)
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {readyOrders.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  textAlign: "center",
                  color: "#666",
                }}
              >
                No orders ready
              </div>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "20px 24px",
                    background: "rgba(34, 197, 94, 0.1)",
                    borderRadius: 12,
                    borderLeft: "4px solid #22c55e",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: "#22c55e" }}>
                      #{order.orderNumber}
                    </div>
                    {order.guestName && (
                      <div style={{ color: "#999", fontSize: "1.1rem" }}>{order.guestName}</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {order.seatLabel && (
                      <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#22c55e" }}>
                        Pod {order.seatLabel}
                      </div>
                    )}
                    <div
                      style={{
                        padding: "8px 16px",
                        background: "rgba(34, 197, 94, 0.2)",
                        borderRadius: 8,
                        color: "#22c55e",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        marginTop: 8,
                      }}
                    >
                      Ready!
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#444",
          fontSize: "0.85rem",
        }}
      >
        Last updated: {lastUpdated.toLocaleTimeString()} | Auto-refreshing every 5 seconds
      </div>

      <style>{`
        @keyframes pulse-bg {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </main>
  );
}
