"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type MenuItem = {
  id: string;
  name: string;
  basePriceCents: number;
  additionalPriceCents: number;
  includedQuantity: number;
  category?: string;
  description?: string;
  isAvailable: boolean;
};

type CartItem = {
  menuItemId: string;
  quantity: number;
};

export default function MenuBuilder({
  location,
  menu,
  reorderId,
}: {
  location: any;
  menu: MenuItem[];
  reorderId?: string;
}) {
  const router = useRouter();
  const t = useTranslations("order");
  const toast = useToast();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"menu" | "time">("menu");
  const [arrivalTime, setArrivalTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!reorderId);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(reorderId || null);
  const [mealGift, setMealGift] = useState<any | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [acceptedGiftId, setAcceptedGiftId] = useState<string | null>(null);

  // If reorderId is provided, load the order and skip to time selection
  useEffect(() => {
    if (!reorderId) return;

    async function loadReorder() {
      try {
        const response = await fetch(`${BASE}/orders/${reorderId}`);
        if (!response.ok) {
          throw new Error("Failed to load order");
        }

        const order = await response.json();

        // Populate cart from order items
        const cartData: Record<string, number> = {};
        order.items.forEach((item: any) => {
          cartData[item.menuItem.id] = item.quantity;
        });

        setCart(cartData);
        setStep("time");
        setLoading(false);
      } catch (error) {
        console.error("Failed to load reorder:", error);
        toast.error(t("errors.loadPreviousOrder"));
        router.push("/member/orders");
      }
    }

    loadReorder();
  }, [reorderId]);

  // Check for available meal gift at this location
  useEffect(() => {
    async function checkMealGift() {
      try {
        const response = await fetch(`${BASE}/meal-gifts/next/${location.id}`, {
          headers: { "x-tenant-slug": "oh" },
        });

        if (response.ok) {
          const gift = await response.json();
          setMealGift(gift);
          setShowGiftModal(true);
        }
      } catch (error) {
        console.error("Failed to check for meal gift:", error);
      }
    }

    checkMealGift();
  }, [location.id]);

  // Calculate price for an item based on flexible pricing
  function getItemPrice(item: MenuItem, quantity: number): number {
    // If quantity is within included amount, price is 0
    if (quantity <= item.includedQuantity) {
      return 0;
    }

    // If additionalPriceCents is 0, use basePriceCents for each item
    const effectiveAdditionalPrice = item.additionalPriceCents || item.basePriceCents;

    // If there's an included quantity, only charge for extras
    if (item.includedQuantity > 0) {
      const extraQuantity = quantity - item.includedQuantity;
      return item.basePriceCents + effectiveAdditionalPrice * (extraQuantity - 1);
    }

    // Standard pricing: base + additional for each extra
    return item.basePriceCents + effectiveAdditionalPrice * (quantity - 1);
  }

  // Separate menu by category
  const bases = menu.filter((item) => item.category === "base");
  const proteins = menu.filter((item) => item.category === "protein");
  const vegetables = menu.filter((item) => item.category === "vegetables");
  const toppings = menu.filter((item) => item.category === "toppings");
  const extras = menu.filter((item) => item.category === "extras");

  // Select base (radio button behavior - only one base allowed)
  function selectBase(itemId: string) {
    setCart((prev) => {
      // Remove all other bases from cart
      const newCart = { ...prev };
      bases.forEach((base) => {
        if (base.id !== itemId) {
          delete newCart[base.id];
        }
      });
      // Set the selected base to quantity 1
      newCart[itemId] = 1;
      return newCart;
    });
  }

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

  // Set quantity directly (for slider)
  function setQuantity(itemId: string, quantity: number) {
    setCart((prev) => {
      if (quantity === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: quantity };
    });
  }

  const totalCents = Object.entries(cart).reduce((sum, [itemId, qty]) => {
    const item = menu.find((m) => m.id === itemId);
    return sum + (item ? getItemPrice(item, qty) : 0);
  }, 0);

  const hasBase = bases.some((base) => cart[base.id] > 0);

  async function handleAcceptGift() {
    if (!mealGift) return;

    setAcceptedGiftId(mealGift.id);
    setShowGiftModal(false);
    toast.success(`You've accepted a $${(mealGift.amountCents / 100).toFixed(2)} meal gift!`);
  }

  async function handlePayForward() {
    if (!mealGift) return;

    try {
      const response = await fetch(`${BASE}/meal-gifts/${mealGift.id}/pay-forward`, {
        method: "POST",
        headers: { "x-tenant-slug": "oh" },
      });

      if (response.ok) {
        setShowGiftModal(false);
        toast.success("Your kindness continues the chain!");
      } else {
        toast.error("Failed to pay forward. Please try again.");
      }
    } catch (error) {
      console.error("Failed to pay forward:", error);
      toast.error("Failed to pay forward. Please try again.");
    }
  }

  function proceedToTime() {
    if (!hasBase) {
      toast.warning(t("errors.selectBase"));
      return;
    }
    setStep("time");
  }

  async function proceedToPayment() {
    if (!arrivalTime) {
      toast.warning(t("errors.selectArrivalTime"));
      return;
    }

    setSubmitting(true);

    // Calculate estimated arrival timestamp
    let estimatedArrival = new Date();
    if (arrivalTime !== "asap") {
      const minutes = parseInt(arrivalTime);
      estimatedArrival = new Date(Date.now() + minutes * 60 * 1000);
    }

    let order;

    if (existingOrderId) {
      // Update existing order with estimated arrival time
      const response = await fetch(`${BASE}/orders/${existingOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimatedArrival: estimatedArrival.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to update order:", errorData);
        toast.error(t("errors.updateOrder"));
        setSubmitting(false);
        return;
      }

      order = await response.json();
    } else {
      // Create a new order
      const items: CartItem[] = Object.entries(cart)
        .filter(([_, qty]) => qty > 0)
        .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

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

      order = await response.json();
    }

    setSubmitting(false);

    // Redirect to payment - use order.totalCents from server response
    // Include mealGiftId if a gift was accepted
    const paymentUrl = `/order/payment?orderId=${order.id}&orderNumber=${order.orderNumber}&total=${order.totalCents}${acceptedGiftId ? `&mealGiftId=${acceptedGiftId}` : ''}`;
    router.push(paymentUrl);
  }

  // Show loading state while loading reorder
  if (loading) {
    return (
      <div
        style={{
          minHeight: "400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🍜</div>
          <div>Loading your order...</div>
        </div>
      </div>
    );
  }

  // Arrival time options
  const timeOptions = [
    { value: "asap", label: "ASAP (between now and 5 minutes)", minutes: 0 },
    { value: "15", label: "15 minutes", minutes: 15 },
    { value: "30", label: "30 minutes", minutes: 30 },
    { value: "45", label: "45 minutes", minutes: 45 },
    { value: "60", label: "1 hour", minutes: 60 },
    { value: "90", label: "1.5 hours", minutes: 90 },
  ];

  if (step === "time") {
    return (
      <div>
        {/* Only show back button if not in reorder mode */}
        {!existingOrderId && (
          <button
            onClick={() => setStep("menu")}
            style={{
              marginBottom: 24,
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid #7C7A67",
              color: "#7C7A67",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            ← Back to Menu
          </button>
        )}

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
                  border: `2px solid ${isSelected ? "#7C7A67" : "#e5e7eb"}`,
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
                        background: "#7C7A67",
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
            const itemTotal = getItemPrice(item, qty);
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
                  {item.includedQuantity > 0 && qty <= item.includedQuantity && (
                    <span style={{ color: "#22c55e", marginLeft: 4 }}>
                      (included)
                    </span>
                  )}
                </span>
                <span>${(itemTotal / 100).toFixed(2)}</span>
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
            <span style={{ color: "#7C7A67" }}>
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
            background: arrivalTime ? "#7C7A67" : "#d1d5db",
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

  // Render helper for category sections with different controls
  function renderCategorySection(
    title: string,
    items: MenuItem[],
    controlType: "radio" | "counter" | "slider"
  ) {
    if (items.length === 0) return null;

    return (
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ marginBottom: 16 }}>{title}</h2>
        <div style={{ display: "grid", gap: controlType === "radio" ? 16 : 12 }}>
          {items.map((item) => {
            const qty = cart[item.id] || 0;
            const isSelected = qty > 0;

            // Radio button for base selection
            if (controlType === "radio") {
              return (
                <button
                  key={item.id}
                  onClick={() => selectBase(item.id)}
                  style={{
                    border: `2px solid ${isSelected ? "#7C7A67" : "#e5e7eb"}`,
                    borderRadius: 12,
                    padding: 20,
                    background: isSelected ? "#f0f4ff" : "white",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, marginBottom: 4 }}>{item.name}</h3>
                      {item.description && (
                        <p style={{ color: "#666", fontSize: "0.9rem", margin: "4px 0" }}>
                          {item.description}
                        </p>
                      )}
                      <p style={{ color: "#7C7A67", fontWeight: "bold", margin: 0 }}>
                        ${(item.basePriceCents / 100).toFixed(2)}
                      </p>
                    </div>
                    {isSelected && (
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#7C7A67",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                </button>
              );
            }

            // Slider for vegetables (especially useful for included quantities)
            if (controlType === "slider") {
              const maxQty = 5;
              return (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 16,
                    background: qty > 0 ? "#f9fafb" : "white",
                  }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong>{item.name}</strong>
                      <span style={{ fontWeight: "bold", color: "#7C7A67" }}>
                        {qty > 0 ? `${qty}x` : "—"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      {item.includedQuantity > 0 ? (
                        <span style={{ color: "#22c55e" }}>
                          {item.includedQuantity} included • +${(item.additionalPriceCents / 100).toFixed(2)} each extra
                        </span>
                      ) : (
                        <span>+${(item.basePriceCents / 100).toFixed(2)} each</span>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={maxQty}
                    value={qty}
                    onChange={(e) => setQuantity(item.id, parseInt(e.target.value))}
                    style={{
                      width: "100%",
                      height: 6,
                      borderRadius: 3,
                      background: `linear-gradient(to right, #7C7A67 0%, #7C7A67 ${(qty / maxQty) * 100}%, #e5e7eb ${(qty / maxQty) * 100}%, #e5e7eb 100%)`,
                      outline: "none",
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#999", marginTop: 4 }}>
                    <span>0</span>
                    <span>{maxQty}</span>
                  </div>
                </div>
              );
            }

            // Counter for proteins and other add-ons
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
                  <span style={{ color: "#666", marginLeft: 8, fontSize: "0.9rem" }}>
                    +${(item.basePriceCents / 100).toFixed(2)}
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
                      <span style={{ minWidth: 20, textAlign: "center" }}>{qty}</span>
                    </>
                  )}
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "none",
                      background: "#7C7A67",
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
    );
  }

  // Menu step with category-based organization
  return (
    <div>
      {renderCategorySection("Step 1: Choose Your Base", bases, "radio")}
      {renderCategorySection("Step 2: Add Protein", proteins, "counter")}
      {renderCategorySection("Step 3: Add Vegetables", vegetables, "slider")}
      {renderCategorySection("Toppings", toppings, "counter")}
      {renderCategorySection("Extras", extras, "counter")}

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
            <strong style={{ fontSize: "1.1rem", color: "#7C7A67" }}>
              ${(totalCents / 100).toFixed(2)}
            </strong>
          </div>

          <button
            onClick={proceedToTime}
            disabled={!hasBase}
            style={{
              width: "100%",
              padding: 16,
              background: hasBase ? "#7C7A67" : "#d1d5db",
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

      {/* Meal Gift Modal */}
      {showGiftModal && mealGift && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 32,
              maxWidth: 500,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            {/* Gift Icon */}
            <div style={{ textAlign: "center", fontSize: "4rem", marginBottom: 16 }}>
              🎁
            </div>

            {/* Title */}
            <h2 style={{ textAlign: "center", marginBottom: 16, fontSize: "1.8rem" }}>
              You've Got a Gift!
            </h2>

            {/* Amount */}
            <div
              style={{
                textAlign: "center",
                fontSize: "2.5rem",
                fontWeight: "bold",
                color: "#7C7A67",
                marginBottom: 16,
              }}
            >
              ${(mealGift.amountCents / 100).toFixed(2)}
            </div>

            {/* Message */}
            {mealGift.messageFromGiver && (
              <div
                style={{
                  background: "#f9fafb",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 24,
                  fontStyle: "italic",
                  textAlign: "center",
                  color: "#666",
                }}
              >
                "{mealGift.messageFromGiver}"
              </div>
            )}

            {/* Info */}
            <p style={{ textAlign: "center", color: "#666", marginBottom: 24 }}>
              {mealGift.giver?.name || "Someone"} gifted a meal to the next solo diner at this location. That's you!
            </p>

            {/* Buttons */}
            <div style={{ display: "grid", gap: 12 }}>
              <button
                onClick={handleAcceptGift}
                style={{
                  width: "100%",
                  padding: 16,
                  background: "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: 12,
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Accept Gift
              </button>

              <button
                onClick={handlePayForward}
                style={{
                  width: "100%",
                  padding: 16,
                  background: "transparent",
                  color: "#7C7A67",
                  border: "2px solid #7C7A67",
                  borderRadius: 12,
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Pay It Forward
              </button>
            </div>

            <p style={{ textAlign: "center", fontSize: "0.85rem", color: "#999", marginTop: 16, marginBottom: 0 }}>
              Paying it forward continues the kindness chain to the next person
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
