"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type Location = {
  id: string;
  name: string;
  tenantId: string;
};

type MenuItem = {
  id: string;
  name: string;
  basePriceCents: number;
  additionalPriceCents: number;
  includedQuantity: number;
  category?: string;
  selectionMode?: string;
  sliderConfig?: any;
  isAvailable: boolean;
};

type MenuSection = {
  id: string;
  name: string;
  description?: string;
  selectionMode: string;
  required: boolean;
  items?: MenuItem[];
  sliderConfig?: any;
  item?: MenuItem;
  maxQuantity?: number;
};

type MenuStep = {
  id: string;
  title: string;
  sections: MenuSection[];
};

type GuestOrder = {
  guestNumber: number;
  guestName: string;
  cart: Record<string, number>;
  sliderLabels: Record<string, string>;
  selections: Record<string, string>;
  orderId?: string;
  orderNumber?: string;
  totalCents?: number;
  paid: boolean;
};

export default function KioskOrderFlow({
  location,
  partySize,
  paymentType,
}: {
  location: Location;
  partySize: number;
  paymentType: "single" | "separate";
}) {
  const router = useRouter();
  const [menuSteps, setMenuSteps] = useState<MenuStep[]>([]);
  const [loading, setLoading] = useState(true);

  // Track all guest orders
  const [guestOrders, setGuestOrders] = useState<GuestOrder[]>(
    Array.from({ length: partySize }, (_, i) => ({
      guestNumber: i + 1,
      guestName: "",
      cart: {},
      sliderLabels: {},
      selections: {},
      paid: false,
    }))
  );

  // Current guest being served
  const [currentGuestIndex, setCurrentGuestIndex] = useState(0);

  // Current step in menu flow for current guest
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Current view: "name" | "menu" | "review" | "pass" | "payment" | "complete"
  const [view, setView] = useState<"name" | "menu" | "review" | "pass" | "payment" | "complete">("name");

  // Processing state
  const [submitting, setSubmitting] = useState(false);

  // Current guest's working state
  const currentGuest = guestOrders[currentGuestIndex];

  // Load menu structure
  useEffect(() => {
    async function loadMenu() {
      try {
        const response = await fetch(`${BASE}/menu/steps`, {
          headers: { "x-tenant-slug": "oh" },
        });
        const data = await response.json();
        setMenuSteps(data.steps);

        // Initialize cart with slider defaults for first guest
        const initialCart: Record<string, number> = {};
        const initialLabels: Record<string, string> = {};
        data.steps.forEach((step: MenuStep) => {
          step.sections.forEach((section: MenuSection) => {
            if (section.selectionMode === "SLIDER" && section.item && section.sliderConfig) {
              const defaultValue = section.sliderConfig.default ?? 0;
              initialCart[section.item.id] = defaultValue;
              const labels = section.sliderConfig.labels || [];
              initialLabels[section.item.id] = labels[defaultValue] || String(defaultValue);
            }
          });
        });

        // Update all guests with initial cart
        setGuestOrders((prev) =>
          prev.map((g) => ({
            ...g,
            cart: { ...initialCart },
            sliderLabels: { ...initialLabels },
          }))
        );

        setLoading(false);
      } catch (error) {
        console.error("Failed to load menu:", error);
        alert("Failed to load menu. Please try again.");
      }
    }

    loadMenu();
  }, []);

  function updateCurrentGuest(updates: Partial<GuestOrder>) {
    setGuestOrders((prev) =>
      prev.map((g, i) => (i === currentGuestIndex ? { ...g, ...updates } : g))
    );
  }

  function handleNameSubmit(name: string) {
    updateCurrentGuest({ guestName: name });
    setView("menu");
  }

  function handleCartUpdate(itemId: string, quantity: number) {
    updateCurrentGuest({
      cart: { ...currentGuest.cart, [itemId]: quantity },
    });
  }

  function handleSliderUpdate(itemId: string, value: number, label: string) {
    updateCurrentGuest({
      cart: { ...currentGuest.cart, [itemId]: value },
      sliderLabels: { ...currentGuest.sliderLabels, [itemId]: label },
    });
  }

  function handleSelectionUpdate(sectionId: string, itemId: string) {
    updateCurrentGuest({
      selections: { ...currentGuest.selections, [sectionId]: itemId },
    });
  }

  function nextStep() {
    if (currentStepIndex < menuSteps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setView("review");
    }
  }

  function previousStep() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }

  async function submitCurrentGuestOrder() {
    setSubmitting(true);

    // Build items array
    const items: Array<{ menuItemId: string; quantity: number; selectedValue?: string }> = [];

    // Add radio selections
    Object.values(currentGuest.selections).forEach((itemId) => {
      items.push({ menuItemId: itemId, quantity: 1 });
    });

    // Add cart items
    Object.entries(currentGuest.cart).forEach(([itemId, qty]) => {
      const isSliderItem = itemId in currentGuest.sliderLabels;
      if (isSliderItem || qty > 0) {
        const selectedValue = currentGuest.sliderLabels[itemId];
        items.push({ menuItemId: itemId, quantity: qty, selectedValue });
      }
    });

    try {
      const response = await fetch(`${BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          tenantId: location.tenantId,
          items,
          estimatedArrival: new Date().toISOString(),
          fulfillmentType: "WALK_IN",
          guestName: currentGuest.guestName,
          isKioskOrder: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create order");
      }

      const order = await response.json();

      // Update guest with order info
      updateCurrentGuest({
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
      });

      setSubmitting(false);

      // Handle payment flow based on payment type
      if (paymentType === "separate") {
        // Each person pays individually - go to payment
        setView("payment");
      } else {
        // One check - go to pass screen or final payment
        if (currentGuestIndex < partySize - 1) {
          setView("pass");
        } else {
          // All guests done, go to final payment
          setView("payment");
        }
      }
    } catch (error) {
      console.error("Failed to submit order:", error);
      alert("Failed to submit order. Please try again.");
      setSubmitting(false);
    }
  }

  async function handlePayment() {
    setSubmitting(true);

    try {
      if (paymentType === "separate") {
        // Pay only current guest's order
        const response = await fetch(`${BASE}/orders/${currentGuest.orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentStatus: "PAID" }),
        });

        if (!response.ok) throw new Error("Payment failed");

        updateCurrentGuest({ paid: true });

        // Move to next guest or complete
        if (currentGuestIndex < partySize - 1) {
          setView("pass");
        } else {
          setView("complete");
        }
      } else {
        // Single check - pay all orders
        for (const guest of guestOrders) {
          if (guest.orderId) {
            await fetch(`${BASE}/orders/${guest.orderId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentStatus: "PAID" }),
            });
          }
        }

        // Mark all as paid
        setGuestOrders((prev) => prev.map((g) => ({ ...g, paid: true })));
        setView("complete");
      }
    } catch (error) {
      console.error("Payment failed:", error);
      alert("Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function passToNextGuest() {
    // Reset for next guest
    setCurrentGuestIndex((prev) => prev + 1);
    setCurrentStepIndex(0);
    setView("name");
  }

  function startOver() {
    router.push("/kiosk");
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a1a",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: 16 }}>Oh!</div>
          <div style={{ fontSize: "1.25rem" }}>Loading menu...</div>
        </div>
      </main>
    );
  }

  // Name entry view
  if (view === "name") {
    return (
      <NameEntryView
        guestNumber={currentGuestIndex + 1}
        totalGuests={partySize}
        onSubmit={handleNameSubmit}
        onCancel={startOver}
      />
    );
  }

  // Menu building view
  if (view === "menu") {
    const currentStep = menuSteps[currentStepIndex];
    return (
      <MenuView
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={menuSteps.length}
        guestName={currentGuest.guestName}
        guestNumber={currentGuestIndex + 1}
        totalGuests={partySize}
        cart={currentGuest.cart}
        sliderLabels={currentGuest.sliderLabels}
        selections={currentGuest.selections}
        onCartUpdate={handleCartUpdate}
        onSliderUpdate={handleSliderUpdate}
        onSelectionUpdate={handleSelectionUpdate}
        onNext={nextStep}
        onPrevious={previousStep}
        canGoBack={currentStepIndex > 0}
      />
    );
  }

  // Order review view
  if (view === "review") {
    return (
      <ReviewView
        guestName={currentGuest.guestName}
        guestNumber={currentGuestIndex + 1}
        totalGuests={partySize}
        cart={currentGuest.cart}
        sliderLabels={currentGuest.sliderLabels}
        selections={currentGuest.selections}
        menuSteps={menuSteps}
        onSubmit={submitCurrentGuestOrder}
        onBack={() => setView("menu")}
        submitting={submitting}
      />
    );
  }

  // Pass to next guest view
  if (view === "pass") {
    return (
      <PassView
        completedGuestName={currentGuest.guestName}
        nextGuestNumber={currentGuestIndex + 2}
        totalGuests={partySize}
        orderNumber={currentGuest.orderNumber || ""}
        paymentType={paymentType}
        onPassDevice={passToNextGuest}
      />
    );
  }

  // Payment view
  if (view === "payment") {
    return (
      <PaymentView
        paymentType={paymentType}
        guestOrders={guestOrders}
        currentGuestIndex={currentGuestIndex}
        onPay={handlePayment}
        submitting={submitting}
      />
    );
  }

  // Complete view
  if (view === "complete") {
    return (
      <CompleteView
        guestOrders={guestOrders}
        onNewOrder={startOver}
      />
    );
  }

  return null;
}

// ==================== Sub-components ====================

function NameEntryView({
  guestNumber,
  totalGuests,
  onSubmit,
  onCancel,
}: {
  guestNumber: number;
  totalGuests: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        color: "white",
        padding: 48,
      }}
    >
      <div style={{ fontSize: "1rem", color: "#999", marginBottom: 8 }}>
        Guest {guestNumber} of {totalGuests}
      </div>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: 32, textAlign: "center" }}>
        What's your name?
      </h1>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
        autoFocus
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "20px 24px",
          fontSize: "1.5rem",
          border: "3px solid #7C7A67",
          borderRadius: 16,
          background: "rgba(255,255,255,0.1)",
          color: "white",
          textAlign: "center",
          marginBottom: 32,
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onSubmit(name.trim());
          }
        }}
      />

      <div style={{ display: "flex", gap: 16 }}>
        <button
          onClick={onCancel}
          style={{
            padding: "16px 32px",
            background: "transparent",
            border: "2px solid #666",
            borderRadius: 12,
            color: "#999",
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => name.trim() && onSubmit(name.trim())}
          disabled={!name.trim()}
          style={{
            padding: "16px 48px",
            background: name.trim() ? "#7C7A67" : "#444",
            border: "none",
            borderRadius: 12,
            color: "white",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: name.trim() ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </main>
  );
}

function MenuView({
  step,
  stepIndex,
  totalSteps,
  guestName,
  guestNumber,
  totalGuests,
  cart,
  sliderLabels,
  selections,
  onCartUpdate,
  onSliderUpdate,
  onSelectionUpdate,
  onNext,
  onPrevious,
  canGoBack,
}: {
  step: MenuStep;
  stepIndex: number;
  totalSteps: number;
  guestName: string;
  guestNumber: number;
  totalGuests: number;
  cart: Record<string, number>;
  sliderLabels: Record<string, string>;
  selections: Record<string, string>;
  onCartUpdate: (itemId: string, quantity: number) => void;
  onSliderUpdate: (itemId: string, value: number, label: string) => void;
  onSelectionUpdate: (sectionId: string, itemId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  canGoBack: boolean;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#1a1a1a",
        color: "white",
        padding: 32,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
          paddingBottom: 16,
          borderBottom: "1px solid #333",
        }}
      >
        <div>
          <div style={{ fontSize: "0.9rem", color: "#999" }}>
            Ordering for {guestName} ({guestNumber}/{totalGuests})
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{step.title}</h1>
        </div>
        <div style={{ fontSize: "0.9rem", color: "#999" }}>
          Step {stepIndex + 1} of {totalSteps}
        </div>
      </div>

      {/* Menu sections */}
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {step.sections.map((section) => (
          <div key={section.id} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1.25rem", marginBottom: 8 }}>{section.name}</h2>
            {section.description && (
              <p style={{ color: "#999", marginBottom: 16, fontSize: "0.9rem" }}>
                {section.description}
              </p>
            )}

            {/* Radio selection mode */}
            {section.selectionMode === "SINGLE" && section.items && (
              <div style={{ display: "grid", gap: 12 }}>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectionUpdate(section.id, item.id)}
                    style={{
                      padding: 20,
                      background:
                        selections[section.id] === item.id
                          ? "#7C7A67"
                          : "rgba(255,255,255,0.05)",
                      border:
                        selections[section.id] === item.id
                          ? "2px solid #7C7A67"
                          : "2px solid #333",
                      borderRadius: 12,
                      color: "white",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.basePriceCents > 0 && (
                      <div style={{ color: "#999", fontSize: "0.85rem" }}>
                        +${(item.basePriceCents / 100).toFixed(2)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Checkbox/counter mode */}
            {section.selectionMode === "MULTIPLE" && section.items && (
              <div style={{ display: "grid", gap: 12 }}>
                {section.items.map((item) => {
                  const qty = cart[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: 16,
                        background: "rgba(255,255,255,0.05)",
                        border: "2px solid #333",
                        borderRadius: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        {item.additionalPriceCents > 0 && (
                          <div style={{ color: "#999", fontSize: "0.85rem" }}>
                            +${(item.additionalPriceCents / 100).toFixed(2)} each
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <button
                          onClick={() => onCartUpdate(item.id, Math.max(0, qty - 1))}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            border: "none",
                            background: qty > 0 ? "#7C7A67" : "#333",
                            color: "white",
                            fontSize: "1.5rem",
                            cursor: "pointer",
                          }}
                        >
                          -
                        </button>
                        <span style={{ minWidth: 30, textAlign: "center", fontSize: "1.25rem" }}>
                          {qty}
                        </span>
                        <button
                          onClick={() => onCartUpdate(item.id, qty + 1)}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            border: "none",
                            background: "#7C7A67",
                            color: "white",
                            fontSize: "1.5rem",
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
            )}

            {/* Slider mode */}
            {section.selectionMode === "SLIDER" && section.item && section.sliderConfig && (
              <div style={{ padding: 20 }}>
                <input
                  type="range"
                  min={section.sliderConfig.min || 0}
                  max={section.sliderConfig.max || 3}
                  value={cart[section.item.id] || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const labels = section.sliderConfig.labels || [];
                    onSliderUpdate(section.item!.id, val, labels[val] || String(val));
                  }}
                  style={{ width: "100%", height: 8, cursor: "pointer" }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                    color: "#999",
                    fontSize: "0.85rem",
                  }}
                >
                  {section.sliderConfig.labels?.map((label: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        color: cart[section.item!.id] === i ? "#7C7A67" : "#999",
                        fontWeight: cart[section.item!.id] === i ? 600 : 400,
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 24,
          background: "linear-gradient(transparent, #1a1a1a 30%)",
          display: "flex",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {canGoBack && (
          <button
            onClick={onPrevious}
            style={{
              padding: "16px 32px",
              background: "transparent",
              border: "2px solid #666",
              borderRadius: 12,
              color: "#999",
              fontSize: "1.1rem",
              cursor: "pointer",
            }}
          >
            Back
          </button>
        )}
        <button
          onClick={onNext}
          style={{
            padding: "16px 48px",
            background: "#7C7A67",
            border: "none",
            borderRadius: 12,
            color: "white",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {stepIndex === totalSteps - 1 ? "Review Order" : "Next"}
        </button>
      </div>
    </main>
  );
}

function ReviewView({
  guestName,
  guestNumber,
  totalGuests,
  cart,
  sliderLabels,
  selections,
  menuSteps,
  onSubmit,
  onBack,
  submitting,
}: {
  guestName: string;
  guestNumber: number;
  totalGuests: number;
  cart: Record<string, number>;
  sliderLabels: Record<string, string>;
  selections: Record<string, string>;
  menuSteps: MenuStep[];
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  // Calculate items for display
  const items: Array<{ name: string; quantity?: number; value?: string }> = [];

  menuSteps.forEach((step) => {
    step.sections.forEach((section) => {
      if (section.selectionMode === "SINGLE" && selections[section.id]) {
        const selectedItem = section.items?.find((i) => i.id === selections[section.id]);
        if (selectedItem) {
          items.push({ name: selectedItem.name });
        }
      } else if (section.selectionMode === "MULTIPLE" && section.items) {
        section.items.forEach((item) => {
          const qty = cart[item.id];
          if (qty && qty > 0) {
            items.push({ name: item.name, quantity: qty });
          }
        });
      } else if (section.selectionMode === "SLIDER" && section.item) {
        const label = sliderLabels[section.item.id];
        if (label) {
          items.push({ name: section.item.name, value: label });
        }
      }
    });
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#1a1a1a",
        color: "white",
        padding: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: "0.9rem", color: "#999", marginBottom: 8 }}>
        Guest {guestNumber} of {totalGuests}
      </div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>
        {guestName}'s Order
      </h1>
      <p style={{ color: "#999", marginBottom: 32 }}>Please review before submitting</p>

      <div
        style={{
          width: "100%",
          maxWidth: 500,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 32,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: i < items.length - 1 ? "1px solid #333" : "none",
            }}
          >
            <span>{item.name}</span>
            <span style={{ color: "#999" }}>
              {item.quantity && item.quantity > 1 ? `x${item.quantity}` : ""}
              {item.value || ""}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <button
          onClick={onBack}
          disabled={submitting}
          style={{
            padding: "16px 32px",
            background: "transparent",
            border: "2px solid #666",
            borderRadius: 12,
            color: "#999",
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          Edit Order
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            padding: "16px 48px",
            background: submitting ? "#555" : "#7C7A67",
            border: "none",
            borderRadius: 12,
            color: "white",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Submitting..." : "Submit Order"}
        </button>
      </div>
    </main>
  );
}

function PassView({
  completedGuestName,
  nextGuestNumber,
  totalGuests,
  orderNumber,
  paymentType,
  onPassDevice,
}: {
  completedGuestName: string;
  nextGuestNumber: number;
  totalGuests: number;
  orderNumber: string;
  paymentType: "single" | "separate";
  onPassDevice: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        color: "white",
        padding: 48,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "4rem", marginBottom: 24 }}>
        {paymentType === "separate" ? "Paid!" : "Done!"}
      </div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>
        {completedGuestName}'s order is {paymentType === "separate" ? "complete" : "submitted"}!
      </h1>
      <p style={{ color: "#999", marginBottom: 8 }}>Order #{orderNumber}</p>

      <div
        style={{
          marginTop: 48,
          padding: 32,
          background: "rgba(124, 122, 103, 0.2)",
          borderRadius: 16,
          border: "2px solid #7C7A67",
        }}
      >
        <div style={{ fontSize: "1.25rem", marginBottom: 8 }}>
          Pass the device to Guest #{nextGuestNumber}
        </div>
        <div style={{ color: "#999", fontSize: "0.9rem" }}>
          {totalGuests - nextGuestNumber + 1} guest{totalGuests - nextGuestNumber > 0 ? "s" : ""}{" "}
          remaining
        </div>
      </div>

      <button
        onClick={onPassDevice}
        style={{
          marginTop: 48,
          padding: "20px 64px",
          background: "#7C7A67",
          border: "none",
          borderRadius: 16,
          color: "white",
          fontSize: "1.25rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Next Guest Ready
      </button>
    </main>
  );
}

function PaymentView({
  paymentType,
  guestOrders,
  currentGuestIndex,
  onPay,
  submitting,
}: {
  paymentType: "single" | "separate";
  guestOrders: GuestOrder[];
  currentGuestIndex: number;
  onPay: () => void;
  submitting: boolean;
}) {
  const currentGuest = guestOrders[currentGuestIndex];
  const totalCents =
    paymentType === "single"
      ? guestOrders.reduce((sum, g) => sum + (g.totalCents || 0), 0)
      : currentGuest.totalCents || 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        color: "white",
        padding: 48,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: 16 }}>Payment</h1>

      {paymentType === "single" ? (
        <>
          <p style={{ color: "#999", marginBottom: 32 }}>
            One check for {guestOrders.length} guests
          </p>
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 32,
              minWidth: 300,
            }}
          >
            {guestOrders.map((g, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: i < guestOrders.length - 1 ? "1px solid #333" : "none",
                }}
              >
                <span>{g.guestName}</span>
                <span>${((g.totalCents || 0) / 100).toFixed(2)}</span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 16,
                marginTop: 8,
                borderTop: "2px solid #7C7A67",
                fontWeight: 700,
                fontSize: "1.25rem",
              }}
            >
              <span>Total</span>
              <span>${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: "#999", marginBottom: 32 }}>{currentGuest.guestName}'s payment</p>
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 700,
              marginBottom: 32,
              color: "#7C7A67",
            }}
          >
            ${(totalCents / 100).toFixed(2)}
          </div>
        </>
      )}

      <div
        style={{
          padding: 16,
          background: "#fef3c7",
          border: "1px solid #fbbf24",
          borderRadius: 12,
          marginBottom: 32,
          color: "#92400e",
          fontSize: "0.9rem",
        }}
      >
        Demo Mode - Tap to simulate payment
      </div>

      <button
        onClick={onPay}
        disabled={submitting}
        style={{
          padding: "20px 64px",
          background: submitting ? "#555" : "#22c55e",
          border: "none",
          borderRadius: 16,
          color: "white",
          fontSize: "1.25rem",
          fontWeight: 600,
          cursor: submitting ? "wait" : "pointer",
        }}
      >
        {submitting ? "Processing..." : `Pay $${(totalCents / 100).toFixed(2)}`}
      </button>
    </main>
  );
}

function CompleteView({
  guestOrders,
  onNewOrder,
}: {
  guestOrders: GuestOrder[];
  onNewOrder: () => void;
}) {
  const [countdown, setCountdown] = useState(30);

  // Auto-reset countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onNewOrder();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onNewOrder]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        color: "white",
        padding: 48,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "5rem", marginBottom: 24 }}>All Done!</div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 16 }}>
        Your orders are confirmed!
      </h1>
      <p style={{ color: "#999", marginBottom: 48 }}>
        Please select your pod(s) on the seating map
      </p>

      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 16,
          padding: 32,
          marginBottom: 48,
        }}
      >
        <h2 style={{ marginBottom: 16, fontSize: "1.25rem" }}>Your Order Numbers</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          {guestOrders.map((g) => (
            <div
              key={g.guestNumber}
              style={{
                padding: "16px 24px",
                background: "#7C7A67",
                borderRadius: 12,
                minWidth: 120,
              }}
            >
              <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>{g.guestName}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>#{g.orderNumber}</div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onNewOrder}
        style={{
          padding: "20px 64px",
          background: "#7C7A67",
          border: "none",
          borderRadius: 16,
          color: "white",
          fontSize: "1.25rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Start New Order
      </button>

      <p style={{ marginTop: 24, color: "#666", fontSize: "0.85rem" }}>
        Screen will reset automatically in {countdown} seconds
      </p>
    </main>
  );
}
