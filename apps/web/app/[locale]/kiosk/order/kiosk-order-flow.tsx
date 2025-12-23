"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Consistent kiosk color system
const COLORS = {
  primary: "#7C7A67",
  primaryDark: "#5A5847", // Darker olive for slider thumb
  primaryLight: "rgba(124, 122, 103, 0.15)",
  primaryBorder: "rgba(124, 122, 103, 0.4)",
  surface: "#FFFFFF",
  surfaceElevated: "#FAFAFA",
  surfaceDark: "#1a1a1a",
  text: "#1a1a1a",
  textLight: "#666666",
  textMuted: "#999999",
  textOnPrimary: "#FFFFFF",
  textOnDark: "#FFFFFF",
  success: "#22c55e",
  successLight: "rgba(34, 197, 94, 0.1)",
  warning: "#f59e0b",
  warningLight: "rgba(245, 158, 11, 0.1)",
  error: "#ef4444",
  border: "#e5e5e5",
  borderDark: "#333333",
};

// CSS for custom slider thumb styling
const sliderThumbStyles = `
  input[type="range"].kiosk-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  input[type="range"].kiosk-slider::-webkit-slider-runnable-track {
    height: 10px;
    background: #e5e5e5;
    border-radius: 5px;
  }

  input[type="range"].kiosk-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 36px;
    height: 36px;
    background: #5A5847;
    border-radius: 50%;
    margin-top: -13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    border: 3px solid #FFFFFF;
  }

  input[type="range"].kiosk-slider::-moz-range-track {
    height: 10px;
    background: #e5e5e5;
    border-radius: 5px;
  }

  input[type="range"].kiosk-slider::-moz-range-thumb {
    width: 30px;
    height: 30px;
    background: #5A5847;
    border-radius: 50%;
    border: 3px solid #FFFFFF;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
`;

// Brand component for consistent branding across all kiosk screens
function KioskBrand({ size = "normal" }: { size?: "small" | "normal" | "large" }) {
  const sizes = {
    small: { logo: 32, chinese: "1.2rem", english: "0.65rem", gap: 4 },
    normal: { logo: 48, chinese: "1.8rem", english: "0.95rem", gap: 6 },
    large: { logo: 96, chinese: "3.5rem", english: "1.8rem", gap: 10 },
  };
  const s = sizes[size];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: s.gap }}>
      <img
        src="/Oh_Logo_Large.png"
        alt="Oh! Logo"
        style={{ width: s.logo, height: s.logo, objectFit: "contain" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            fontFamily: '"Ma Shan Zheng", cursive',
            fontSize: s.chinese,
            color: "#C7A878",
            lineHeight: 1,
          }}
        >
          哦
        </span>
        <span
          style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: s.english,
            color: COLORS.text,
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          Oh! Beef Noodle Soup
        </span>
      </div>
    </div>
  );
}

// Menu item image mapping - using correct file names from /public/menu images/
// Keys match exact API names from /menu/steps endpoint
const MENU_IMAGES: Record<string, string> = {
  // Bowls - exact API names
  "A5 Wagyu Beef Noodle Soup": "/menu images/A5 Wagyu Bowl.png",
  "Classic Beef Noodle Soup": "/menu images/Classic Bowl.png",
  "Classic Beef Noodle Soup (no beef)": "/menu images/Classic Bowl No Beef.png",
  // Legacy/alternate names
  "A5 Wagyu Noodle Soup": "/menu images/A5 Wagyu Bowl.png",
  "Classic Beef Noodle Soup (No Beef)": "/menu images/Classic Bowl No Beef.png",
  "Classic Bowl": "/menu images/Classic Bowl.png",
  "Classic Bowl (No Beef)": "/menu images/Classic Bowl No Beef.png",
  "A5 Wagyu Bowl": "/menu images/A5 Wagyu Bowl.png",
  // Noodles
  "Ramen Noodles": "/menu images/Ramen Noodles.png",
  "Shaved Noodles": "/menu images/Shaved Noodles.png",
  "Wide Noodles": "/menu images/Wide Noodles.png",
  // Toppings & Add-Ons
  "Baby Bok Choy": "/menu images/Baby Bok Choy.png",
  "Beef Marrow": "/menu images/Beef Marrow.png",
  "Bone Marrow": "/menu images/Beef Marrow.png",
  "Cilantro": "/menu images/Cilantro.png",
  "Extra Beef": "/menu images/Extra Beef.png",
  "Extra Noodles": "/menu images/Wide Noodles.png",
  "Green Onions": "/menu images/Green Onions.png",
  "Pickled Greens": "/menu images/Pickled Greens.png",
  "Sprouts": "/menu images/Sprouts.png",
  // Egg variants (API has typo "Soft-Boild Egg")
  "Soft-Boild Egg": "/menu images/Soft Boiled Egg.png",
  "Soft-Boiled Egg": "/menu images/Soft Boiled Egg.png",
  "Soft Boiled Egg": "/menu images/Soft Boiled Egg.png",
  // Sides
  "Spicy Cucumbers": "/menu images/Spicy Cucumbers.png",
  "Spicy Green Beans": "/menu images/Spicy Green Beans.png",
  // Desserts
  "Mandarin Orange Sherbet": "/menu images/Mandarin Orange Sherbet.png",
  // Beverages - exact API names
  "Pepsi": "/menu images/Pepsi.jpg",
  "Diet Pepsi": "/menu images/DietPepsi.jpg",
  "Water (cold)": "/menu images/IceWater.jpeg",
  "Water (room temp)": "/menu images/RoomTempWater.jpeg",
};

type Location = {
  id: string;
  name: string;
  tenantId: string;
};

type Seat = {
  id: string;
  number: string;
  status: string;
  podType: "SINGLE" | "DUAL";
  row: number;
  col: number;
  side: string;
  dualPartnerId?: string;
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
  dailyOrderNumber?: number;
  totalCents?: number;
  paid: boolean;
  selectedPodId?: string;
};

