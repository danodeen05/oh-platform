"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type MenuItem = {
  id: string;
  name: string;
  priceCents: number;
  category: string;
};

type OrderItem = {
  id: string;
  quantity: number;
  priceCents: number;
  menuItem: MenuItem;
  selectedOptions?: any;
  selectedValue?: string;
};

type Location = {
  id: string;
  name: string;
  tenantId: string;
};

type Order = {
  id: string;
  orderNumber: string;
  totalCents: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: OrderItem[];
  location: Location;
};

export default function OrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reordering, setReordering] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/member");
      return;
    }
    loadOrders(userId);
  }, []);

  async function loadOrders(userId: string) {
    try {
      const response = await fetch(`${BASE}/users/${userId}/orders`);
      const data = await response.json();
      setOrders(data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load orders:", error);
      setLoading(false);
    }
  }

  async function handleReorder(order: Order) {
    try {
      setReordering(order.id);

      // Create a new order with the same items at the same location
      const orderData = {
        locationId: order.location.id,
        tenantId: order.location.tenantId,
        items: order.items.map((item) => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          priceCents: item.priceCents,
          selectedOptions: item.selectedOptions || {},
          selectedValue: item.selectedValue || null,
        })),
      };

      const response = await fetch(`${BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error("Failed to create reorder");
      }

      const newOrder = await response.json();

      // Redirect to location menu page with reorder flag to skip directly to arrival time selection
      router.push(
        `/order/location/${newOrder.locationId}?reorderId=${newOrder.id}`
      );
    } catch (error) {
      console.error("Failed to reorder:", error);
      alert("Failed to create reorder. Please try again.");
      setReordering(null);
    }
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      QUEUED: "#f59e0b",
      PREPARING: "#3b82f6",
      READY: "#22c55e",
      COMPLETED: "#666",
      CANCELLED: "#ef4444",
    };
    return colors[status] || "#666";
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🍜</div>
          <div>Loading orders...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80, background: "#f9fafb" }}>
      {/* Header */}
      <div
        style={{
          background: "white",
          padding: "16px 24px",
          borderBottom: "1px solid #e5e7eb",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Order History</h1>
        </div>
      </div>

      {/* Orders */}
      <div style={{ padding: 24 }}>
        {orders.length === 0 ? (
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🍜</div>
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>No orders yet</div>
            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}>
              Place your first order to see it here
            </div>
            <button
              onClick={() => router.push("/order")}
              style={{
                background: "linear-gradient(135deg, #7C7A67 0%, #7C7A67 100%)",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                fontSize: "1rem",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Order Now
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {orders.map((order) => (
              <div
                key={order.id}
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                {/* Order Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    marginBottom: 16,
                    paddingBottom: 16,
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: 4 }}>
                      Order #{order.orderNumber}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 4 }}>
                      {order.location.name}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div
                    style={{
                      background: getStatusColor(order.status) + "20",
                      color: getStatusColor(order.status),
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                    }}
                  >
                    {order.status}
                  </div>
                </div>

                {/* Order Items - grouped by category */}
                {(() => {
                  const bowlItems = order.items.filter((item: OrderItem) => {
                    const cat = item.menuItem.category || "";
                    return cat.startsWith("main") || cat.startsWith("slider");
                  });
                  const extrasItems = order.items.filter((item: OrderItem) => {
                    const cat = item.menuItem.category || "";
                    return cat.startsWith("add-on") || cat.startsWith("side") || cat.startsWith("drink") || cat.startsWith("dessert");
                  });

                  return (
                    <>
                      {/* The Bowl - Step 1 & 2 items */}
                      {bowlItems.length > 0 && (
                        <div style={{ marginBottom: extrasItems.length > 0 ? 12 : 12 }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#7C7A67", marginBottom: 6 }}>
                            The Bowl
                          </div>
                          <div
                            style={{
                              background: "rgba(124, 122, 103, 0.08)",
                              borderRadius: 8,
                              padding: 10,
                            }}
                          >
                            {bowlItems.map((item: OrderItem) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "2px 0",
                                  fontSize: "0.85rem",
                                }}
                              >
                                <span>
                                  {item.menuItem.name}
                                  <span style={{ color: "#666", marginLeft: 6 }}>
                                    ({item.selectedValue || `Qty: ${item.quantity}`})
                                  </span>
                                </span>
                                {item.priceCents > 0 && (
                                  <span style={{ color: "#666" }}>
                                    ${(item.priceCents / 100).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extras - Step 3 & 4 items */}
                      {extrasItems.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#7C7A67", marginBottom: 6 }}>
                            Add-ons & Extras
                          </div>
                          <div
                            style={{
                              background: "rgba(199, 168, 120, 0.1)",
                              borderRadius: 8,
                              padding: 10,
                            }}
                          >
                            {extrasItems.map((item: OrderItem) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "2px 0",
                                  fontSize: "0.85rem",
                                }}
                              >
                                <span>
                                  {item.menuItem.name}
                                  <span style={{ color: "#666", marginLeft: 6 }}>
                                    (Qty: {item.quantity})
                                  </span>
                                </span>
                                {item.priceCents > 0 && (
                                  <span style={{ color: "#666" }}>
                                    ${(item.priceCents / 100).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Order Footer */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 12,
                    borderTop: "1px solid #f3f4f6",
                  }}
                >
                  <div style={{ fontWeight: "bold", fontSize: "1rem" }}>
                    Total: ${(order.totalCents / 100).toFixed(2)}
                  </div>
                  <button
                    onClick={() => handleReorder(order)}
                    disabled={reordering === order.id}
                    style={{
                      background: "linear-gradient(135deg, #7C7A67 0%, #7C7A67 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 20px",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                      cursor: reordering === order.id ? "not-allowed" : "pointer",
                      opacity: reordering === order.id ? 0.6 : 1,
                    }}
                  >
                    {reordering === order.id ? "Reordering..." : "Reorder"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
