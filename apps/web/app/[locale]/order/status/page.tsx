"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Dialog";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

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

function StatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("order");
  const toast = useToast();
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
  const [lastCommentaryStatus, setLastCommentaryStatus] = useState<string | null>(null);

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
        setStatus(data);
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

  // Fetch fortune cookie
  async function fetchFortune() {
    if (!orderQrCode || fortune || fortuneLoading) return;

    setFortuneLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/fortune?orderQrCode=${encodeURIComponent(orderQrCode)}`,
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

  // Fetch order roast
  async function fetchRoast() {
    if (!orderQrCode || roast || roastLoading) return;

    setRoastLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/roast?orderQrCode=${encodeURIComponent(orderQrCode)}`,
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
    if (currentStatus === lastCommentaryStatus) return;

    setCommentaryLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/commentary?orderQrCode=${encodeURIComponent(orderQrCode)}`,
        {
          headers: { "x-tenant-slug": "oh" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCommentary(data);
        setLastCommentaryStatus(currentStatus);
      }
    } catch (err) {
      console.error("Failed to fetch commentary:", err);
    } finally {
      setCommentaryLoading(false);
    }
  }

  // Fetch backstory
  async function fetchBackstory(orderId: string) {
    if (!orderId || backstory || backstoryLoading) return;

    setBackstoryLoading(true);
    try {
      const response = await fetch(
        `${BASE}/orders/${orderId}/backstory`,
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
        toast.success(t("success.staffNotified"));
        setTimeout(() => setCallStaffSuccess(false), 5000);
      } else {
        const data = await response.json();
        toast.error(data.error || t("errors.callStaff"));
      }
    } catch (err) {
      console.error("Failed to call staff:", err);
      toast.error(t("errors.callStaff"));
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
        `${BASE}/orders/${status.order.id}/available-addons`,
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
        toast.success(t("success.refillRequested"));
        setShowAddOnModal(false);
      } else {
        const data = await response.json();
        toast.error(data.error || t("errors.requestRefill"));
      }
    } catch (err) {
      console.error("Failed to request refill:", err);
      toast.error(t("errors.requestRefill"));
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
        toast.success(t("success.vegetablesRequested"));
        setShowAddOnModal(false);
        setSelectedExtraVegs(new Set());
      } else {
        const data = await response.json();
        toast.error(data.error || t("errors.requestVegetables"));
      }
    } catch (err) {
      console.error("Failed to request extra vegetables:", err);
      toast.error(t("errors.requestVegetables"));
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
        toast.success(t("success.dessertOnWay"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("errors.requestDessert"));
      }
    } catch (err) {
      console.error("Failed to request dessert:", err);
      toast.error(t("errors.requestDessert"));
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

      toast.success(t("success.addonOrdered", { amount: `$${(totalCents / 100).toFixed(2)}` }));
      setShowAddOnModal(false);
      setSelectedPaidAddons(new Map());
      setShowPaymentConfirm(false);
    } catch (err: any) {
      console.error("Failed to submit paid add-on:", err);
      toast.error(err.message || t("errors.placeAddonOrder"));
    } finally {
      setPaidAddonLoading(false);
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [orderQrCode]);

  // Poll every 5 seconds
  useEffect(() => {
    if (!orderQrCode) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

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
          <h1 style={{ color: "#111" }}>No order code provided</h1>
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
            Place New Order
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
            Loading order status...
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
          <h1 style={{ color: "#111" }}>{error || "Order not found"}</h1>
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
            Place New Order
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
        return { icon: "💳", label: "Pending Payment", color: "#f59e0b" };
      case "PAID":
        return { icon: "✅", label: "Paid", color: "#7C7A67" };
      case "QUEUED":
        return { icon: "⏳", label: "In Queue", color: "#6366f1" };
      case "PREPPING":
        return { icon: "👨‍🍳", label: "Preparing", color: "#f59e0b" };
      case "READY":
        return { icon: "🔔", label: "Ready for Delivery", color: "#7C7A67" };
      case "SERVING":
        return { icon: "🍜", label: "Enjoy Your Meal!", color: "#7C7A67" };
      case "COMPLETED":
        return { icon: "🎉", label: "Completed", color: "#6b7280" };
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
              Order #{order.kitchenOrderNumber || order.orderNumber}
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
                    Live Kitchen Feed
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
                    Listening to the kitchen...
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
                    The kitchen is suspiciously quiet. They're up to something.
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
                Your Pod
              </div>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  letterSpacing: "0.1em",
                }}
              >
                POD {order.podNumber}
              </div>
              {!order.podConfirmedAt ? (
                <>
                  <div style={{ fontSize: "0.85rem", marginTop: 8, opacity: 0.9 }}>
                    Go to your pod and confirm arrival
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
                    🪑 Confirm I'm At My Pod
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "0.85rem", marginTop: 8, opacity: 0.9 }}>
                    ✓ You're checked in!
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
                          <>✓ Staff Notified</>
                        ) : callStaffLoading ? (
                          <>Calling...</>
                        ) : (
                          <>🔔 Call Staff</>
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
                        ➕ Add Items
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
                            <>✓ Dessert On Its Way!</>
                          ) : dessertLoading ? (
                            <>Notifying...</>
                          ) : (
                            <>🍨 Ready for Dessert</>
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
                Queue Position
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
                  Estimated wait: {order.estimatedWaitMinutes} minutes
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
                We'll notify you when a pod is ready!
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
              Order Timeline
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
                    <span style={{ fontWeight: 500 }}>Paid</span>
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
                    <span style={{ fontWeight: 500 }}>Checked In</span>
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
                    <span style={{ fontWeight: 500 }}>Order Started</span>
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
                    <span style={{ fontWeight: 500 }}>Order Quality Check</span>
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
                    <span style={{ fontWeight: 500 }}>Delivered</span>
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
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Total Time</span>
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
            Location
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 500 }}>
            {order.location.name}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>
            {order.location.city}
          </div>
        </div>

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
                  Your Digital Fortune Cookie
                </h3>
                <p
                  style={{
                    color: "#7C7A67",
                    fontSize: "0.9rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  While you wait, crack open your personalized fortune
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
                  🥠 Crack It Open
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
                  Reading your fortune...
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
                    Lucky Numbers
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
                      📜 This Day in History ({fortune.thisDayInHistory.year})
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
                      📖 Learn Chinese
                    </div>

                    {/* Main Chinese Character(s) with audio button */}
                    <button
                      onClick={() => {
                        if ('speechSynthesis' in window) {
                          const utterance = new SpeechSynthesisUtterance(fortune.learnChinese!.traditional);
                          utterance.lang = 'zh-TW';
                          utterance.rate = 0.8;
                          // Try to find a Chinese voice
                          const voices = speechSynthesis.getVoices();
                          const chineseVoice = voices.find(v =>
                            v.lang.startsWith('zh') || v.lang.includes('Chinese')
                          );
                          if (chineseVoice) {
                            utterance.voice = chineseVoice;
                          }
                          speechSynthesis.speak(utterance);
                        }
                      }}
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderRadius: 12,
                        padding: "16px 24px",
                        width: "100%",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 16,
                        marginBottom: 12,
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.25)";
                        e.currentTarget.style.transform = "scale(1.02)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                      title="Tap to hear pronunciation"
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
                      <span
                        style={{
                          fontSize: "1.5rem",
                          opacity: 0.9,
                        }}
                      >
                        🔊
                      </span>
                    </button>

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
                  Fortune unavailable - but your meal is still going to be amazing!
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
                  The Roast Zone
                </h3>
                <p
                  style={{
                    color: "#b45309",
                    fontSize: "0.85rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  Want our brutally honest (and hilarious) take on your order choices?
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
                  🔥 Roast My Order
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
                  Analyzing your life choices...
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
                      🎯 What caught our attention:
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
                  Our roast chef is on break. Your order is probably fine. Probably.
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
                  Behind the Scenes
                </h3>
                <p
                  style={{
                    color: "#3d3c35",
                    fontSize: "0.85rem",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  Ever wonder about the secret lives of your ingredients?
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
                  🎬 Tell Me Everything
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
                  Digging up the dirt...
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
                  The Untold Stories
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
                  The ingredients prefer to remain anonymous. Mysterious bunch.
                </p>
              </>
            )}
          </div>
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
              ✓ I'm Done Eating
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
            View My Profile
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
            Order Again
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
          Status updates automatically every 5 seconds
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
                Add to Your Order
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
                  Loading available items...
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
                          Free
                        </span>
                        <h3 style={{ margin: 0, fontSize: "1rem", color: "#111" }}>
                          🥤 Drink Refills
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
                              {refillLoading ? "Requesting..." : "Request Refill →"}
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
                          <span>Water Refill</span>
                          <span style={{ fontSize: "0.85rem" }}>
                            {refillLoading ? "Requesting..." : "Request →"}
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
                          Free
                        </span>
                        <h3 style={{ margin: 0, fontSize: "1rem", color: "#111" }}>
                          🥬 Extras & Add-Ons
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
                            ? "Requesting..."
                            : `Request ${selectedExtraVegs.size} Extra${selectedExtraVegs.size > 1 ? "s" : ""}`}
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
                          Paid
                        </span>
                        <h3 style={{ margin: 0, fontSize: "1rem", color: "#111" }}>
                          🛒 Add-Ons & Extras
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
                                    Add
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
                              Order Total
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
                              Checkout →
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
                                ⚠️ Demo mode: No real charge will be made
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
                                  Cancel
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
                                  {paidAddonLoading ? "Processing..." : `Pay $${(calculatePaidAddonTotal() / 100).toFixed(2)}`}
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
                        No add-ons available for this order.
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
                          🔔 Call Staff Instead
                        </button>
                      </div>
                    )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
                  Failed to load add-ons. Please try again or call staff.
                </div>
              )}
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