// Helper to calculate item price
function calculateItemPrice(item: MenuItem, quantity: number): number {
  if (quantity <= 0) return 0;
  if (quantity <= item.includedQuantity) return 0;
  if (item.includedQuantity > 0) {
    const extraQuantity = quantity - item.includedQuantity;
    return item.basePriceCents + item.additionalPriceCents * (extraQuantity - 1);
  }
  return item.basePriceCents + item.additionalPriceCents * (quantity - 1);
}

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
  const t = useTranslations("order");
  const toast = useToast();
  const [menuSteps, setMenuSteps] = useState<MenuStep[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
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

  // Current view
  const [view, setView] = useState<
    "name" | "menu" | "review" | "pod-selection" | "pass" | "payment" | "complete"
  >("name");

  // Scroll to top when view or step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view, currentStepIndex, currentGuestIndex]);

  // Processing state
  const [submitting, setSubmitting] = useState(false);

  // Current guest's working state
  const currentGuest = guestOrders[currentGuestIndex];

  // Load menu structure and seats
  useEffect(() => {
    async function loadData() {
      try {
        const [menuRes, seatsRes] = await Promise.all([
          fetch(`${BASE}/menu/steps`, {
            headers: { "x-tenant-slug": "oh" },
          }),
          fetch(`${BASE}/locations/${location.id}/seats`, {
            headers: { "x-tenant-slug": "oh" },
          }),
        ]);

        const menuData = await menuRes.json();
        setMenuSteps(menuData.steps);

        if (seatsRes.ok) {
          const seatsData = await seatsRes.json();
          setSeats(seatsData);
        }

        // Initialize cart with slider defaults for first guest
        const initialCart: Record<string, number> = {};
        const initialLabels: Record<string, string> = {};
        menuData.steps.forEach((step: MenuStep) => {
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
        toast.error(t("errors.menuLoadFailed"));
      }
    }

    loadData();
  }, [location.id]);

  // Calculate running total for current guest
  const calculateRunningTotal = useCallback(() => {
    let total = 0;

    // Add selections (SINGLE mode items - bowls)
    Object.entries(currentGuest.selections).forEach(([sectionId, itemId]) => {
      menuSteps.forEach((step) => {
        step.sections.forEach((section) => {
          if (section.id === sectionId && section.items) {
            const item = section.items.find((i) => i.id === itemId);
            if (item) {
              total += item.basePriceCents;
            }
          }
        });
      });
    });

    // Add cart items (MULTIPLE mode and SLIDER mode)
    Object.entries(currentGuest.cart).forEach(([itemId, qty]) => {
      menuSteps.forEach((step) => {
        step.sections.forEach((section) => {
          if (section.selectionMode === "MULTIPLE" && section.items) {
            const item = section.items.find((i) => i.id === itemId);
            if (item && qty > 0) {
              total += calculateItemPrice(item, qty);
            }
          } else if (section.selectionMode === "SLIDER" && section.item?.id === itemId) {
            // Sliders typically don't add extra cost unless configured
          }
        });
      });
    });

    return total;
  }, [currentGuest.selections, currentGuest.cart, menuSteps]);

  function updateCurrentGuest(updates: Partial<GuestOrder>) {
    setGuestOrders((prev) =>
      prev.map((g, i) => (i === currentGuestIndex ? { ...g, ...updates } : g))
    );
  }

  function handleNameSubmit(name: string) {
    updateCurrentGuest({ guestName: name });
    setView("menu");
  }

  function handleCartUpdate(itemId: string, quantity: number, maxQuantity?: number) {
    const finalQty = maxQuantity !== undefined ? Math.min(quantity, maxQuantity) : quantity;
    updateCurrentGuest({
      cart: { ...currentGuest.cart, [itemId]: finalQty },
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

  function handlePodSelection(podId: string) {
    updateCurrentGuest({ selectedPodId: podId });
  }

  function handlePodConfirm() {
    if (paymentType === "single" && currentGuestIndex < partySize - 1) {
      // Single payment: cycle through all guests for pod selection
      setCurrentGuestIndex((prev) => prev + 1);
      // Stay on pod-selection view for next guest
    } else {
      // Move to payment after all pod selections
      setView("payment");
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

      // Update guest with order info - use kitchenOrderNumber from API
      updateCurrentGuest({
        orderId: order.id,
        orderNumber: order.orderNumber,
        dailyOrderNumber: order.kitchenOrderNumber,
        totalCents: order.totalCents,
      });

      setSubmitting(false);

      // Determine next view based on payment type and remaining guests
      if (paymentType === "single") {
        // Single payment: collect all orders first, then pod selection and payment at the end
        if (currentGuestIndex < partySize - 1) {
          // More guests to order - pass to next guest
          setView("pass");
        } else {
          // Last guest done - now do pod selection for everyone
          setCurrentGuestIndex(0); // Reset to first guest for pod selection
          setView("pod-selection");
        }
      } else {
        // Separate payment: each guest orders → pod → pays → next guest
        setView("pod-selection");
      }
    } catch (error) {
      console.error("Failed to submit order:", error);
      toast.error(t("errors.submitFailed"));
      setSubmitting(false);
    }
  }

  async function handlePayment() {
    setSubmitting(true);

    try {
      if (paymentType === "separate") {
        // Pay only current guest's order and assign pod
        const updates: any = { paymentStatus: "PAID", orderSource: "KIOSK" };
        if (currentGuest.selectedPodId) {
          updates.seatId = currentGuest.selectedPodId;
          updates.podSelectionMethod = "CUSTOMER_SELECTED";
          updates.podAssignedAt = new Date().toISOString();
          // Note: podConfirmedAt is NOT set here - customer must confirm at pod via QR scan
          updates.podReservationExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }

        const response = await fetch(`${BASE}/orders/${currentGuest.orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
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
        // Single check - pay all orders and assign pods
        for (const guest of guestOrders) {
          if (guest.orderId) {
            const updates: any = { paymentStatus: "PAID", orderSource: "KIOSK" };
            if (guest.selectedPodId) {
              updates.seatId = guest.selectedPodId;
              updates.podSelectionMethod = "CUSTOMER_SELECTED";
              updates.podAssignedAt = new Date().toISOString();
              // Note: podConfirmedAt is NOT set here - customer must confirm at pod via QR scan
              updates.podReservationExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            }

            await fetch(`${BASE}/orders/${guest.orderId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            });
          }
        }

        // Mark all as paid
        setGuestOrders((prev) => prev.map((g) => ({ ...g, paid: true })));
        setView("complete");
      }
    } catch (error) {
      console.error("Payment failed:", error);
      toast.error(t("errors.paymentFailed"));
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
          background: COLORS.surface,
          color: COLORS.text,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: 16, color: COLORS.primary }}>Oh!</div>
          <div style={{ fontSize: "1.25rem", color: COLORS.textMuted }}>Loading menu...</div>
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
        runningTotal={calculateRunningTotal()}
        onCartUpdate={handleCartUpdate}
        onSliderUpdate={handleSliderUpdate}
        onSelectionUpdate={handleSelectionUpdate}
        onNext={nextStep}
        onPrevious={previousStep}
        canGoBack={currentStepIndex > 0}
        menuSteps={menuSteps}
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

  // Pod selection view
  if (view === "pod-selection") {
    return (
      <PodSelectionView
        seats={seats}
        guestOrders={guestOrders}
        currentGuestIndex={currentGuestIndex}
        partySize={partySize}
        selectedPodId={currentGuest.selectedPodId}
        onSelectPod={handlePodSelection}
        onConfirm={handlePodConfirm}
        onBack={() => setView("review")}
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
        dailyOrderNumber={currentGuest.dailyOrderNumber}
        paymentType={paymentType}
        selectedPod={seats.find((s) => s.id === currentGuest.selectedPodId)}
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
        seats={seats}
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
        seats={seats}
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
        background: COLORS.surface,
        color: COLORS.text,
        padding: 48,
      }}
    >
      {/* Brand Header */}
      <div style={{ position: "absolute", top: 24, left: 24 }}>
        <KioskBrand size="normal" />
      </div>

      <div style={{ fontSize: "1rem", color: COLORS.textMuted, marginBottom: 8 }}>
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
          border: `3px solid ${COLORS.primary}`,
          borderRadius: 16,
          background: COLORS.surface,
          color: COLORS.text,
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
            border: `2px solid ${COLORS.border}`,
            borderRadius: 12,
            color: COLORS.textMuted,
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
            background: name.trim() ? COLORS.primary : "#ccc",
            border: "none",
            borderRadius: 12,
            color: COLORS.textOnPrimary,
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
  runningTotal,
  onCartUpdate,
  onSliderUpdate,
  onSelectionUpdate,
  onNext,
  onPrevious,
  canGoBack,
  menuSteps,
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
  runningTotal: number;
  onCartUpdate: (itemId: string, quantity: number, maxQuantity?: number) => void;
  onSliderUpdate: (itemId: string, value: number, label: string) => void;
  onSelectionUpdate: (sectionId: string, itemId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  canGoBack: boolean;
  menuSteps: MenuStep[];
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true); // Start visible

  // Check if there's content below the fold - update on scroll
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const hasOverflow = container.scrollHeight > container.clientHeight + 10; // 10px buffer
      // Show hint if there's overflow AND user hasn't scrolled to bottom (with 100px threshold)
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
      setShowScrollHint(hasOverflow && !isNearBottom);
    }
  }, []);

  // Scroll to top and check position on step change
  useEffect(() => {
    // Scroll the container to top when step changes
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    // Also scroll window for safety
    window.scrollTo({ top: 0, behavior: "instant" });
    // Check scroll position immediately
    checkScrollPosition();
    // Also check after a delay for images/content to load
    const timer1 = setTimeout(checkScrollPosition, 300);
    const timer2 = setTimeout(checkScrollPosition, 800);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [step, checkScrollPosition]);

  // Handle scroll to update hint visibility
  const handleScroll = useCallback(() => {
    checkScrollPosition();
  }, [checkScrollPosition]);

  // Handle slider change (no auto-scroll)
  const handleSliderChange = (itemId: string, value: number, labels: string[], defaultValue: number) => {
    onSliderUpdate(itemId, value, labels[value] || String(value));
  };

  // Check if this is the drinks & dessert step
  const isDrinksAndDessertStep = step.title.toLowerCase().includes("drink") || step.title.toLowerCase().includes("dessert");

  // Check if required selections are made for current step (step 1 = Build the Foundation)
  // On step 1, both soup and noodles sections must have a selection
  const isStep1 = stepIndex === 0;
  const requiredSectionsMet = step.sections
    .filter((section) => section.required)
    .every((section) => selections[section.id]);

  // Disable Next if step 1 requirements not met
  const canProceed = !isStep1 || requiredSectionsMet;

  return (
    <main
      style={{
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
        background: COLORS.surface,
        color: COLORS.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Fixed Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: COLORS.surface,
          padding: "20px 32px",
          borderBottom: `1px solid ${COLORS.border}`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Left: Guest info and step title */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.1rem", color: COLORS.textMuted }}>
              <strong style={{ color: COLORS.text }}>{guestName}'s</strong> Order ({guestNumber}/{totalGuests})
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "4px 0 0 0" }}>{step.title}</h1>
          </div>

          {/* Center: Brand - 3x larger */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <KioskBrand size="large" />
          </div>

          {/* Right: Step indicator with text */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <span style={{ fontSize: "1.1rem", color: COLORS.textMuted, fontWeight: 600 }}>
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === stepIndex ? 32 : 10,
                    height: 10,
                    borderRadius: 5,
                    background: i <= stepIndex ? COLORS.primary : COLORS.border,
                    transition: "all 0.3s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content - use more space */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          paddingBottom: 220,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Legend for slider recommendation indicator */}
          {step.sections.some((s) => s.selectionMode === "SLIDER") && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 12,
                marginBottom: 20,
                fontSize: "1.1rem",
                color: COLORS.text,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 28,
                  borderRadius: 8,
                  border: `2px dashed ${COLORS.primary}`,
                }}
              />
              <span style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "1.5rem" }}>=</span> <span style={{ fontFamily: '"Ma Shan Zheng", cursive', color: "#C7A878", fontSize: "1.5rem" }}>哦</span> Oh! Recommendation
              </span>
            </div>
          )}
          {step.sections.map((section) => (
            <div
              key={section.id}
              id={`section-${section.item?.id || section.id}`}
              style={{ marginBottom: 28 }}
            >
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 4, color: COLORS.text }}>
                {section.name
                  .replace(/Premium Add-?[Oo]ns/i, "Add-Ons")
                  .replace("Choose Your Noodles", "Choose Your Noodle Style")}
                {section.required && (
                  <span style={{ color: COLORS.primary, marginLeft: 8, fontSize: "0.9rem", fontWeight: 600 }}>
                    Required
                  </span>
                )}
              </h2>
              {section.description && (
                <p style={{ color: COLORS.textMuted, marginBottom: 10, marginTop: 0, fontSize: "0.9rem", lineHeight: 1.3 }}>
                  {/* Bold the recommended selection in "We recommend X for first-timers" */}
                  {section.description.includes("recommend") ? (
                    <>
                      {section.description.split(/\b(Light|Medium|Rich|Extra Rich|Firm|Soft|None|Mild|Spicy|Extra Spicy)\b/).map((part, i) =>
                        ["Light", "Medium", "Rich", "Extra Rich", "Firm", "Soft", "None", "Mild", "Spicy", "Extra Spicy"].includes(part) ? (
                          <strong key={i} style={{ color: COLORS.primary }}>{part}</strong>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </>
                  ) : (
                    section.description
                  )}
                </p>
              )}

              {/* Radio selection mode with images - compact cards */}
              {section.selectionMode === "SINGLE" && section.items && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 350px))", gap: 12 }}>
                  {section.items.map((item) => {
                    const isSelected = selections[section.id] === item.id;
                    const hasSelection = !!selections[section.id];
                    const imageUrl = MENU_IMAGES[item.name];
                    const isNoNoodles = item.name.toLowerCase().includes("no noodle");

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectionUpdate(section.id, item.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          padding: 0,
                          background: isSelected ? COLORS.primaryLight : COLORS.surfaceElevated,
                          border: isSelected
                            ? `3px solid ${COLORS.primary}`
                            : `2px solid ${COLORS.border}`,
                          borderRadius: 12,
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          textAlign: "left",
                          position: "relative",
                          opacity: hasSelection && !isSelected ? 0.3 : 1,
                        }}
                      >
                        {imageUrl ? (
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "#f5f5f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            <img
                              src={imageUrl}
                              alt={item.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </div>
                        ) : isNoNoodles ? (
                          // Creative "No Noodles" display
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4,
                            }}
                          >
                            <div style={{ fontSize: "3rem", opacity: 0.6 }}>🍜</div>
                            <div
                              style={{
                                position: "absolute",
                                width: 70,
                                height: 70,
                                border: `3px solid ${COLORS.error}`,
                                borderRadius: "50%",
                                transform: "rotate(-45deg)",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "-5%",
                                  width: "110%",
                                  height: 3,
                                  background: COLORS.error,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: "0.9rem", color: COLORS.textMuted, marginTop: 12 }}>
                              Just broth & toppings
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "#f5f5f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: "4rem" }}>🍜</span>
                          </div>
                        )}
                        <div style={{ padding: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: "1.15rem", color: COLORS.text }}>
                            {item.name}
                          </div>
                          {item.basePriceCents > 0 && (
                            <div style={{ color: COLORS.primary, fontSize: "1rem", marginTop: 3, fontWeight: 700 }}>
                              ${(item.basePriceCents / 100).toFixed(2)}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div
                            style={{
                              position: "absolute",
                              top: 12,
                              right: 12,
                              width: 72,
                              height: 72,
                              borderRadius: 36,
                              background: "rgba(245, 243, 239, 0.5)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 2,
                            }}
                          >
                            <span style={{ fontFamily: '"Ma Shan Zheng", cursive', fontSize: "2rem", color: "#C7A878", lineHeight: 1 }}>哦!</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C7A878" strokeWidth="3">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Multiple selection mode with images and prices - compact cards */}
              {section.selectionMode === "MULTIPLE" && section.items && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 350px))",
                  gap: 12,
                }}>
                  {section.items.map((item) => {
                    const qty = cart[item.id] || 0;
                    const imageUrl = MENU_IMAGES[item.name];
                    const maxQty = section.maxQuantity;
                    const itemPrice = calculateItemPrice(item, qty);
                    const isComplimentary = item.basePriceCents === 0 && item.additionalPriceCents === 0;
                    const isDessert = item.category?.toLowerCase() === "dessert" || section.name.toLowerCase().includes("dessert");

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          background: qty > 0 ? COLORS.primaryLight : COLORS.surfaceElevated,
                          border: qty > 0 ? `3px solid ${COLORS.primary}` : `2px solid ${COLORS.border}`,
                          borderRadius: 12,
                          overflow: "hidden",
                          transition: "all 0.2s",
                        }}
                      >
                        {imageUrl ? (
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "#f5f5f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            <img
                              src={imageUrl}
                              alt={item.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "#f5f5f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: "4rem" }}>
                              {item.name.toLowerCase().includes("drink") ? "🥤" :
                               item.name.toLowerCase().includes("tea") ? "🍵" :
                               item.name.toLowerCase().includes("water") ? "💧" : "🍽️"}
                            </span>
                          </div>
                        )}
                        <div
                          style={{
                            padding: 10,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: COLORS.text, fontSize: "1rem" }}>{item.name}</div>
                            {/* Show price for all items in drinks & dessert */}
                            {isDrinksAndDessertStep || item.basePriceCents > 0 || item.additionalPriceCents > 0 ? (
                              <div style={{ color: isDessert && isComplimentary ? COLORS.success : COLORS.primary, fontSize: "0.85rem", fontWeight: 600, marginTop: 2 }}>
                                {isDessert && isComplimentary ? (
                                  "Complimentary - $0.00"
                                ) : item.includedQuantity > 0 ? (
                                  <>
                                    <span style={{ color: COLORS.success }}>{item.includedQuantity} included</span>
                                    {item.additionalPriceCents > 0 && (
                                      <span style={{ color: COLORS.textMuted }}> • +${(item.additionalPriceCents / 100).toFixed(2)} each extra</span>
                                    )}
                                  </>
                                ) : (
                                  `$${(item.basePriceCents / 100).toFixed(2)}${item.additionalPriceCents > 0 ? ` (+$${(item.additionalPriceCents / 100).toFixed(2)} each)` : ""}`
                                )}
                              </div>
                            ) : null}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                            <button
                              onClick={() => onCartUpdate(item.id, Math.max(0, qty - 1))}
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: 12,
                                border: "none",
                                background: qty > 0 ? COLORS.primary : COLORS.border,
                                color: qty > 0 ? COLORS.textOnPrimary : COLORS.textMuted,
                                fontSize: "1.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              -
                            </button>
                            <span
                              style={{
                                minWidth: 44,
                                textAlign: "center",
                                fontSize: "1.75rem",
                                fontWeight: 700,
                                color: COLORS.text,
                              }}
                            >
                              {qty}
                            </span>
                            <button
                              onClick={() => onCartUpdate(item.id, qty + 1, maxQty)}
                              disabled={maxQty !== undefined && qty >= maxQty}
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: 12,
                                border: "none",
                                background: maxQty !== undefined && qty >= maxQty ? COLORS.border : COLORS.primary,
                                color: maxQty !== undefined && qty >= maxQty ? COLORS.textMuted : COLORS.textOnPrimary,
                                fontSize: "1.75rem",
                                fontWeight: 700,
                                cursor: maxQty !== undefined && qty >= maxQty ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
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
              )}

              {/* Slider mode with image and "Our Suggestion" indicator */}
              {section.selectionMode === "SLIDER" && section.item && section.sliderConfig && (
                <div
                  style={{
                    background: COLORS.surfaceElevated,
                    borderRadius: 12,
                    border: `2px solid ${COLORS.border}`,
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  {/* Image on left */}
                  {MENU_IMAGES[section.item.name] && (
                    <div
                      style={{
                        width: 100,
                        minHeight: 120,
                        flexShrink: 0,
                        background: "#f5f5f5",
                        position: "relative",
                      }}
                    >
                      <img
                        src={MENU_IMAGES[section.item.name]}
                        alt={section.item.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          position: "absolute",
                          top: 0,
                          left: 0,
                        }}
                      />
                    </div>
                  )}

                  {/* Content on right */}
                  <div style={{ flex: 1, padding: 14 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: COLORS.text }}>{section.item.name}</span>
                      <span
                        style={{
                          padding: "5px 14px",
                          background: COLORS.primaryDark,
                          borderRadius: 16,
                          fontWeight: 700,
                          color: COLORS.textOnPrimary,
                          fontSize: "0.9rem",
                        }}
                      >
                        {sliderLabels[section.item.id] || "Not set"}
                      </span>
                    </div>

                    {/* Slider with padding to keep labels within bounds */}
                    <div style={{ position: "relative", paddingTop: 8, paddingLeft: 40, paddingRight: 40 }}>
                      <input
                        type="range"
                        className="kiosk-slider"
                        min={section.sliderConfig.min || 0}
                        max={section.sliderConfig.max || 3}
                        value={cart[section.item.id] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          const labels = section.sliderConfig.labels || [];
                          handleSliderChange(section.item!.id, val, labels, section.sliderConfig.default ?? 0);
                        }}
                        style={{
                          width: "100%",
                          height: 10,
                          cursor: "pointer",
                        }}
                      />
                    </div>

                    {/* Labels below slider - using flexbox for even distribution */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 14,
                        fontSize: "1rem",
                        paddingLeft: 40,
                        paddingRight: 40,
                      }}
                    >
                      {section.sliderConfig.labels?.map((label: string, i: number) => {
                        const isDefault = i === (section.sliderConfig.default ?? 0);
                        const isSelected = cart[section.item!.id] === i;
                        return (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            <span
                              style={{
                                color: isSelected ? COLORS.primary : COLORS.text,
                                fontWeight: isSelected ? 700 : 500,
                                fontSize: isSelected ? "1.1rem" : "1rem",
                                transition: "all 0.2s",
                                padding: isDefault ? "4px 10px" : undefined,
                                border: isDefault ? `2px dashed ${COLORS.primary}` : undefined,
                                borderRadius: isDefault ? 8 : undefined,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll Hint - Prominent animated indicator */}
      {showScrollHint && (
        <div
          style={{
            position: "fixed",
            bottom: 180,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            zIndex: 15,
            animation: "scrollHintPulse 2s ease-in-out infinite",
          }}
        >
          {/* Animated chevrons on left - pointing down */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite", opacity: 0.9 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite 0.15s", marginTop: -6, opacity: 0.6 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite 0.3s", marginTop: -6, opacity: 0.3 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
          </div>

          <div
            style={{
              background: COLORS.primaryDark,
              color: COLORS.textOnPrimary,
              padding: "12px 28px",
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              fontSize: "1.1rem",
              fontWeight: 600,
            }}
          >
            <span>Scroll for more options</span>
          </div>

          {/* Animated chevrons on right - pointing down */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite", opacity: 0.9 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite 0.15s", marginTop: -6, opacity: 0.6 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite 0.3s", marginTop: -6, opacity: 0.3 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
          </div>
        </div>
      )}

      {/* Fixed Navigation with Running Total */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 20px 16px",
          background: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
          zIndex: 10,
        }}
      >
        {/* Running Total - larger */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: COLORS.primaryLight,
              padding: "12px 28px",
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ color: COLORS.textMuted, fontSize: "1.15rem", fontWeight: 500 }}>Order Subtotal:</span>
            <span style={{ color: COLORS.primary, fontWeight: 700, fontSize: "1.5rem" }}>
              ${(runningTotal / 100).toFixed(2)}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          {canGoBack && (
            <button
              onClick={onPrevious}
              style={{
                padding: "18px 40px",
                background: "transparent",
                border: `2px solid ${COLORS.border}`,
                borderRadius: 12,
                color: COLORS.textMuted,
                fontSize: "1.2rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={onNext}
            disabled={!canProceed}
            style={{
              padding: "18px 56px",
              background: canProceed ? COLORS.primary : "#ccc",
              border: "none",
              borderRadius: 12,
              color: canProceed ? COLORS.textOnPrimary : "#888",
              fontSize: "1.2rem",
              fontWeight: 600,
              cursor: canProceed ? "pointer" : "not-allowed",
            }}
          >
            {stepIndex === totalSteps - 1 ? "Review Order" : "Next"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-8px); }
        }
        @keyframes scrollHintPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
          50% { transform: translateX(-50%) scale(1.03); opacity: 0.95; }
        }
        @keyframes chevronBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        @keyframes chevronBounceHorizontal {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        ${sliderThumbStyles}
      `}</style>
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
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Categorize items for display
  const bowlItems: Array<{ name: string; price: number; image?: string; value?: string }> = [];
  const customizations: Array<{ name: string; value: string }> = [];
  const addOnItems: Array<{ name: string; quantity: number; price: number; image?: string }> = [];
  const drinkItems: Array<{ name: string; quantity: number; price: number; image?: string }> = [];
  const dessertItems: Array<{ name: string; quantity: number; price: number; image?: string }> = [];

  menuSteps.forEach((step) => {
    step.sections.forEach((section) => {
      if (section.selectionMode === "SINGLE" && selections[section.id]) {
        const selectedItem = section.items?.find((i) => i.id === selections[section.id]);
        if (selectedItem) {
          // Check if it's a bowl/base or noodle selection
          if (step.title.toLowerCase().includes("foundation") || section.name.toLowerCase().includes("bowl") || section.name.toLowerCase().includes("base")) {
            bowlItems.push({
              name: selectedItem.name,
              price: selectedItem.basePriceCents,
              image: MENU_IMAGES[selectedItem.name],
            });
          } else if (section.name.toLowerCase().includes("noodle")) {
            bowlItems.push({
              name: selectedItem.name,
              price: 0,
              image: MENU_IMAGES[selectedItem.name],
            });
          }
        }
      } else if (section.selectionMode === "SLIDER" && section.item) {
        const label = sliderLabels[section.item.id];
        if (label) {
          customizations.push({ name: section.item.name, value: label });
        }
      } else if (section.selectionMode === "MULTIPLE" && section.items) {
        section.items.forEach((item) => {
          const qty = cart[item.id];
          if (qty && qty > 0) {
            const price = calculateItemPrice(item, qty);
            const itemData = {
              name: item.name,
              quantity: qty,
              price,
              image: MENU_IMAGES[item.name],
            };

            // Categorize by type
            if (item.category?.toLowerCase() === "dessert" || section.name.toLowerCase().includes("dessert")) {
              dessertItems.push(itemData);
            } else if (item.category?.toLowerCase() === "drink" || section.name.toLowerCase().includes("drink") || section.name.toLowerCase().includes("beverage")) {
              drinkItems.push(itemData);
            } else {
              addOnItems.push(itemData);
            }
          }
        });
      }
    });
  });

  // Calculate subtotals
  const bowlSubtotal = bowlItems.reduce((sum, item) => sum + item.price, 0);
  const addOnsSubtotal = addOnItems.reduce((sum, item) => sum + item.price, 0);
  const drinksSubtotal = drinkItems.reduce((sum, item) => sum + item.price, 0);
  const dessertSubtotal = dessertItems.reduce((sum, item) => sum + item.price, 0);
  const orderTotal = bowlSubtotal + addOnsSubtotal + drinksSubtotal + dessertSubtotal;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLORS.surface,
        color: COLORS.text,
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto",
      }}
    >
      {/* Brand Header */}
      <div style={{ position: "absolute", top: 24, left: 24 }}>
        <KioskBrand size="normal" />
      </div>

      <div style={{ fontSize: "0.9rem", color: COLORS.textMuted, marginBottom: 8, marginTop: 48 }}>
        Guest {guestNumber} of {totalGuests}
      </div>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>
        {guestName}'s Order
      </h1>
      <p style={{ color: COLORS.textMuted, marginBottom: 24 }}>Review before submitting</p>

      <div style={{ width: "100%", maxWidth: 600 }}>
        {/* Bowl Configuration Section */}
        {(bowlItems.length > 0 || customizations.length > 0) && (
          <div
            style={{
              background: COLORS.surfaceElevated,
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, color: COLORS.primary }}>
              Bowl Configuration
            </h3>

            {/* Bowl selections */}
            {bowlItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < bowlItems.length - 1 || customizations.length > 0 ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.5rem" }}>🍜</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                </div>
                <span style={{ color: COLORS.primary, fontWeight: 600 }}>
                  {item.price > 0 ? `$${(item.price / 100).toFixed(2)}` : "Included"}
                </span>
              </div>
            ))}

            {/* Customizations (sliders) */}
            {customizations.map((item, i) => (
              <div
                key={`custom-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < customizations.length - 1 ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ color: COLORS.textLight }}>{item.name}</span>
                </div>
                <span style={{ color: COLORS.textMuted, fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}

            {/* Bowl subtotal */}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 8, borderTop: `1px dashed ${COLORS.border}` }}>
              <span style={{ fontWeight: 500 }}>Bowl Subtotal</span>
              <span style={{ fontWeight: 600, color: COLORS.primary }}>${(bowlSubtotal / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Add-Ons Section */}
        {addOnItems.length > 0 && (
          <div
            style={{
              background: COLORS.surfaceElevated,
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, color: COLORS.primary }}>
              Add-Ons & Sides
            </h3>

            {addOnItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < addOnItems.length - 1 ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.5rem" }}>🍽️</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                  {item.quantity > 1 && <span style={{ color: COLORS.textMuted }}> x{item.quantity}</span>}
                </div>
                <span style={{ color: COLORS.primary, fontWeight: 600 }}>
                  {item.price > 0 ? `$${(item.price / 100).toFixed(2)}` : "Included"}
                </span>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 8, borderTop: `1px dashed ${COLORS.border}` }}>
              <span style={{ fontWeight: 500 }}>Add-Ons Subtotal</span>
              <span style={{ fontWeight: 600, color: COLORS.primary }}>${(addOnsSubtotal / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Drinks Section */}
        {drinkItems.length > 0 && (
          <div
            style={{
              background: COLORS.surfaceElevated,
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, color: COLORS.primary }}>
              Drinks
            </h3>

            {drinkItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < drinkItems.length - 1 ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.5rem" }}>🥤</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                  {item.quantity > 1 && <span style={{ color: COLORS.textMuted }}> x{item.quantity}</span>}
                </div>
                <span style={{ color: COLORS.primary, fontWeight: 600 }}>${(item.price / 100).toFixed(2)}</span>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 8, borderTop: `1px dashed ${COLORS.border}` }}>
              <span style={{ fontWeight: 500 }}>Drinks Subtotal</span>
              <span style={{ fontWeight: 600, color: COLORS.primary }}>${(drinksSubtotal / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Dessert Section */}
        {dessertItems.length > 0 && (
          <div
            style={{
              background: COLORS.surfaceElevated,
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, color: COLORS.primary }}>
              Dessert
            </h3>

            {dessertItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < dessertItems.length - 1 ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.5rem" }}>🍨</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                  {item.quantity > 1 && <span style={{ color: COLORS.textMuted }}> x{item.quantity}</span>}
                </div>
                <span style={{ color: item.price === 0 ? COLORS.success : COLORS.primary, fontWeight: 600 }}>
                  {item.price === 0 ? "Complimentary" : `$${(item.price / 100).toFixed(2)}`}
                </span>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 8, borderTop: `1px dashed ${COLORS.border}` }}>
              <span style={{ fontWeight: 500 }}>Dessert Subtotal</span>
              <span style={{ fontWeight: 600, color: dessertSubtotal === 0 ? COLORS.success : COLORS.primary }}>
                {dessertSubtotal === 0 ? "$0.00" : `$${(dessertSubtotal / 100).toFixed(2)}`}
              </span>
            </div>
          </div>
        )}

        {/* Order Total */}
        <div
          style={{
            background: COLORS.primary,
            borderRadius: 14,
            padding: 20,
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: COLORS.textOnPrimary, fontSize: "1.1rem", fontWeight: 600 }}>Order Total</span>
          <span style={{ color: COLORS.textOnPrimary, fontSize: "1.5rem", fontWeight: 700 }}>
            ${(orderTotal / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <button
          onClick={onBack}
          disabled={submitting}
          style={{
            padding: "14px 28px",
            background: "transparent",
            border: `2px solid ${COLORS.border}`,
            borderRadius: 10,
            color: COLORS.textMuted,
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Edit Order
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            padding: "14px 40px",
            background: submitting ? "#ccc" : COLORS.primary,
            border: "none",
            borderRadius: 10,
            color: COLORS.textOnPrimary,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Submitting..." : "Continue to Pod Selection"}
        </button>
      </div>
    </main>
  );
}

function PodSelectionView({
  seats,
  guestOrders,
  currentGuestIndex,
  partySize,
  selectedPodId,
  onSelectPod,
  onConfirm,
  onBack,
}: {
  seats: Seat[];
  guestOrders: GuestOrder[];
  currentGuestIndex: number;
  partySize: number;
  selectedPodId?: string;
  onSelectPod: (podId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Get pods already selected by other guests in this party
  const takenPodIds = guestOrders
    .filter((_, i) => i !== currentGuestIndex)
    .map((g) => g.selectedPodId)
    .filter(Boolean) as string[];

  // Recommend pods based on availability and party size
  const availableSeats = seats.filter(
    (s) => s.status === "AVAILABLE" && !takenPodIds.includes(s.id)
  );

  // For parties of 2+, recommend adjacent pods
  const recommendedPods = availableSeats.slice(0, Math.min(3, availableSeats.length));

  const selectedSeat = seats.find((s) => s.id === selectedPodId);

  // Group seats by side for U-shape layout
  const leftSeats = seats.filter((s) => s.side === "left").sort((a, b) => a.col - b.col);
  const bottomSeats = seats.filter((s) => s.side === "bottom").sort((a, b) => a.col - b.col);
  const rightSeats = seats.filter((s) => s.side === "right").sort((a, b) => a.col - b.col);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLORS.surface,
        color: COLORS.text,
        padding: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Brand Header */}
      <div style={{ position: "absolute", top: 24, left: 24 }}>
        <KioskBrand size="normal" />
      </div>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8, marginTop: 32 }}>
        Choose Your Pod
      </h1>
      <p style={{ color: COLORS.textMuted, marginBottom: 8 }}>
        {guestOrders[currentGuestIndex].guestName}, pick your private dining pod
      </p>
      {partySize > 1 && (
        <p style={{ color: COLORS.textMuted, marginBottom: 32, fontSize: "0.9rem" }}>
          Guest {currentGuestIndex + 1} of {partySize}
        </p>
      )}

      {/* Recommended Pods */}
      {recommendedPods.length > 0 && !selectedPodId && (
        <div
          style={{
            background: COLORS.successLight,
            border: `2px solid ${COLORS.success}`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 32,
            textAlign: "center",
            maxWidth: 500,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, color: COLORS.success }}>
            We recommend Pod {recommendedPods[0].number}
          </div>
          <button
            onClick={() => onSelectPod(recommendedPods[0].id)}
            style={{
              padding: "12px 32px",
              background: COLORS.success,
              border: "none",
              borderRadius: 10,
              color: COLORS.textOnPrimary,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Accept Recommendation
          </button>
        </div>
      )}

      {/* Pod Map - U-Shape Layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {/* Top row label */}
        <div style={{ color: COLORS.textMuted, fontSize: "0.85rem" }}>Kitchen</div>

        {/* U-Shape Container */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {leftSeats.map((seat) => (
              <PodButton
                key={seat.id}
                seat={seat}
                isSelected={selectedPodId === seat.id}
                isTaken={takenPodIds.includes(seat.id)}
                isRecommended={recommendedPods.some((r) => r.id === seat.id)}
                onClick={() => onSelectPod(seat.id)}
              />
            ))}
          </div>

          {/* Center/Bottom Row */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignSelf: "flex-end",
              marginTop: leftSeats.length > 3 ? (leftSeats.length - 3) * 68 : 0,
            }}
          >
            {bottomSeats.map((seat) => (
              <PodButton
                key={seat.id}
                seat={seat}
                isSelected={selectedPodId === seat.id}
                isTaken={takenPodIds.includes(seat.id)}
                isRecommended={recommendedPods.some((r) => r.id === seat.id)}
                onClick={() => onSelectPod(seat.id)}
              />
            ))}
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rightSeats.map((seat) => (
              <PodButton
                key={seat.id}
                seat={seat}
                isSelected={selectedPodId === seat.id}
                isTaken={takenPodIds.includes(seat.id)}
                isRecommended={recommendedPods.some((r) => r.id === seat.id)}
                onClick={() => onSelectPod(seat.id)}
              />
            ))}
          </div>
        </div>

        {/* Bottom label */}
        <div style={{ color: COLORS.textMuted, fontSize: "0.85rem", marginTop: 8 }}>Entrance</div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: COLORS.success }} />
          <span style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>Available</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: "#ef4444" }} />
          <span style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>Occupied</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: COLORS.primary, border: `3px solid ${COLORS.text}` }} />
          <span style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>Your Selection</span>
        </div>
      </div>

      {/* Selected Pod Info */}
      {selectedSeat && (
        <div
          style={{
            background: COLORS.primaryLight,
            border: `2px solid ${COLORS.primary}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 32,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            Pod {selectedSeat.number} Selected
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: "0.9rem" }}>
            {selectedSeat.podType === "DUAL" ? "Dual Pod (fits 2)" : "Single Pod"}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 16 }}>
        <button
          onClick={onBack}
          style={{
            padding: "16px 32px",
            background: "transparent",
            border: `2px solid ${COLORS.border}`,
            borderRadius: 12,
            color: COLORS.textMuted,
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!selectedPodId}
          style={{
            padding: "16px 48px",
            background: selectedPodId ? COLORS.primary : "#ccc",
            border: "none",
            borderRadius: 12,
            color: COLORS.textOnPrimary,
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: selectedPodId ? "pointer" : "not-allowed",
          }}
        >
          Continue to Payment
        </button>
      </div>
    </main>
  );
}

function PodButton({
  seat,
  isSelected,
  isTaken,
  isRecommended,
  onClick,
}: {
  seat: Seat;
  isSelected: boolean;
  isTaken: boolean;
  isRecommended: boolean;
  onClick: () => void;
}) {
  const isAvailable = seat.status === "AVAILABLE" && !isTaken;
  const bgColor = isSelected
    ? COLORS.primary
    : !isAvailable
    ? "#ef4444"
    : isRecommended
    ? COLORS.success
    : COLORS.successLight;

  return (
    <button
      onClick={onClick}
      disabled={!isAvailable}
      style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        border: isSelected ? `3px solid ${COLORS.text}` : "none",
        background: bgColor,
        color: isAvailable ? COLORS.textOnPrimary : "rgba(255,255,255,0.7)",
        fontSize: "1rem",
        fontWeight: 700,
        cursor: isAvailable ? "pointer" : "not-allowed",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s",
        position: "relative",
      }}
    >
      {seat.number}
      {seat.podType === "DUAL" && (
        <span style={{ fontSize: "0.6rem", opacity: 0.8 }}>DUAL</span>
      )}
      {isRecommended && !isSelected && (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 16,
            height: 16,
            borderRadius: 8,
            background: COLORS.warning,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "0.6rem", color: COLORS.text }}>★</span>
        </div>
      )}
    </button>
  );
}

function PassView({
  completedGuestName,
  nextGuestNumber,
  totalGuests,
  dailyOrderNumber,
  paymentType,
  selectedPod,
  onPassDevice,
}: {
  completedGuestName: string;
  nextGuestNumber: number;
  totalGuests: number;
  dailyOrderNumber?: number;
  paymentType: "single" | "separate";
  selectedPod?: Seat;
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
        background: COLORS.surface,
        color: COLORS.text,
        padding: 48,
        textAlign: "center",
      }}
    >
      {/* Brand Header */}
      <div style={{ position: "absolute", top: 24, left: 24 }}>
        <KioskBrand size="normal" />
      </div>

      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          background: COLORS.successLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>
        {paymentType === "separate" ? "Payment Complete!" : "Order Added!"}
      </h1>
      <p style={{ color: COLORS.textMuted, marginBottom: 8 }}>
        {completedGuestName}'s order is {paymentType === "separate" ? "complete" : "saved"}
      </p>
      {dailyOrderNumber && (
        <p style={{ color: COLORS.primary, fontWeight: 600, fontSize: "1.25rem" }}>
          Order #{dailyOrderNumber}
        </p>
      )}
      {selectedPod && (
        <p style={{ color: COLORS.primary, fontWeight: 600 }}>Pod {selectedPod.number}</p>
      )}

      <div
        style={{
          marginTop: 48,
          padding: 32,
          background: COLORS.primaryLight,
          borderRadius: 16,
          border: `2px solid ${COLORS.primary}`,
        }}
      >
        <div style={{ fontSize: "1.25rem", marginBottom: 8 }}>
          Pass the device to Guest #{nextGuestNumber}
        </div>
        <div style={{ color: COLORS.textMuted, fontSize: "0.9rem" }}>
          {totalGuests - nextGuestNumber + 1} guest{totalGuests - nextGuestNumber > 0 ? "s" : ""}{" "}
          remaining
        </div>
      </div>

      <button
        onClick={onPassDevice}
        style={{
          marginTop: 48,
          padding: "20px 64px",
          background: COLORS.primary,
          border: "none",
          borderRadius: 16,
          color: COLORS.textOnPrimary,
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
  seats,
  onPay,
  submitting,
}: {
  paymentType: "single" | "separate";
  guestOrders: GuestOrder[];
  currentGuestIndex: number;
  seats: Seat[];
  onPay: () => void;
  submitting: boolean;
}) {
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const currentGuest = guestOrders[currentGuestIndex];
  const totalCents =
    paymentType === "single"
      ? guestOrders.reduce((sum, g) => sum + (g.totalCents || 0), 0)
      : currentGuest.totalCents || 0;

  const selectedPods = guestOrders
    .filter((g) => g.selectedPodId)
    .map((g) => seats.find((s) => s.id === g.selectedPodId))
    .filter(Boolean) as Seat[];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.surface,
        color: COLORS.text,
        padding: 48,
        textAlign: "center",
        position: "relative",
      }}
    >
      {/* Brand header */}
      <div style={{ position: "absolute", top: 24, left: 24 }}>
        <KioskBrand size="normal" />
      </div>

      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: 16 }}>Payment</h1>

      {paymentType === "single" ? (
        <>
          <p style={{ color: COLORS.textMuted, marginBottom: 32 }}>
            One check for {guestOrders.length} guests
          </p>
          <div
            style={{
              background: COLORS.surfaceElevated,
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              minWidth: 320,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {guestOrders.map((g, i) => {
              const pod = seats.find((s) => s.id === g.selectedPodId);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: i < guestOrders.length - 1 ? `1px solid ${COLORS.border}` : "none",
                  }}
                >
                  <div>
                    <span>{g.guestName}</span>
                    {pod && (
                      <span style={{ color: COLORS.textMuted, marginLeft: 8, fontSize: "0.85rem" }}>
                        Pod {pod.number}
                      </span>
                    )}
                  </div>
                  <span>${((g.totalCents || 0) / 100).toFixed(2)}</span>
                </div>
              );
            })}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 16,
                marginTop: 8,
                borderTop: `2px solid ${COLORS.primary}`,
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
          <p style={{ color: COLORS.textMuted, marginBottom: 16 }}>{currentGuest.guestName}'s payment</p>
          {currentGuest.selectedPodId && (
            <p style={{ color: COLORS.primary, marginBottom: 16 }}>
              Pod {seats.find((s) => s.id === currentGuest.selectedPodId)?.number}
            </p>
          )}
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 700,
              marginBottom: 32,
              color: COLORS.primary,
            }}
          >
            ${(totalCents / 100).toFixed(2)}
          </div>
        </>
      )}

      {/* Pod Summary */}
      {selectedPods.length > 0 && (
        <div
          style={{
            background: COLORS.primaryLight,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Your Pod(s)</div>
          <div style={{ color: COLORS.textMuted }}>
            {selectedPods.map((p) => `Pod ${p.number}`).join(", ")}
          </div>
        </div>
      )}

      <div
        style={{
          padding: 16,
          background: COLORS.warningLight,
          border: `1px solid ${COLORS.warning}`,
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
          background: submitting ? "#ccc" : COLORS.success,
          border: "none",
          borderRadius: 16,
          color: COLORS.textOnPrimary,
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
  seats,
  onNewOrder,
}: {
  guestOrders: GuestOrder[];
  seats: Seat[];
  onNewOrder: () => void;
}) {
  const [countdown, setCountdown] = useState(30);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Auto-reset countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setShouldRedirect(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle redirect in a separate effect to avoid setState during render
  useEffect(() => {
    if (shouldRedirect) {
      onNewOrder();
    }
  }, [shouldRedirect, onNewOrder]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.surface,
        color: COLORS.text,
        padding: 48,
        textAlign: "center",
        position: "relative",
      }}
    >
      {/* Brand header */}
      <div style={{ position: "absolute", top: 24, left: 24 }}>
        <KioskBrand size="normal" />
      </div>

      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          background: COLORS.successLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
        }}
      >
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: 16 }}>
        You're All Set!
      </h1>
      <p style={{ color: COLORS.textMuted, marginBottom: 48 }}>
        Please proceed to your pod(s) - your food will arrive shortly
      </p>

      <div
        style={{
          background: COLORS.surfaceElevated,
          borderRadius: 20,
          padding: 32,
          marginBottom: 48,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <h2 style={{ marginBottom: 20, fontSize: "1.25rem" }}>Your Orders</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          {guestOrders.map((g) => {
            const pod = seats.find((s) => s.id === g.selectedPodId);
            return (
              <div
                key={g.guestNumber}
                style={{
                  padding: "20px 28px",
                  background: COLORS.primary,
                  borderRadius: 16,
                  minWidth: 140,
                  color: COLORS.textOnPrimary,
                }}
              >
                <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>{g.guestName}</div>
                <div style={{ fontSize: "2rem", fontWeight: 700, margin: "4px 0" }}>
                  #{g.dailyOrderNumber || "---"}
                </div>
                {pod && (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      borderRadius: 8,
                      padding: "6px 12px",
                      marginTop: 8,
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    Pod {pod.number}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={onNewOrder}
        style={{
          padding: "20px 64px",
          background: COLORS.primary,
          border: "none",
          borderRadius: 16,
          color: COLORS.textOnPrimary,
          fontSize: "1.25rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Start New Order
      </button>

      <p style={{ marginTop: 24, color: COLORS.textMuted, fontSize: "0.85rem" }}>
        Screen will reset automatically in {countdown} seconds
      </p>
    </main>
  );
}
