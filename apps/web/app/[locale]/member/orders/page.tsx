"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";
const MAX_FAVORITES = 3;

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

type ChildOrder = {
  id: string;
  orderNumber: string;
  addOnType: string;
  totalCents: number;
  items: OrderItem[];
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
  childOrders?: ChildOrder[];
};

export default function OrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reordering, setReordering] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/member");
      return;
    }

    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem(`favorites_${userId}`);
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
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

  function toggleFavorite(orderId: string) {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    let newFavorites: string[];

    if (favorites.includes(orderId)) {
      // Remove from favorites
      newFavorites = favorites.filter(id => id !== orderId);
    } else {
      // Add to favorites (if under limit)
      if (favorites.length >= MAX_FAVORITES) {
        alert(`You can only have up to ${MAX_FAVORITES} favorite orders. Please remove one first.`);
        return;
      }
      newFavorites = [...favorites, orderId];
    }

    setFavorites(newFavorites);
    localStorage.setItem(`favorites_${userId}`, JSON.stringify(newFavorites));
  }

  async function handleReorder(order: Order) {
    try {
      setReordering(order.id);

      // Combine items from main order and paid add-on child orders
      // (exclude REFILL and EXTRA_VEG as those are free and contextual)
      const allItems = [...order.items];

      if (order.childOrders) {
        for (const childOrder of order.childOrders) {
          // Only include paid add-ons in reorder (skip refills and extra vegs)
          if (childOrder.addOnType === "PAID_ADDON") {
            allItems.push(...childOrder.items);
          }
        }
      }

      // Create a new order with the same items at the same location
      const orderData = {
        locationId: order.location.id,
        tenantId: order.location.tenantId,
        items: allItems.map((item) => ({
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

  // Separate orders into favorites and regular
  const favoriteOrders = orders.filter(order => favorites.includes(order.id));
  const regularOrders = orders.filter(order => !favorites.includes(order.id));

  // Order card component to avoid duplication
  function OrderCard({ order, isFavorite }: { order: Order; isFavorite: boolean }) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 20,
          boxShadow: isFavorite
            ? "0 2px 8px rgba(199, 168, 120, 0.3)"
            : "0 1px 3px rgba(0,0,0,0.1)",
          border: isFavorite ? "2px solid #C7A878" : "none",
          position: "relative",
        }}
      >
        {/* Favorite Button */}
        <button
          onClick={() => toggleFavorite(order.id)}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            fontSize: "1.4rem",
            cursor: "pointer",
            padding: 4,
            lineHeight: 1,
            transition: "transform 0.2s ease",
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.2)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          title={isFavorite ? "Remove from favorites" : favorites.length >= MAX_FAVORITES ? `Maximum ${MAX_FAVORITES} favorites reached` : "Add to favorites"}
        >
          {isFavorite ? "⭐" : "☆"}
        </button>

        {/* Order Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "1px solid #f3f4f6",
            paddingRight: 36, // Make room for the star
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

              {/* Child Orders (paid add-ons ordered during the meal) */}
              {order.childOrders && order.childOrders.filter(co => co.addOnType === "PAID_ADDON").length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#C7A878", marginBottom: 6 }}>
                    Added During Visit
                  </div>
                  <div
                    style={{
                      background: "rgba(199, 168, 120, 0.15)",
                      borderRadius: 8,
                      padding: 10,
                      borderLeft: "3px solid #C7A878",
                    }}
                  >
                    {order.childOrders
                      .filter(co => co.addOnType === "PAID_ADDON")
                      .flatMap(co => co.items)
                      .map((item: OrderItem) => (
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
            Total: ${((order.totalCents + (order.childOrders?.reduce((sum, co) => sum + co.totalCents, 0) || 0)) / 100).toFixed(2)}
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
    );
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
          <>
            {/* Favorites Section */}
            {favoriteOrders.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }}>⭐</span>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "#222" }}>
                    My Favorites
                  </h2>
                  <span
                    style={{
                      background: "#C7A878",
                      color: "white",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      padding: "2px 8px",
                      borderRadius: 10,
                    }}
                  >
                    {favoriteOrders.length}/{MAX_FAVORITES}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 16 }}>
                  {favoriteOrders.map((order) => (
                    <OrderCard key={order.id} order={order} isFavorite={true} />
                  ))}
                </div>
              </div>
            )}

            {/* Order History Section */}
            {regularOrders.length > 0 && (
              <div>
                {favoriteOrders.length > 0 && (
                  <h2
                    style={{
                      margin: "0 0 16px 0",
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      color: "#222",
                    }}
                  >
                    Order History
                  </h2>
                )}
                <div style={{ display: "grid", gap: 16 }}>
                  {regularOrders.map((order) => (
                    <OrderCard key={order.id} order={order} isFavorite={false} />
                  ))}
                </div>
              </div>
            )}

            {/* Tip about favorites */}
            {favoriteOrders.length === 0 && (
              <div
                style={{
                  background: "rgba(199, 168, 120, 0.1)",
                  borderRadius: 8,
                  padding: 16,
                  marginTop: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>💡</span>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "0.9rem", color: "#222", marginBottom: 2 }}>
                    Tip: Add favorites for quick reordering
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                    Click the ☆ on any order to save up to {MAX_FAVORITES} favorites
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
