"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useUser, useSignUp, useSignIn } from "@clerk/nextjs";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Dialog";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface OrderStatus {
  order: {
    id: string;
    orderNumber: string;
    kitchenOrderNumber: string | null;
    orderQrCode: string;
    status: string;
    totalCents: number;
    estimatedArrival: string | null;
    paidAt: string | null;
    arrivedAt: string | null;
    queuedAt: string | null;
    prepStartTime: string | null;
    readyTime: string | null;
    deliveredAt: string | null;
    completedTime: string | null;
    podNumber: string | null;
    podAssignedAt: string | null;
    podConfirmedAt: string | null;
    queuePosition: number | null;
    estimatedWaitMinutes: number | null;
    location: {
      id: string;
      name: string;
      city: string;
    };
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      selectedValue: string | null;
      priceCents: number;
      categoryType: string | null;
    }>;
  };
}

interface Fortune {
  fortune: string;
  luckyNumbers: number[];
  thisDayInHistory: {
    year: number;
    event: string;
  } | null;
  learnChinese: {
    traditional: string;
    pinyin: string;
    english: string;
    category: string;
    funFact: string;
    source: string;
  } | null;
  source: string;
  orderNumber: string;
  customerName: string | null;
}

interface OrderRoast {
  roast: string;
  highlights: string[];
  source: string;
  customerName: string | null;
}

interface OrderCommentary {
  commentary: string | null;
  status: string;
  source: string;
  customerName: string | null;
  podNumber: string | null;
}

interface OrderBackstory {
  backstories: string[];
  source: string;
  customerName: string | null;
}

interface AvailableAddons {
  paidAddons: Array<{
    id: string;
    name: string;
    basePriceCents: number;
    categoryType: string;
  }>;
  refillableDrinks: Array<{
    id: string;
    name: string;
  }>;
  extraVegetables: Array<{
    id: string;
    name: string;
    sliderConfig?: any;
  }>;
}

// Mental Health Awareness Component - fetches AI-generated facts
function MentalHealthAwareness({ translations, locale }: { translations: { label: string; loading: string; skipTip: string; supportCause: string; foundation: string }; locale: string }) {
  const [fact, setFact] = useState<{ question: string; fact: string; source: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchMentalHealthFact() {
      try {
        const response = await fetch(
          `${BASE}/orders/mental-health-fact?locale=${locale}`,
          { headers: { "x-tenant-slug": "oh" } }
        );
        if (response.ok) {
          const data = await response.json();
          setFact(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to fetch mental health fact:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchMentalHealthFact();
  }, []);

  // Don't render if loading or error
  if (loading) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #faf8f5 100%)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 16,
          textAlign: "center",
          border: "2px solid rgba(199, 168, 120, 0.3)",
        }}
      >
        <div style={{ color: "#7C7A67", fontSize: "0.9rem" }}>{translations.loading}</div>
      </div>
    );
  }

  if (error || !fact) {
    return null; // Don't show anything if API fails
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #ffffff 0%, #faf8f5 100%)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
        boxShadow: "0 4px 12px rgba(199, 168, 120, 0.15)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        border: "2px solid rgba(199, 168, 120, 0.3)",
      }}
    >
      {/* Decorative red accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)",
        }}
      />

      {/* Header with sock icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <img
          src="/redsock-icon.png"
          alt="One Red Step"
          style={{
            height: 36,
            width: "auto",
          }}
        />
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: "bold",
            color: "#dc2626",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}
        >
          {translations.label}
        </span>
      </div>

      {/* Question */}
      <h3
        style={{
          margin: 0,
          marginBottom: 12,
          fontSize: "1.1rem",
          color: "#2D2A26",
          fontWeight: "600",
        }}
      >
        {fact.question}
      </h3>

      {/* Fact */}
      <p
        style={{
          color: "#5a584a",
          fontSize: "0.95rem",
          margin: 0,
          marginBottom: 12,
          lineHeight: 1.6,
        }}
      >
        {fact.fact}
      </p>

      {/* Source */}
      <p
        style={{
          color: "#9ca3af",
          fontSize: "0.75rem",
          margin: 0,
          marginBottom: 16,
          fontStyle: "italic",
        }}
      >
        — {fact.source}
      </p>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "rgba(199, 168, 120, 0.3)",
          margin: "0 -24px 16px -24px",
        }}
      />

      {/* CTA Section */}
      <p
        style={{
          color: "#7C7A67",
          fontSize: "0.85rem",
          margin: 0,
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        {translations.skipTip}
      </p>

      <a
        href="https://www.oneredstepatatime.org"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 24px",
          borderRadius: 50,
          background: "#FFFFFF",
          border: "2px solid #dc2626",
          textDecoration: "none",
          transition: "all 0.3s ease",
          boxShadow: "0 4px 12px rgba(220, 38, 38, 0.15)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 20px rgba(220, 38, 38, 0.25)";
          e.currentTarget.style.background = "rgba(220, 38, 38, 0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(220, 38, 38, 0.15)";
          e.currentTarget.style.background = "#FFFFFF";
        }}
      >
        <img
          src="/redsock-icon.png"
          alt="One Red Step Foundation"
          style={{
            height: 26,
            width: "auto",
          }}
        />
        <span
          style={{
            fontSize: "0.9rem",
            fontWeight: "600",
            color: "#dc2626",
            letterSpacing: "0.3px",
          }}
        >
          {translations.supportCause}
        </span>
      </a>

      {/* Foundation name */}
      <p
        style={{
          color: "#9ca3af",
          fontSize: "0.7rem",
          margin: 0,
          marginTop: 12,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {translations.foundation}
      </p>
    </div>
  );
}

function StatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("orderStatus");
  const tFeatures = useTranslations("features");
  const tOrder = useTranslations("order");
  const toast = useToast();
  const { user, isLoaded: isUserLoaded } = useUser();
  const orderQrCode = searchParams.get("orderQrCode");

  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDoneOpen, setConfirmDoneOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [fortuneLoading, setFortuneLoading] = useState(false);
  const [fortuneOpened, setFortuneOpened] = useState(false);
  const [roast, setRoast] = useState<OrderRoast | null>(null);
  const [roastLoading, setRoastLoading] = useState(false);
  const [roastOpened, setRoastOpened] = useState(false);
  const [commentary, setCommentary] = useState<OrderCommentary | null>(null);
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [backstory, setBackstory] = useState<OrderBackstory | null>(null);
  const [backstoryLoading, setBackstoryLoading] = useState(false);
  const [backstoryOpened, setBackstoryOpened] = useState(false);
  const lastCommentaryStatusRef = useRef<string | null>(null);

  // Add-on and Call Staff state
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [availableAddons, setAvailableAddons] = useState<AvailableAddons | null>(null);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [callStaffLoading, setCallStaffLoading] = useState(false);
  const [callStaffSuccess, setCallStaffSuccess] = useState(false);
  const [refillLoading, setRefillLoading] = useState(false);
  const [extraVegLoading, setExtraVegLoading] = useState(false);
  const [selectedExtraVegs, setSelectedExtraVegs] = useState<Set<string>>(new Set());

  // Paid add-on state
  const [selectedPaidAddons, setSelectedPaidAddons] = useState<Map<string, number>>(new Map()); // menuItemId -> quantity
  const [paidAddonLoading, setPaidAddonLoading] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);

  // Dessert ready state
  const [dessertLoading, setDessertLoading] = useState(false);
  const [dessertRequested, setDessertRequested] = useState(false);

  // Sign-up modal state
  const [showSignUpModal, setShowSignUpModal] = useState(false);

  // Fetch order status
  async function fetchStatus() {
    if (!orderQrCode) return;

    try {
      const response = await fetch(
        `${BASE}/orders/status?orderQrCode=${encodeURIComponent(orderQrCode)}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Only update state if data has actually changed to prevent unnecessary re-renders
        setStatus((prevStatus) => {
          // Deep compare the critical fields to avoid jerkiness
          if (prevStatus &&
              prevStatus.order?.status === data.order?.status &&
              prevStatus.order?.podConfirmedAt === data.order?.podConfirmedAt &&
              prevStatus.queuePosition === data.queuePosition &&
              prevStatus.estimatedWait === data.estimatedWait) {
            return prevStatus; // No change, don't re-render
          }
          return data;
        });
        setError(null);

        // Fetch commentary when status is in active cooking stages
        if (data.order?.status) {
          fetchCommentary(data.order.status);
        }

        // Clear active order from localStorage when completed
        if (data.order?.status === "COMPLETED") {
          localStorage.removeItem("activeOrderQrCode");
        }
      } else {
        setError("Order not found");
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
      setError("Failed to load order status");
    } finally {
      setLoading(false);
    }
  }

  // Fetch fortune cookie - always fetches fresh (no caching)
  async function fetchFortune() {
    if (!orderQrCode || fortuneLoading) return;

    setFortuneLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/fortune?orderQrCode=${encodeURIComponent(orderQrCode)}&locale=${locale}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFortune(data);
      }
    } catch (err) {
      console.error("Failed to fetch fortune:", err);
    } finally {
      setFortuneLoading(false);
    }
  }

  // Fetch order roast - always fetches fresh (no caching)
  async function fetchRoast() {
    if (!orderQrCode || roastLoading) return;

    setRoastLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/roast?orderQrCode=${encodeURIComponent(orderQrCode)}&locale=${locale}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRoast(data);
      }
    } catch (err) {
      console.error("Failed to fetch roast:", err);
    } finally {
      setRoastLoading(false);
    }
  }

  // Fetch live commentary (called when status changes)
  async function fetchCommentary(currentStatus: string) {
    if (!orderQrCode || commentaryLoading) return;
    // Only fetch if status changed and is a commentary-worthy status
    if (!["QUEUED", "PREPPING", "READY", "SERVING"].includes(currentStatus)) return;
    // Use ref to avoid stale closure - only fetch when status actually changes
    if (currentStatus === lastCommentaryStatusRef.current) return;

    setCommentaryLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/commentary?orderQrCode=${encodeURIComponent(orderQrCode)}&locale=${locale}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCommentary(data);
        lastCommentaryStatusRef.current = currentStatus;
      }
    } catch (err) {
      console.error("Failed to fetch commentary:", err);
    } finally {
      setCommentaryLoading(false);
    }
  }

  // Fetch backstory - always fetches fresh (no caching)
  async function fetchBackstory(orderId: string) {
    if (!orderId || backstoryLoading) return;

    setBackstoryLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/${orderId}/backstory?locale=${locale}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBackstory(data);
      }
    } catch (err) {
      console.error("Failed to fetch backstory:", err);
    } finally {
      setBackstoryLoading(false);
    }
  }

  // Call Staff
  async function callStaff() {
    if (!status?.order?.id || callStaffLoading) return;

    setCallStaffLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/${status.order.id}/call-staff`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({ reason: "GENERAL" }),
        }
      );

      if (response.ok) {
        setCallStaffSuccess(true);
        toast.success(tOrder("success.staffNotified"));
        setTimeout(() => setCallStaffSuccess(false), 5000);
      } else {
        const data = await response.json();
        toast.error(data.error || tOrder("errors.callStaff"));
      }
    } catch (err) {
      console.error("Failed to call staff:", err);
      toast.error(tOrder("errors.callStaff"));
    } finally {
      setCallStaffLoading(false);
    }
  }

  // Fetch available add-ons
  async function fetchAvailableAddons() {
    if (!status?.order?.id || addonsLoading) return;

    setAddonsLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/${status.order.id}/available-addons?locale=${locale}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableAddons(data);
      }
    } catch (err) {
      console.error("Failed to fetch add-ons:", err);
    } finally {
      setAddonsLoading(false);
    }
  }

  // Request drink refill
  async function requestRefill(drinkId?: string) {
    if (!status?.order?.id || refillLoading) return;

    setRefillLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/${status.order.id}/refill`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({ drinkMenuItemId: drinkId }),
        }
      );

      if (response.ok) {
        toast.success(tOrder("success.refillRequested"));
        setShowAddOnModal(false);
      } else {
        const data = await response.json();
        toast.error(data.error || tOrder("errors.requestRefill"));
      }
    } catch (err) {
      console.error("Failed to request refill:", err);
      toast.error(tOrder("errors.requestRefill"));
    } finally {
      setRefillLoading(false);
    }
  }

  // Request extra vegetables
  async function requestExtraVegetables() {
    if (!status?.order?.id || extraVegLoading || selectedExtraVegs.size === 0) return;

    setExtraVegLoading(true);
    try {
      const items = Array.from(selectedExtraVegs).map(id => ({
        menuItemId: id,
        selectedValue: "Extra",
      }));

      const response = await fetch(
        `${BASE}/orders/${status.order.id}/extra-vegetables`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({ items }),
        }
      );

      if (response.ok) {
        toast.success(tOrder("success.vegetablesRequested"));
        setShowAddOnModal(false);
        setSelectedExtraVegs(new Set());
      } else {
        const data = await response.json();
        toast.error(data.error || tOrder("errors.requestVegetables"));
      }
    } catch (err) {
      console.error("Failed to request extra vegetables:", err);
      toast.error(tOrder("errors.requestVegetables"));
    } finally {
      setExtraVegLoading(false);
    }
  }

  // Open add-on modal
  function openAddOnModal() {
    setShowAddOnModal(true);
    setSelectedPaidAddons(new Map()); // Reset selections when opening
    setShowPaymentConfirm(false);
    if (!availableAddons) {
      fetchAvailableAddons();
    }
  }

  // Request dessert delivery
  async function requestDessert() {
    if (!status?.order?.id || dessertLoading || dessertRequested) return;

    setDessertLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/${status.order.id}/dessert-ready`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({}),
        }
      );

      if (response.ok) {
        setDessertRequested(true);
        toast.success(tOrder("success.dessertOnWay"));
      } else {
        const data = await response.json();
        toast.error(data.error || tOrder("errors.requestDessert"));
      }
    } catch (err) {
      console.error("Failed to request dessert:", err);
      toast.error(tOrder("errors.requestDessert"));
    } finally {
      setDessertLoading(false);
    }
  }

  // Toggle paid add-on selection
  function togglePaidAddon(itemId: string) {
    const newMap = new Map(selectedPaidAddons);
    if (newMap.has(itemId)) {
      newMap.delete(itemId);
    } else {
      newMap.set(itemId, 1);
    }
    setSelectedPaidAddons(newMap);
  }

  // Update paid add-on quantity (max 3 per item)
  function updatePaidAddonQty(itemId: string, delta: number) {
    const newMap = new Map(selectedPaidAddons);
    const currentQty = newMap.get(itemId) || 0;
    const newQty = Math.max(0, Math.min(3, currentQty + delta)); // Limit to max 3
    if (newQty === 0) {
      newMap.delete(itemId);
    } else {
      newMap.set(itemId, newQty);
    }
    setSelectedPaidAddons(newMap);
  }

  // Calculate total for selected paid add-ons
  function calculatePaidAddonTotal(): number {
    if (!availableAddons) return 0;
    let total = 0;
    selectedPaidAddons.forEach((qty, itemId) => {
      const item = availableAddons.paidAddons.find(a => a.id === itemId);
      if (item) {
        total += item.basePriceCents * qty;
      }
    });
    return total;
  }

  // Submit paid add-on order
  async function submitPaidAddonOrder() {
    if (!status?.order?.id || paidAddonLoading || selectedPaidAddons.size === 0) return;

    setPaidAddonLoading(true);
    try {
      const items = Array.from(selectedPaidAddons.entries()).map(([menuItemId, quantity]) => ({
        menuItemId,
        quantity,
      }));

      // Create the add-on order
      const response = await fetch(
        `${BASE}/orders/${status.order.id}/addons`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({ items }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create add-on order");
      }

      const { order: addonOrder, totalCents } = await response.json();

      // Mark as paid (test payment mode - same as main payment flow)
      // Add-on orders go straight to PREPPING since customer is already at pod
      const payResponse = await fetch(`${BASE}/orders/${addonOrder.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          paymentStatus: "PAID",
          status: "PREPPING",
          podConfirmedAt: new Date().toISOString(),
        }),
      });

      if (!payResponse.ok) {
        throw new Error("Payment processing failed");
      }

      toast.success(tOrder("success.addonOrdered", { amount: `$${(totalCents / 100).toFixed(2)}` }));
      setShowAddOnModal(false);
      setSelectedPaidAddons(new Map());
      setShowPaymentConfirm(false);
    } catch (err: any) {
      console.error("Failed to submit paid add-on:", err);
      toast.error(err.message || tOrder("errors.placeAddonOrder"));
    } finally {
      setPaidAddonLoading(false);
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [orderQrCode]);

  // Check for pending order link after sign-in
  useEffect(() => {
    async function linkPendingOrder() {
      if (!isUserLoaded || !user || !orderQrCode) return;

      // Check if there's a pending order to link
      const pendingLink = localStorage.getItem("pendingOrderLink");
      if (!pendingLink) return;

      try {
        const { orderQrCode: pendingQrCode } = JSON.parse(pendingLink);

        // Only link if we're viewing the same order that was pending
        if (pendingQrCode !== orderQrCode) return;

        // Call API to link order to account
        const response = await fetch(`${BASE}/orders/link-to-account`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({
            orderQrCode: pendingQrCode,
            userId: user.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          toast.success(t("signUp.orderLinked", { points: data.pointsAwarded }));
          // Clear the pending link
          localStorage.removeItem("pendingOrderLink");
        }
      } catch (error) {
        console.error("Failed to link order:", error);
      }
    }

    linkPendingOrder();
  }, [isUserLoaded, user, orderQrCode]);

  // Poll every 10 seconds (increased from 5 to reduce jerkiness)
  useEffect(() => {
    if (!orderQrCode) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [orderQrCode]);

  if (!orderQrCode) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E5E5E5",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#111" }}>{t("noOrderCode")}</h1>
          <button
            onClick={() => router.push("/order")}
            style={{
              marginTop: 20,
              padding: "12px 24px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            {t("placeNewOrder")}
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E5E5E5",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "3rem",
              marginBottom: 16,
            }}
          >
            ⏳
          </div>
          <div style={{ color: "#666", fontSize: "1.2rem" }}>
            {t("loading")}
          </div>
        </div>
      </main>
    );
  }

  if (error || !status) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E5E5E5",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#111" }}>{error || t("orderNotFound")}</h1>
          <button
            onClick={() => router.push("/order")}
            style={{
              marginTop: 20,
              padding: "12px 24px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            {t("placeNewOrder")}
          </button>
        </div>
      </main>
    );
  }

  const order = status.order;

  // Status display logic
  const getStatusDisplay = () => {
    switch (order.status) {
      case "PENDING_PAYMENT":
        return { icon: "💳", label: t("status.pending"), color: "#f59e0b" };
      case "PAID":
        return { icon: "✅", label: t("status.paid"), color: "#7C7A67" };
      case "QUEUED":
        return { icon: "⏳", label: t("status.queued"), color: "#6366f1" };
      case "PREPPING":
        return { icon: "👨‍🍳", label: t("status.prepping"), color: "#f59e0b" };
      case "READY":
        return { icon: "🔔", label: t("status.ready"), color: "#7C7A67" };
      case "SERVING":
        return { icon: "🍜", label: t("status.serving"), color: "#7C7A67" };
      case "COMPLETED":
        return { icon: "🎉", label: t("status.completed"), color: "#6b7280" };
      default:
        return { icon: "❓", label: order.status, color: "#6b7280" };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Progress calculation
  const getProgress = () => {
    const statuses = ["PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"];
    const currentIndex = statuses.indexOf(order.status);
    if (currentIndex === -1) return 0;
    return ((currentIndex + 1) / statuses.length) * 100;
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#E5E5E5",
        padding: 24,
        paddingTop: 40,
      }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: "4rem", marginBottom: 12 }}>
              {statusDisplay.icon}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.8rem",
                color: statusDisplay.color,
                marginBottom: 8,
              }}
            >
              {statusDisplay.label}
            </h1>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>
              {t("orderNumber", { number: order.kitchenOrderNumber || order.orderNumber })}
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              background: "#e5e7eb",
              height: 8,
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                background: "linear-gradient(90deg, #7C7A67 0%, #5a584a 100%)",
                height: "100%",
                width: `${getProgress()}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Live AI Commentary - Shows during active cooking stages */}
          {["QUEUED", "PREPPING", "READY", "SERVING"].includes(order.status) && (
            <div
              style={{
                background: "linear-gradient(135deg, #3d3c35 0%, #2a2924 100%)",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
                border: "1px solid #5a584a",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Animated background effect */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "radial-gradient(circle at 20% 50%, rgba(199, 168, 120, 0.08) 0%, transparent 50%)",
                  animation: "pulse 3s infinite",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>
                    {order.status === "QUEUED" && "⏳"}
                    {order.status === "PREPPING" && "🔥"}
                    {order.status === "READY" && "✨"}
                    {order.status === "SERVING" && "🚀"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: "bold",
                      color: "#C7A878",
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                    }}
                  >
                    {tFeatures("kitchen.label")}
                  </span>
                </div>

                {commentaryLoading ? (
                  <div
                    style={{
                      color: "#a09a8a",
                      fontSize: "0.95rem",
                      fontStyle: "italic",
                    }}
                  >
                    {tFeatures("kitchen.listening")}
                  </div>
                ) : commentary?.commentary ? (
                  <p
                    style={{
                      color: "#E5E5E5",
                      fontSize: "1rem",
                      margin: 0,
                      lineHeight: 1.6,
                      fontStyle: "italic",
                    }}
                  >
                    "{commentary.commentary}"
                  </p>
                ) : (
                  <p
                    style={{
                      color: "#a09a8a",
                      fontSize: "0.95rem",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {tFeatures("kitchen.quiet")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pod Assignment or Queue Status */}
          {order.podNumber && (
            <div
              style={{
                background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
                borderRadius: 12,
                padding: 20,
                color: "white",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: 4 }}>
                {t("pod.yourPod")}
              </div>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  letterSpacing: "0.1em",
                }}
              >
                {t("pod.podNumber", { number: order.podNumber })}
              </div>
              {!order.podConfirmedAt ? (
                <>
                  <div style={{ fontSize: "0.85rem", marginTop: 8, opacity: 0.9 }}>
                    {t("pod.confirmArrival")}
                  </div>
                  <button
                    onClick={() =>
                      router.push(
                        `/order/scan?orderQrCode=${encodeURIComponent(order.orderQrCode)}`
                      )
                    }
                    style={{
                      marginTop: 12,
                      padding: "10px 20px",
                      background: "white",
                      color: "#5a584a",
                      border: "none",
                      borderRadius: 8,
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    🪑 {t("buttons.confirmAtPod")}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "0.85rem", marginTop: 8, opacity: 0.9 }}>
                    ✓ {t("pod.checkedIn")}
                  </div>

                  {/* Pod Service Buttons - Call Staff & Add Items */}
                  {["QUEUED", "PREPPING", "READY", "SERVING"].includes(order.status) && (
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 16,
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={callStaff}
                        disabled={callStaffLoading || callStaffSuccess}
                        style={{
                          padding: "10px 16px",
                          background: callStaffSuccess ? "#22c55e" : "white",
                          color: callStaffSuccess ? "white" : "#5a584a",
                          border: "none",
                          borderRadius: 8,
                          fontSize: "0.85rem",
                          fontWeight: "bold",
                          cursor: callStaffLoading || callStaffSuccess ? "default" : "pointer",
                          opacity: callStaffLoading ? 0.7 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {callStaffSuccess ? (
                          <>✓ {t("pod.staffNotified")}</>
                        ) : callStaffLoading ? (
                          <>{t("pod.calling")}</>
                        ) : (
                          <>🔔 {t("buttons.callStaff")}</>
                        )}
                      </button>
                      <button
                        onClick={openAddOnModal}
                        style={{
                          padding: "10px 16px",
                          background: "rgba(255,255,255,0.15)",
                          color: "white",
                          border: "2px solid rgba(255,255,255,0.5)",
                          borderRadius: 8,
                          fontSize: "0.85rem",
                          fontWeight: "bold",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        ➕ {t("buttons.addItems")}
                      </button>
                    </div>
                  )}

                  {/* Ready for Dessert Button - Only shows if order has dessert and status is SERVING */}
                  {order.status === "SERVING" &&
                    order.items.some((item) => item.categoryType === "DESSERT") && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          marginTop: 12,
                        }}
                      >
                        <button
                          onClick={requestDessert}
                          disabled={dessertLoading || dessertRequested}
                          style={{
                            padding: "10px 16px",
                            background: dessertRequested
                              ? "#22c55e"
                              : "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            fontSize: "0.85rem",
                            fontWeight: "bold",
                            cursor: dessertLoading || dessertRequested ? "default" : "pointer",
                            opacity: dessertLoading ? 0.7 : 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {dessertRequested ? (
                            <>✓ {t("dessert.onItsWay")}</>
                          ) : dessertLoading ? (
                            <>{t("dessert.notifying")}</>
                          ) : (
                            <>🍨 {t("dessert.readyForDessert")}</>
                          )}
                        </button>
                      </div>
                    )}
                </>
              )}
            </div>
          )}

          {order.queuePosition && !order.podNumber && (
            <div
              style={{
                background: "#fef3c7",
                borderRadius: 12,
                padding: 20,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: "0.9rem", color: "#92400e", marginBottom: 4 }}>
                {t("queue.position")}
              </div>
              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: "bold",
                  color: "#92400e",
                }}
              >
                #{order.queuePosition}
              </div>
              {order.estimatedWaitMinutes && (
                <div style={{ fontSize: "0.9rem", color: "#92400e", marginTop: 8 }}>
                  {t("queue.estimatedWait", { minutes: order.estimatedWaitMinutes })}
                </div>
              )}
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#92400e",
                  marginTop: 12,
                  opacity: 0.8,
                }}
              >
                {t("queue.notifyWhenReady")}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: "bold",
                color: "#7C7A67",
                marginBottom: 12,
              }}
            >
              {t("timeline.title")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {order.paidAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#7C7A67",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>{t("timeline.paid")}</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.paidAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {order.arrivedAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#7C7A67",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>{t("timeline.checkedIn")}</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.arrivedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {order.prepStartTime && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#7C7A67",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>{t("timeline.orderStarted")}</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.prepStartTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {order.readyTime && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#7C7A67",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>{t("timeline.qualityCheck")}</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.readyTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {order.deliveredAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#7C7A67",
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 500 }}>{t("timeline.delivered")}</span>
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      {new Date(order.deliveredAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
              {/* Total Time - from payment to delivery */}
              {order.paidAt && order.deliveredAt && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{t("timeline.totalTime")}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#7C7A67" }}>
                    {(() => {
                      const paidTime = new Date(order.paidAt).getTime();
                      const deliveredTime = new Date(order.deliveredAt).getTime();
                      const totalMinutes = Math.round((deliveredTime - paidTime) / 60000);
                      if (totalMinutes < 60) {
                        return `${totalMinutes} min`;
                      }
                      const hours = Math.floor(totalMinutes / 60);
                      const mins = totalMinutes % 60;
                      return `${hours}h ${mins}m`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: "bold",
              color: "#7C7A67",
              marginBottom: 8,
            }}
          >
            {t("location")}
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 500 }}>
            {order.location.name}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>
            {order.location.city}
          </div>
        </div>

        {/* Sign-up CTA for unauthenticated users */}
        {isUserLoaded && !user && (
          <div
            style={{
              background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(124, 122, 103, 0.3)",
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>
              ⭐
            </div>
            <h3
              style={{
                color: "white",
                margin: 0,
                marginBottom: 8,
                fontSize: "1.2rem",
              }}
            >
              {t("signUp.title")}
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.85)",
                margin: 0,
                marginBottom: 16,
                fontSize: "0.9rem",
                lineHeight: 1.5,
              }}
            >
              {t("signUp.subtitle")}
            </p>
            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  color: "white",
                  fontSize: "0.85rem",
                  lineHeight: 1.6,
                }}
              >
                <div style={{ marginBottom: 6 }}>✓ {t("signUp.benefit1")}</div>
                <div style={{ marginBottom: 6 }}>✓ {t("signUp.benefit2")}</div>
                <div style={{ marginBottom: 6 }}>✓ {t("signUp.benefit3")}</div>
                <div>✓ {t("signUp.benefit4")}</div>
              </div>
            </div>
            <button
              onClick={() => setShowSignUpModal(true)}
              style={{
                padding: "14px 32px",
                borderRadius: 50,
                border: "2px solid white",
                background: "transparent",
                color: "white",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "#5a584a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "white";
              }}
            >
              {t("signUp.button")}
            </button>
          </div>
        )}

        {/* Fortune Cookie - Show after pod check-in to pass time while waiting */}
        {order.podConfirmedAt && (
          <div
            style={{
              background: "linear-gradient(135deg, #f5f5f0 0%, #e8e6dc 100%)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(124, 122, 103, 0.15)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              border: "1px solid #d4d2c7",
            }}
          >
            {!fortuneOpened ? (
              <>
                <div style={{ fontSize: "4rem", marginBottom: 16 }}>
                  🥠
                </div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "1.3rem",
                    color: "#5a584a",
                  }}
                >
                  {tFeatures("fortuneCookie.title")}
                </h3>
                <p
                  style={{
                    color: "#7C7A67",
                    fontSize: "0.9rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  {tFeatures("fortuneCookie.subtitle")}
                </p>
                <button
                  onClick={() => {
                    setFortuneOpened(true);
                    fetchFortune();
                  }}
                  style={{
                    padding: "12px 32px",
                    background: "#7C7A67",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "1rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(124, 122, 103, 0.3)",
                  }}
                >
                  🥠 {tFeatures("fortuneCookie.crackOpen")}
                </button>
              </>
            ) : fortuneLoading ? (
              <>
                <div
                  style={{
                    fontSize: "3rem",
                    marginBottom: 16,
                    animation: "pulse 1s infinite",
                  }}
                >
                  ✨
                </div>
                <p style={{ color: "#5a584a", fontSize: "1rem" }}>
                  {tFeatures("fortuneCookie.loading")}
                </p>
              </>
            ) : fortune ? (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>
                  🥠✨
                </div>

                {/* Fortune Message */}
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                    border: "1px solid #e8e6dc",
                  }}
                >
                  <p
                    style={{
                      fontStyle: "italic",
                      fontSize: "1.1rem",
                      color: "#3d3c35",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    "{fortune.fortune}"
                  </p>
                </div>

                {/* Lucky Numbers */}
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      color: "#5a584a",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {tFeatures("fortuneCookie.luckyNumbers")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {fortune.luckyNumbers.map((num, i) => (
                      <span
                        key={i}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#7C7A67",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                          fontSize: "0.9rem",
                        }}
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                </div>

                {/* This Day in History */}
                {fortune.thisDayInHistory && (
                  <div
                    style={{
                      background: "rgba(124, 122, 103, 0.1)",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: "0.85rem",
                      color: "#5a584a",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: 4,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      📜 {tFeatures("fortuneCookie.thisDay", { year: fortune.thisDayInHistory.year })}
                    </div>
                    <div style={{ lineHeight: 1.5 }}>
                      {fortune.thisDayInHistory.event}
                    </div>
                  </div>
                )}

                {/* Learn Chinese */}
                {fortune.learnChinese && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                      borderRadius: 12,
                      padding: 16,
                      marginTop: 16,
                      color: "white",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Decorative background pattern */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "30%",
                        background: "rgba(255,255,255,0.05)",
                        clipPath: "polygon(30% 0, 100% 0, 100% 100%, 0% 100%)",
                      }}
                    />

                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: 12,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        opacity: 0.9,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      📖 {tFeatures("fortuneCookie.learnChinese")}
                    </div>

                    {/* Main Chinese Character(s) display */}
                    <div
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderRadius: 12,
                        padding: "16px 24px",
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "2.5rem",
                          fontWeight: "bold",
                          color: "white",
                          textShadow: "2px 2px 4px rgba(0,0,0,0.2)",
                        }}
                      >
                        {fortune.learnChinese.traditional}
                      </span>
                    </div>

                    {/* Pinyin and English */}
                    <div style={{ textAlign: "center", marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "600",
                          marginBottom: 4,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {fortune.learnChinese.pinyin}
                      </div>
                      <div
                        style={{
                          fontSize: "0.95rem",
                          opacity: 0.9,
                        }}
                      >
                        {fortune.learnChinese.english}
                      </div>
                    </div>

                    {/* Fun Fact */}
                    <div
                      style={{
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 8,
                        padding: 10,
                        fontSize: "0.8rem",
                        lineHeight: 1.5,
                        opacity: 0.95,
                      }}
                    >
                      <span style={{ marginRight: 6 }}>💡</span>
                      {fortune.learnChinese.funFact}
                    </div>

                    {/* Category badge */}
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          background: "rgba(255,255,255,0.2)",
                          padding: "4px 12px",
                          borderRadius: 12,
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {fortune.learnChinese.category}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🥠</div>
                <p style={{ color: "#7C7A67", fontSize: "0.9rem" }}>
                  {tFeatures("fortuneCookie.unavailable")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Order Roast - Sarcastic analysis of their choices */}
        {order.podConfirmedAt && (
          <div
            style={{
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.2)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              border: "1px solid #fcd34d",
            }}
          >
            {!roastOpened ? (
              <>
                <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>
                  🔥
                </div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "1.2rem",
                    color: "#92400e",
                  }}
                >
                  {tFeatures("roast.title")}
                </h3>
                <p
                  style={{
                    color: "#b45309",
                    fontSize: "0.85rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  {tFeatures("roast.subtitle")}
                </p>
                <button
                  onClick={() => {
                    setRoastOpened(true);
                    fetchRoast();
                  }}
                  style={{
                    padding: "12px 28px",
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "0.95rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(245, 158, 11, 0.4)",
                  }}
                >
                  🔥 {tFeatures("roast.button")}
                </button>
              </>
            ) : roastLoading ? (
              <>
                <div
                  style={{
                    fontSize: "3rem",
                    marginBottom: 16,
                    animation: "pulse 1s infinite",
                  }}
                >
                  🤔
                </div>
                <p style={{ color: "#92400e", fontSize: "1rem" }}>
                  {tFeatures("roast.loading")}
                </p>
              </>
            ) : roast ? (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>
                  🔥😏
                </div>

                {/* Roast Message */}
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 12,
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                    border: "1px solid #fde68a",
                  }}
                >
                  <p
                    style={{
                      fontSize: "1.05rem",
                      color: "#78350f",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {roast.roast}
                  </p>
                </div>

                {/* Roast Highlights */}
                {roast.highlights && roast.highlights.length > 0 && (
                  <div
                    style={{
                      background: "rgba(146, 64, 14, 0.1)",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: "0.8rem",
                      color: "#92400e",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: 6,
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      🎯 {tFeatures("roast.highlights")}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
                      {roast.highlights.map((highlight, i) => (
                        <li key={i}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🔥</div>
                <p style={{ color: "#b45309", fontSize: "0.9rem" }}>
                  {tFeatures("roast.unavailable")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Behind the Scenes - Ingredient Backstories */}
        {order.podConfirmedAt && ["PREPPING", "READY", "SERVING"].includes(order.status) && (
          <div
            style={{
              background: "linear-gradient(135deg, #C7A878 0%, #a8895d 100%)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(199, 168, 120, 0.3)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              border: "1px solid #d4b88a",
            }}
          >
            {!backstoryOpened ? (
              <>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>
                  🎬
                </div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: "1.2rem",
                    color: "#2a2924",
                  }}
                >
                  {tFeatures("backstory.title")}
                </h3>
                <p
                  style={{
                    color: "#3d3c35",
                    fontSize: "0.85rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  {tFeatures("backstory.subtitle")}
                </p>
                <button
                  onClick={() => {
                    setBackstoryOpened(true);
                    fetchBackstory(order.id);
                  }}
                  style={{
                    padding: "12px 28px",
                    background: "linear-gradient(135deg, #3d3c35 0%, #222222 100%)",
                    color: "#E5E5E5",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "0.95rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(34, 34, 34, 0.3)",
                  }}
                >
                  🎬 {tFeatures("backstory.button")}
                </button>
              </>
            ) : backstoryLoading ? (
              <>
                <div
                  style={{
                    fontSize: "3rem",
                    marginBottom: 16,
                    animation: "pulse 1s infinite",
                  }}
                >
                  🎬
                </div>
                <p style={{ color: "#3d3c35", fontSize: "1rem" }}>
                  {tFeatures("backstory.loading")}
                </p>
              </>
            ) : backstory && backstory.backstories.length > 0 ? (
              <>
                <div style={{ fontSize: "2rem", marginBottom: 16 }}>
                  🎬✨
                </div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 16,
                    fontSize: "1rem",
                    color: "#2a2924",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {tFeatures("backstory.heading")}
                </h3>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    textAlign: "left",
                  }}
                >
                  {backstory.backstories.map((story, i) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.25)",
                        borderRadius: 10,
                        padding: 14,
                        borderLeft: "3px solid #3d3c35",
                      }}
                    >
                      <p
                        style={{
                          color: "#2a2924",
                          fontSize: "0.9rem",
                          margin: 0,
                          lineHeight: 1.6,
                        }}
                      >
                        {story}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🎬</div>
                <p style={{ color: "#3d3c35", fontSize: "0.9rem" }}>
                  {tFeatures("backstory.unavailable")}
                </p>
              </>
            )}
          </div>
        )}

        {/* One Red Step Foundation - Mental Health Awareness */}
        {order.podConfirmedAt && (
          <MentalHealthAwareness
            locale={locale}
            translations={{
              label: t("mentalHealth.label"),
              loading: t("mentalHealth.loading"),
              skipTip: t("mentalHealth.skipTip"),
              supportCause: t("mentalHealth.supportCause"),
              foundation: t("mentalHealth.foundation"),
            }}
          />
        )}

        {/* Action Buttons */}
        <div style={{ display: "grid", gap: 12 }}>
          {/* Show "I'm Done Eating" button when order is SERVING */}
          {order.status === "SERVING" && (
            <>
            <ConfirmDialog
              open={confirmDoneOpen}
              onClose={() => setConfirmDoneOpen(false)}
              onConfirm={async () => {
                try {
                  await fetch(`${BASE}/kitchen/orders/${order.id}/status`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      "x-tenant-slug": "oh",
                    },
                    body: JSON.stringify({ status: "COMPLETED" }),
                  });
                  setConfirmDoneOpen(false);
                  fetchStatus(); // Refresh status immediately
                } catch (error) {
                  console.error("Failed to mark as done:", error);
                  toast.error(t("errors.markDone"));
                }
              }}
              title={t("status.doneEating")}
              message={t("confirmations.finishedEating")}
              type="info"
            />
            <button
              onClick={() => setConfirmDoneOpen(true)}
              style={{
                width: "100%",
                padding: 16,
                background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(124, 122, 103, 0.4)",
              }}
            >
              ✓ {t("buttons.doneEating")}
            </button>
            </>
          )}

          <button
            onClick={() => router.push("/member")}
            style={{
              width: "100%",
              padding: 14,
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {t("buttons.viewProfile")}
          </button>

          <button
            onClick={() => router.push("/order")}
            style={{
              width: "100%",
              padding: 14,
              background: "white",
              color: "#7C7A67",
              border: "2px solid #7C7A67",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {t("buttons.orderAgain")}
          </button>
        </div>

        {/* Auto-refresh indicator */}
        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: "0.75rem",
            color: "#999",
          }}
        >
          {t("autoRefresh")}
        </div>
      </div>

      {/* Add-On Modal */}
      {showAddOnModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1000,
            padding: 0,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddOnModal(false);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "24px 24px 0 0",
              width: "100%",
              maxWidth: 500,
              maxHeight: "85vh",
              overflow: "auto",
              animation: "slideUp 0.3s ease",
            }}
          >
            <style>
              {`
                @keyframes slideUp {
                  from { transform: translateY(100%); }
                  to { transform: translateY(0); }
                }
              `}
            </style>

            {/* Modal Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                background: "white",
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#111" }}>
                {t("addItems.title")}
              </h2>
              <button
                onClick={() => setShowAddOnModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#666",
                  padding: 8,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 24 }}>
              {addonsLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
                  {t("addItems.loading")}
                </div>
              ) : availableAddons ? (
                <>
                  {/* Free Drink Refills */}
                  {availableAddons.refillableDrinks.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            background: "#7C7A67",
                            color: "white",
                            padding: "4px 10px",
                            borderRadius: 16,
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                          }}
                        >
                          {t("addItems.free")}
                        </span>
                        <h3 style={{ margin: 0, fontSize: "1rem", color: "#111" }}>
                          🥤 {t("addItems.drinkRefills")}
                        </h3>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {availableAddons.refillableDrinks.map((drink) => (
                          <button
                            key={drink.id}
                            onClick={() => requestRefill(drink.id)}
                            disabled={refillLoading}
                            style={{
                              padding: "14px 16px",
                              background: "#f5f5f0",
                              border: "2px solid #7C7A67",
                              borderRadius: 10,
                              fontSize: "0.95rem",
                              fontWeight: "500",
                              cursor: refillLoading ? "default" : "pointer",
                              opacity: refillLoading ? 0.7 : 1,
                              color: "#3d3c35",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span>{drink.name}</span>
                            <span style={{ fontSize: "0.85rem", color: "#5a584a" }}>
                              {refillLoading ? t("addItems.requesting") : t("addItems.requestRefill")}
                            </span>
                          </button>
                        ))}
                        <button
                          onClick={() => requestRefill()}
                          disabled={refillLoading}
                          style={{
                            padding: "14px 16px",
                            background: "#f3f4f6",
                            border: "2px solid #d1d5db",
                            borderRadius: 10,
                            fontSize: "0.95rem",
                            fontWeight: "500",
                            cursor: refillLoading ? "default" : "pointer",
                            opacity: refillLoading ? 0.7 : 1,
                            color: "#374151",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{t("addItems.waterRefill")}</span>
                          <span style={{ fontSize: "0.85rem" }}>
                            {refillLoading ? t("addItems.requesting") : t("addItems.request")}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Free Extra Vegetables */}
                  {availableAddons.extraVegetables.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            background: "#7C7A67",
                            color: "white",
                            padding: "4px 10px",
                            borderRadius: 16,
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                          }}
                        >
                          {t("addItems.free")}
                        </span>
                        <h3 style={{ margin: 0, fontSize: "1rem", color: "#111" }}>
                          🥬 {t("addItems.extrasAndAddons")}
                        </h3>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: 8,
                        }}
                      >
                        {availableAddons.extraVegetables.map((veg) => {
                          const isSelected = selectedExtraVegs.has(veg.id);
                          return (
                            <button
                              key={veg.id}
                              onClick={() => {
                                const newSet = new Set(selectedExtraVegs);
                                if (isSelected) {
                                  newSet.delete(veg.id);
                                } else {
                                  newSet.add(veg.id);
                                }
                                setSelectedExtraVegs(newSet);
                              }}
                              style={{
                                padding: "12px 14px",
                                background: isSelected ? "#e8e6dc" : "#f9fafb",
                                border: isSelected
                                  ? "2px solid #7C7A67"
                                  : "2px solid #e5e7eb",
                                borderRadius: 10,
                                fontSize: "0.9rem",
                                fontWeight: isSelected ? "600" : "500",
                                cursor: "pointer",
                                color: isSelected ? "#3d3c35" : "#374151",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {isSelected && "✓ "}{veg.name}
                            </button>
                          );
                        })}
                      </div>
                      {selectedExtraVegs.size > 0 && (
                        <button
                          onClick={requestExtraVegetables}
                          disabled={extraVegLoading}
                          style={{
                            marginTop: 12,
                            width: "100%",
                            padding: "14px 16px",
                            background: "#7C7A67",
                            color: "white",
                            border: "none",
                            borderRadius: 10,
                            fontSize: "1rem",
                            fontWeight: "bold",
                            cursor: extraVegLoading ? "default" : "pointer",
                            opacity: extraVegLoading ? 0.7 : 1,
                          }}
                        >
                          {extraVegLoading
                            ? t("addItems.requesting")
                            : t("addItems.requestExtras", { count: selectedExtraVegs.size })}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Paid Add-Ons */}
                  {availableAddons.paidAddons.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            background: "#C7A878",
                            color: "#3d3c35",
                            padding: "4px 10px",
                            borderRadius: 16,
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                          }}
                        >
                          {t("addItems.paid")}
                        </span>
                        <h3 style={{ margin: 0, fontSize: "1rem", color: "#111" }}>
                          🛒 {t("addItems.paidAddons")}
                        </h3>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {availableAddons.paidAddons.map((item) => {
                          const qty = selectedPaidAddons.get(item.id) || 0;
                          const isSelected = qty > 0;
                          return (
                            <div
                              key={item.id}
                              style={{
                                padding: "12px 16px",
                                background: isSelected ? "#f5f5f0" : "#fafafa",
                                border: isSelected ? "2px solid #7C7A67" : "2px solid #d1d5db",
                                borderRadius: 10,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.95rem", fontWeight: "500", color: "#3d3c35" }}>
                                  {item.name}
                                </div>
                                <div style={{ fontSize: "0.85rem", color: "#5a584a" }}>
                                  ${(item.basePriceCents / 100).toFixed(2)}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {isSelected ? (
                                  <>
                                    <button
                                      onClick={() => updatePaidAddonQty(item.id, -1)}
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        border: "none",
                                        background: "#7C7A67",
                                        color: "white",
                                        fontSize: "1.2rem",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      −
                                    </button>
                                    <span
                                      style={{
                                        minWidth: 24,
                                        textAlign: "center",
                                        fontWeight: "bold",
                                        fontSize: "1.1rem",
                                        color: "#3d3c35",
                                      }}
                                    >
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() => updatePaidAddonQty(item.id, 1)}
                                      disabled={qty >= 3}
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        border: "none",
                                        background: qty >= 3 ? "#d1d5db" : "#7C7A67",
                                        color: qty >= 3 ? "#9ca3af" : "white",
                                        fontSize: "1.2rem",
                                        fontWeight: "bold",
                                        cursor: qty >= 3 ? "not-allowed" : "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      +
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => togglePaidAddon(item.id)}
                                    style={{
                                      padding: "8px 16px",
                                      borderRadius: 8,
                                      border: "none",
                                      background: "#7C7A67",
                                      color: "white",
                                      fontSize: "0.85rem",
                                      fontWeight: "bold",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {t("addItems.add")}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Payment Summary & Checkout */}
                      {selectedPaidAddons.size > 0 && (
                        <div
                          style={{
                            marginTop: 16,
                            padding: 16,
                            background: "#f5f5f0",
                            borderRadius: 10,
                            border: "2px solid #7C7A67",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 12,
                            }}
                          >
                            <span style={{ fontWeight: "bold", color: "#3d3c35" }}>
                              {t("addItems.orderTotal")}
                            </span>
                            <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#3d3c35" }}>
                              ${(calculatePaidAddonTotal() / 100).toFixed(2)}
                            </span>
                          </div>

                          {!showPaymentConfirm ? (
                            <button
                              onClick={() => setShowPaymentConfirm(true)}
                              style={{
                                width: "100%",
                                padding: "14px 16px",
                                background: "#7C7A67",
                                color: "white",
                                border: "none",
                                borderRadius: 10,
                                fontSize: "1rem",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
                            >
                              {t("addItems.checkout")}
                            </button>
                          ) : (
                            <div>
                              <div
                                style={{
                                  background: "#e8e6dc",
                                  padding: 12,
                                  borderRadius: 8,
                                  marginBottom: 12,
                                  fontSize: "0.85rem",
                                  color: "#5a584a",
                                }}
                              >
                                ⚠️ {t("addItems.demoMode")}
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={() => setShowPaymentConfirm(false)}
                                  style={{
                                    flex: 1,
                                    padding: "12px 16px",
                                    background: "white",
                                    color: "#5a584a",
                                    border: "2px solid #7C7A67",
                                    borderRadius: 10,
                                    fontSize: "0.95rem",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                  }}
                                >
                                  {t("addItems.cancel")}
                                </button>
                                <button
                                  onClick={submitPaidAddonOrder}
                                  disabled={paidAddonLoading}
                                  style={{
                                    flex: 2,
                                    padding: "12px 16px",
                                    background: paidAddonLoading ? "#9ca3af" : "#5a584a",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 10,
                                    fontSize: "0.95rem",
                                    fontWeight: "bold",
                                    cursor: paidAddonLoading ? "default" : "pointer",
                                  }}
                                >
                                  {paidAddonLoading ? t("addItems.processing") : t("addItems.pay", { amount: `$${(calculatePaidAddonTotal() / 100).toFixed(2)}` })}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* No items available */}
                  {availableAddons.refillableDrinks.length === 0 &&
                    availableAddons.extraVegetables.length === 0 &&
                    availableAddons.paidAddons.length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
                        {t("addItems.noAddons")}
                        <br />
                        <br />
                        <button
                          onClick={callStaff}
                          style={{
                            padding: "12px 24px",
                            background: "#7C7A67",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            fontSize: "1rem",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          🔔 {t("addItems.callStaffInstead")}
                        </button>
                      </div>
                    )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
                  {t("addItems.failedToLoad")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sign-up Modal */}
      {showSignUpModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSignUpModal(false);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 24,
              width: "100%",
              maxWidth: 400,
              maxHeight: "90vh",
              overflow: "auto",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <style>
              {`
                @keyframes fadeIn {
                  from { opacity: 0; transform: scale(0.95); }
                  to { opacity: 1; transform: scale(1); }
                }
              `}
            </style>

            {/* Modal Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
                padding: "32px 24px",
                borderRadius: "24px 24px 0 0",
                textAlign: "center",
                position: "relative",
              }}
            >
              <button
                onClick={() => setShowSignUpModal(false)}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
              <div style={{ fontSize: "3rem", marginBottom: 8 }}>⭐</div>
              <h2
                style={{
                  color: "white",
                  margin: 0,
                  fontSize: "1.4rem",
                }}
              >
                {t("signUp.modalTitle")}
              </h2>
              <p
                style={{
                  color: "rgba(255,255,255,0.85)",
                  margin: "8px 0 0 0",
                  fontSize: "0.9rem",
                }}
              >
                {t("signUp.modalSubtitle")}
              </p>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 24 }}>
              {/* Benefits List */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {[
                    { icon: "🎁", text: t("signUp.benefit1") },
                    { icon: "📊", text: t("signUp.benefit2") },
                    { icon: "🏆", text: t("signUp.benefit3") },
                    { icon: "🎉", text: t("signUp.benefit4") },
                  ].map((benefit, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        background: "#f5f5f0",
                        borderRadius: 12,
                      }}
                    >
                      <span style={{ fontSize: "1.25rem" }}>{benefit.icon}</span>
                      <span style={{ fontSize: "0.9rem", color: "#3d3c35" }}>
                        {benefit.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Badge */}
              <div
                style={{
                  background: "#f5f5f0",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  textAlign: "center",
                  border: "2px dashed #7C7A67",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#7C7A67", marginBottom: 4 }}>
                  {t("signUp.thisOrder")}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#3d3c35" }}>
                  #{order.kitchenOrderNumber || order.orderNumber}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#5a584a", marginTop: 4 }}>
                  {t("signUp.willBeLinked")}
                </div>
              </div>

              {/* Sign-up Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  onClick={() => {
                    // Store order info for linking after sign-up
                    localStorage.setItem("pendingOrderLink", JSON.stringify({
                      orderQrCode: order.orderQrCode,
                      orderId: order.id,
                    }));
                    router.push(`/sign-up?redirect_url=${encodeURIComponent(window.location.href)}`);
                  }}
                  style={{
                    width: "100%",
                    padding: 16,
                    background: "#7C7A67",
                    color: "white",
                    border: "none",
                    borderRadius: 12,
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("signUp.createAccount")}
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem("pendingOrderLink", JSON.stringify({
                      orderQrCode: order.orderQrCode,
                      orderId: order.id,
                    }));
                    router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
                  }}
                  style={{
                    width: "100%",
                    padding: 16,
                    background: "white",
                    color: "#7C7A67",
                    border: "2px solid #7C7A67",
                    borderRadius: 12,
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("signUp.alreadyHaveAccount")}
                </button>
              </div>

              <p
                style={{
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "0.75rem",
                  marginTop: 16,
                  marginBottom: 0,
                }}
              >
                {t("signUp.privacyNote")}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function OrderStatusPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#E5E5E5",
          }}
        >
          <div style={{ color: "#222222", fontSize: "1.2rem" }}>Loading...</div>
        </div>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
