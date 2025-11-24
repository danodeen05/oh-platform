"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type MenuItem = {
  id: string;
  name: string;
  priceCents: number;
};

type CartItem = {
  menuItemId: string;
  quantity: number;
};

export default function MenuBuilder({
  location,
  menu,
}: {
  location: any;
  menu: MenuItem[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"menu" | "time">("menu");
  const [arrivalTime, setArrivalTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Separate menu into bases and add-ons
  const bases = menu.filter(
    (item) => item.name.includes("Noodles") || item.name.includes("Soup")
  );
  const addons = menu.filter(
    (item) => !item.name.includes("Noodles") && !item.name.includes("Soup")
  );

  function updateQuantity(itemId: string, delta: number) {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newQty };
    });
  }

  const totalCents = Object.entries(cart).reduce((sum, [itemId, qty]) => {
    const item = menu.find((m) => m.id === itemId);
    return sum + (item ? item.priceCents * qty : 0);
  }, 0);

  const hasBase = bases.some((base) => cart[base.id] > 0);

  function proceedToTime() {
    if (!hasBase) {
      alert("Please select at least one base dish");
      return;
    }
    setStep("time");
  }

  async function proceedToPayment() {
    if (!arrivalTime) {
      alert("Please select an arrival time");
      return;
    }

    setSubmitting(true);

    const items: CartItem[] = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    // Calculate estimated arrival timestamp
    let estimatedArrival = new Date();
    if (arrivalTime !== "asap") {
      const minutes = parseInt(arrivalTime);
      estimatedArrival = new Date(Date.now() + minutes * 60 * 1000);
    }

    // Create the order
    const response = await fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: location.id,
        tenantId: location.tenantId,
        items,
        estimatedArrival: estimatedArrival.toISOString(),
        fulfillmentType: "PRE_ORDER",
      }),
    });

    const order = await response.json();
    setSubmitting(false);

    // Redirect to payment (we'll build this next)
    router.push(
      `/order/payment?orderId=${order.id}&orderNumber=${order.orderNumber}&total=${totalCents}`
    );
  }

  // Arrival time options
  const timeOptions = [
    { value: "asap", label: "ASAP (15-20 min)", minutes: 15 },
    { value: "30", label: "30 minutes", minutes: 30 },
    { value: "45", label: "45 minutes", minutes: 45 },
    { value: "60", label: "1 hour", minutes: 60 },
    { value: "90", label: "1.5 hours", minutes: 90 },
  ];

  if (step === "time") {
    return (
      <div>
        <button
          onClick={() => setStep("menu")}
          style={{
            marginBottom: 24,
            padding: "8px 16px",
            background: "transparent",
            border: "1px solid #667eea",
            color: "#667eea",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ← Back to Menu
        </button>

        <h2 style={{ marginBottom: 24 }}>When will you arrive?</h2>

        <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
          {timeOptions.map((option) => {
            const isSelected = arrivalTime === option.value;
            const estimatedReadyTime = new Date(
              Date.now() + option.minutes * 60 * 1000
            );
            const timeStr = estimatedReadyTime.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <button
                key={option.value}
                onClick={() => setArrivalTime(option.value)}
                style={{
                  border: `2px solid ${isSelected ? "#667eea" : "#e5e7eb"}`,
                  borderRadius: 12,
                  padding: 20,
                  background: isSelected ? "#f0f4ff" : "white",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "1.1rem",
                        marginBottom: 4,
                      }}
                    >
                      {option.label}
                    </div>
                    <div style={{ color: "#666", fontSize: "0.9rem" }}>
                      Ready by {timeStr}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "#667eea",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.9rem",
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Order Summary */}
        <div
          style={{
            background: "#f9fafb",
            padding: 24,
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 16 }}>Order Summary</h3>
          {Object.entries(cart).map(([itemId, qty]) => {
            const item = menu.find((m) => m.id === itemId);
            if (!item || qty === 0) return null;
            return (
              <div
                key={itemId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  fontSize: "0.9rem",
                }}
              >
                <span>
                  {qty}x {item.name}
                </span>
                <span>${((item.priceCents * qty) / 100).toFixed(2)}</span>
              </div>
            );
          })}
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              marginTop: 12,
              paddingTop: 12,
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              fontSize: "1.1rem",
            }}
          >
            <span>Total:</span>
            <span style={{ color: "#667eea" }}>
              ${(totalCents / 100).toFixed(2)}
            </span>
          </div>
        </div>

        <button
          onClick={proceedToPayment}
          disabled={submitting || !arrivalTime}
          style={{
            width: "100%",
            padding: 16,
            background: arrivalTime ? "#667eea" : "#d1d5db",
            color: "white",
            border: "none",
            borderRadius: 12,
            fontSize: "1.1rem",
            fontWeight: "bold",
            cursor: arrivalTime && !submitting ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          {submitting ? "Processing..." : "Continue to Payment →"}
        </button>
      </div>
    );
  }

  // Menu step (existing code)
  return (
    <div>
      {/* Base Dishes Section */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ marginBottom: 16 }}>Choose Your Base</h2>
        <div style={{ display: "grid", gap: 16 }}>
          {bases.map((item) => {
            const qty = cart[item.id] || 0;
            const isSelected = qty > 0;
            return (
              <div
                key={item.id}
                style={{
                  border: `2px solid ${isSelected ? "#667eea" : "#e5e7eb"}`,
                  borderRadius: 12,
                  padding: 20,
                  background: isSelected ? "#f0f4ff" : "white",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, marginBottom: 4 }}>{item.name}</h3>
                    <p
                      style={{
                        color: "#667eea",
                        fontWeight: "bold",
                        margin: 0,
                      }}
                    >
                      ${(item.priceCents / 100).toFixed(2)}
                    </p>
                  </div>

                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    {qty > 0 && (
                      <>
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            border: "2px solid #667eea",
                            background: "white",
                            color: "#667eea",
                            fontSize: "1.2rem",
                            cursor: "pointer",
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            minWidth: 24,
                            textAlign: "center",
                            fontWeight: "bold",
                          }}
                        >
                          {qty}
                        </span>
                      </>
                    )}
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "none",
                        background: "#667eea",
                        color: "white",
                        fontSize: "1.2rem",
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add-ons Section */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ marginBottom: 16 }}>Premium Add-ons</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {addons.map((item) => {
            const qty = cart[item.id] || 0;
            return (
              <div
                key={item.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: qty > 0 ? "#f9fafb" : "white",
                }}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span
                    style={{ color: "#666", marginLeft: 8, fontSize: "0.9rem" }}
                  >
                    +${(item.priceCents / 100).toFixed(2)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {qty > 0 && (
                    <>
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: "1px solid #d1d5db",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: 20, textAlign: "center" }}>
                        {qty}
                      </span>
                    </>
                  )}
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "none",
                      background: "#667eea",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cart Summary - Sticky Bottom */}
      {Object.keys(cart).length > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "white",
            borderTop: "2px solid #e5e7eb",
            padding: "24px 0",
            marginTop: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <strong style={{ fontSize: "1.1rem" }}>Total:</strong>
            <strong style={{ fontSize: "1.1rem", color: "#667eea" }}>
              ${(totalCents / 100).toFixed(2)}
            </strong>
          </div>

          <button
            onClick={proceedToTime}
            disabled={!hasBase}
            style={{
              width: "100%",
              padding: 16,
              background: hasBase ? "#667eea" : "#d1d5db",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: hasBase ? "pointer" : "not-allowed",
              transition: "all 0.2s",
            }}
          >
            Continue →
          </button>

          {!hasBase && (
            <p
              style={{
                textAlign: "center",
                color: "#ef4444",
                fontSize: "0.9rem",
                marginTop: 8,
              }}
            >
              Please select at least one base dish
            </p>
          )}
        </div>
      )}
    </div>
  );
}
