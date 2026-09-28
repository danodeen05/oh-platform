"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import "../kiosk.css";
import { kioskAuthHeaders } from "@/components/kiosk/KioskDeviceProvider";
import { adaptKioskSeats } from "@/lib/pod-selection/adapt-seats";
import { KioskCombPicker } from "@/components/kiosk/KioskCombPicker";
import { kioskCombFrom, podNames, type KioskComb } from "@/lib/kiosk/comb-pick";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Consistent kiosk color system - matching kiosk-order-flow exactly
const COLORS = {
  primary: "#7C7A67",
  primaryLight: "rgba(124, 122, 103, 0.15)",
  primaryBorder: "rgba(124, 122, 103, 0.4)",
  surface: "#FFFFFF",
  surfaceElevated: "#FAFAFA",
  text: "#1a1a1a",
  textMuted: "#999999",
  textOnPrimary: "#FFFFFF",
  success: "#22c55e",
  successLight: "rgba(34, 197, 94, 0.1)",
  warning: "#f59e0b",
  error: "#ef4444",
  border: "#e5e5e5",
};

type Seat = {
  id: string;
  number: string;
  /** Comb pod label ("B-07") when the API sends the raw seat (the check-in error body). */
  label?: string | null;
  status: string;
  podType: "SINGLE" | "DUAL";
  row: number;
  col: number;
  side: string;
  dualPartnerId?: string;
};

type Order = {
  id: string;
  orderNumber: string;
  kitchenOrderNumber?: string;
  orderQrCode?: string;
  status: string;
  totalCents: number;
  guestName?: string;
  seatId?: string;
  seat?: Seat;
  location?: { id: string; name: string };
  items: Array<{ id: string; quantity: number; menuItem: { name: string } }>;
  user?: { name?: string; membershipTier?: string };
  groupOrder?: {
    id: string;
    paymentMethod: "HOST_PAYS_ALL" | "PAY_YOUR_OWN" | null;
    _count: { orders: number };
  } | null;
};

type Member = {
  id: string;
  name: string;
  membershipTier?: string;
  referralCode?: string;
};

// Brand component matching kiosk-welcome exactly
function KioskBrand({ size = "normal" }: { size?: "small" | "normal" | "large" | "xlarge" }) {
  const tHome = useTranslations("home");
  const sizes = {
    small: { logo: 22, chinese: "0.8rem", english: "0.45rem", gap: 3 },
    normal: { logo: 32, chinese: "1.2rem", english: "0.65rem", gap: 4 },
    large: { logo: 64, chinese: "2.3rem", english: "1.2rem", gap: 7 },
    xlarge: { logo: 107, chinese: "3.7rem", english: "1.9rem", gap: 8 },
  };
  const sz = sizes[size];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: sz.gap }}>
      <img src="/Oh_Logo_Large.png" alt="Oh! Logo" style={{ width: sz.logo, height: sz.logo, objectFit: "contain" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: sz.english, lineHeight: 1 }}>
        {tHome.rich("brandName", {
          oh: () => <span style={{ fontFamily: '"Ma Shan Zheng", cursive', fontSize: sz.chinese, color: "#C7A878" }}>哦</span>,
          bebas: (chunks) => <span style={{ fontFamily: '"Bebas Neue", sans-serif', color: COLORS.text, letterSpacing: "0.02em" }}>{chunks}</span>,
        })}
      </div>
    </div>
  );
}

export default function CheckInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("kiosk");
  const tCommon = useTranslations("common");

  const orderId = searchParams.get("orderId");
  const memberId = searchParams.get("memberId");
  const token = searchParams.get("token");
  const orderQrCode = searchParams.get("orderQrCode");
  const locationId = searchParams.get("locationId");

  const [order, setOrder] = useState<Order | null>(null);
  const [memberOrders, setMemberOrders] = useState<Order[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [comb, setComb] = useState<KioskComb>({ layoutKey: null, seats: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPodId, setSelectedPodId] = useState<string | undefined>(undefined);
  const [checkingIn, setCheckingIn] = useState(false);
  const [assignedSeat, setAssignedSeat] = useState<Seat | null>(null);
  const [step, setStep] = useState<"loading" | "select-order" | "pod-selection" | "complete" | "error" | "already-checked-in">("loading");
  const [countdown, setCountdown] = useState(15);
  const [alreadyCheckedInSeat, setAlreadyCheckedInSeat] = useState<Seat | null>(null);
  const [showDualPodRules, setShowDualPodRules] = useState(false);

  // Dual pods can only be selected if:
  // 1. Order is part of a group order with 2+ orders AND
  // 2. Payment method is HOST_PAYS_ALL (single payment, not separate)
  const canSelectDualPod = order?.groupOrder
    ? order.groupOrder._count.orders >= 2 && order.groupOrder.paymentMethod === "HOST_PAYS_ALL"
    : false;

  // Auto-redirect after successful check-in or already checked in
  useEffect(() => {
    if (step === "complete" || step === "already-checked-in") {
      const redirectTime = step === "already-checked-in" ? 8 : 15;
      setCountdown(redirectTime);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push(`/${locale}/kiosk${locationId ? `?locationId=${locationId}` : ''}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, locationId, router]);

  // Load order and seats
  useEffect(() => {
    async function loadData() {
      if (!locationId) {
        setError(t("errors.missingInfo"));
        setStep("error");
        setLoading(false);
        return;
      }

      try {
        const seatsRes = await fetch(`${BASE}/locations/${locationId}/seats`, { headers: { "x-tenant-slug": "oh", ...kioskAuthHeaders() } });
        if (seatsRes.ok) {
          const seatsData = await seatsRes.json();
          setSeats(adaptKioskSeats(seatsData));
          setComb(kioskCombFrom(seatsData));
        }

        if (orderId) {
          const orderRes = await fetch(`${BASE}/orders/${orderId}`, { headers: { "x-tenant-slug": "oh", ...kioskAuthHeaders() } });
          if (!orderRes.ok) { setError(t("errors.orderNotFound")); setStep("error"); setLoading(false); return; }
          const orderData = await orderRes.json();
          setOrder(orderData);
          if (orderData.seatId) setSelectedPodId(orderData.seatId);
          setStep("pod-selection");
          setLoading(false);
          return;
        }

        const qrCode = token || orderQrCode;
        if (qrCode) {
          const orderRes = await fetch(`${BASE}/orders/lookup?code=${encodeURIComponent(qrCode)}`, { headers: { "x-tenant-slug": "oh", ...kioskAuthHeaders() } });
          if (!orderRes.ok) {
            const errData = await orderRes.json().catch(() => ({}));
            // Handle "already checked in" gracefully - not as an error
            if (errData.error === "Order already checked in") {
              setOrder(errData.order || null);
              // Use seat from order response directly, or fallback to local seats lookup
              if (errData.order?.seat) {
                setAlreadyCheckedInSeat(errData.order.seat);
              } else if (errData.order?.seatId) {
                const seat = seats.find((s) => s.id === errData.order.seatId);
                setAlreadyCheckedInSeat(seat || null);
              }
              setStep("already-checked-in");
              setLoading(false);
              return;
            }
            setError(errData.error === "Order not yet paid" ? t("errors.orderNotPaid") : t("errors.orderNotFound"));
            setStep("error");
            setLoading(false);
            return;
          }
          const orderData = await orderRes.json();
          setOrder(orderData);
          if (orderData.seatId) setSelectedPodId(orderData.seatId);
          setStep("pod-selection");
          setLoading(false);
          return;
        }

        if (memberId) {
          const memberRes = await fetch(`${BASE}/orders/by-member?memberId=${encodeURIComponent(memberId)}&locationId=${encodeURIComponent(locationId)}`, { headers: { "x-tenant-slug": "oh", ...kioskAuthHeaders() } });
          if (!memberRes.ok) {
            const errData = await memberRes.json().catch(() => ({}));
            // Member lookups are staff only: this device needs its kiosk key (Setup).
            if (memberRes.status === 401) {
              setError(t("errors.deviceNotAuthorized"));
              setStep("error");
              setLoading(false);
              return;
            }
            // Handle "already checked in" - show pod assignment screen
            if (errData.error === "Order already checked in") {
              setOrder(errData.order || null);
              if (errData.order?.seat) {
                setAlreadyCheckedInSeat(errData.order.seat);
              } else if (errData.order?.seatId) {
                const seat = seats.find((s) => s.id === errData.order.seatId);
                setAlreadyCheckedInSeat(seat || null);
              }
              setStep("already-checked-in");
              setLoading(false);
              return;
            }
            setError(errData.error === "No active orders found" ? (errData.memberName ? t("errors.noActiveOrdersForMember", { name: errData.memberName }) : t("errors.noActiveOrders")) : errData.error === "Member not found" ? t("errors.memberNotFound") : errData.error || t("errors.memberNotFound"));
            setStep("error");
            setLoading(false);
            return;
          }
          const data = await memberRes.json();
          setMember(data.member);
          if (data.orders.length === 1) {
            setOrder(data.orders[0]);
            if (data.orders[0].seatId) setSelectedPodId(data.orders[0].seatId);
            setStep("pod-selection");
          } else {
            setMemberOrders(data.orders);
            setStep("select-order");
          }
          setLoading(false);
          return;
        }

        setError(t("errors.missingInfo"));
        setStep("error");
        setLoading(false);
      } catch (err) {
        setError(t("errors.failedToLoad"));
        setStep("error");
        setLoading(false);
      }
    }
    loadData();
  }, [orderId, memberId, token, orderQrCode, locationId]);

  function handleSelectOrder(selectedOrder: Order) {
    setOrder(selectedOrder);
    if (selectedOrder.seatId) setSelectedPodId(selectedOrder.seatId);
    setStep("pod-selection");
  }

  async function handleCheckIn() {
    if (!order) return;
    setCheckingIn(true);
    try {
      const response = await fetch(`${BASE}/orders/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderQrCode: order.orderQrCode, locationId, selectedSeatId: selectedPodId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Check-in failed");
      }
      const result = await response.json();
      const seat = seats.find((s) => s.id === (result.order?.seatId || selectedPodId));
      setAssignedSeat(seat || null);
      setStep("complete");
    } catch (err: any) {
      setError(err.message || "Check-in failed. Please try again.");
      setStep("error");
    } finally {
      setCheckingIn(false);
    }
  }

  function handleBackToHome() {
    router.push(`/${locale}/kiosk${locationId ? `?locationId=${locationId}` : ''}`);
  }

  function handlePodSelection(podId: string) {
    // Toggle selection or set to "auto" for no preference
    if (podId === "auto") {
      setSelectedPodId(undefined);
    } else {
      setSelectedPodId(selectedPodId === podId ? undefined : podId);
    }
  }

  // Loading state
  if (step === "loading" || loading) {
    return (
      <main className="kiosk-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.surface }}>
        <img src="/Oh_Logo_Mark_Web.png" alt="Loading..." style={{ width: 200, height: 200, objectFit: "contain", animation: "spin-pulse 2s ease-in-out infinite" }} />
      </main>
    );
  }

  // Error state
  if (step === "error" || error) {
    return (
      <main className="kiosk-screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: COLORS.surface, padding: 48 }}>
        <div style={{ width: 100, height: 100, borderRadius: 50, background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke={COLORS.error} strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
        </div>
        <h1 className="kiosk-subtitle" style={{ marginBottom: 12 }}>{t("errors.oops")}</h1>
        <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 40, textAlign: "center" }}>{error}</p>
        <button onClick={() => router.push(`/${locale}/kiosk?locationId=${locationId}`)} className="kiosk-btn kiosk-btn-primary">{t("errors.scanDifferentCode")}</button>
        <button onClick={handleBackToHome} className="kiosk-btn kiosk-btn-ghost" style={{ marginTop: 16, opacity: 0.7 }}>{tCommon("back")}</button>
      </main>
    );
  }

  // Already checked in - friendly info state (not an error) - compact layout
  if (step === "already-checked-in") {
    const customerName = order?.user?.name || order?.guestName || "Guest";
    return (
      <main className="kiosk-screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: COLORS.surface, padding: "24px 48px", textAlign: "center" }}>
        <div style={{ width: 70, height: 70, borderRadius: 35, background: COLORS.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h1 className="kiosk-title" style={{ marginBottom: 6, fontSize: "1.8rem" }}>{t("checkIn.alreadyCheckedInTitle", { name: customerName })}</h1>
        <p style={{ color: COLORS.textMuted, marginBottom: 16, fontSize: "1.1rem" }}>
          {t("checkIn.alreadyCheckedInMessage")}
        </p>

        {/* Pod assignment - prominently displayed */}
        {alreadyCheckedInSeat && (
          <div style={{ background: COLORS.primary, borderRadius: 20, padding: "28px 56px", marginBottom: 16, color: COLORS.textOnPrimary }}>
            <div style={{ fontSize: "1rem", opacity: 0.85, marginBottom: 6 }}>{t("pod.proceedTo")}</div>
            <div style={{ fontSize: "4.5rem", fontWeight: 700, lineHeight: 1 }}>{t("pod.podNumber", { number: alreadyCheckedInSeat.label || alreadyCheckedInSeat.number })}</div>
          </div>
        )}

        <p style={{ color: COLORS.textMuted, marginBottom: 12, fontSize: "1rem" }}>{t("pod.foodBeingPrepared")}</p>

        {order && (
          <div style={{ background: COLORS.surfaceElevated, borderRadius: 14, padding: "14px 20px", border: `1px solid ${COLORS.border}`, marginBottom: 12, minWidth: 260 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "1rem" }}>{t("pod.orderNumber", { number: order.orderNumber })}</div>
            <div style={{ color: COLORS.textMuted, fontSize: "0.95rem" }}>
              {order.items?.slice(0, 3).map((item) => <div key={item.id}>{item.quantity}x {item.menuItem.name}</div>)}
              {(order.items?.length || 0) > 3 && <div style={{ fontStyle: "italic" }}>+{(order.items?.length || 0) - 3} more items</div>}
            </div>
          </div>
        )}

        {/* Auto-redirect countdown */}
        <div style={{ background: COLORS.primaryLight, border: `1px solid ${COLORS.primaryBorder}`, borderRadius: 10, padding: "8px 20px", marginBottom: 14 }}>
          <p style={{ margin: 0, color: COLORS.text, fontSize: "0.9rem" }}>
            {t("checkIn.redirectingIn", { seconds: countdown })}
          </p>
        </div>

        <button onClick={handleBackToHome} className="kiosk-btn kiosk-btn-primary" style={{ padding: "12px 32px" }}>{tCommon("ok")}</button>
      </main>
    );
  }

  // Order selection (multiple orders)
  if (step === "select-order") {
    return (
      <main className="kiosk-screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: COLORS.surface, padding: 48 }}>
        {member && (
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <h1 className="kiosk-title" style={{ marginBottom: 8 }}>{t("pod.welcome", { name: member.name })}</h1>
            {member.membershipTier && (
              <div style={{ display: "inline-block", padding: "6px 16px", background: COLORS.primaryLight, borderRadius: 20, fontSize: "0.85rem", fontWeight: 600, color: COLORS.primary }}>
                {t("pod.member", { tier: member.membershipTier })}
              </div>
            )}
          </div>
        )}
        <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 32, fontSize: "1.2rem" }}>{t("checkIn.selectOrder")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 600 }}>
          {memberOrders.map((ord) => (
            <button key={ord.id} onClick={() => handleSelectOrder(ord)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 24, background: COLORS.surfaceElevated, border: `2px solid ${COLORS.border}`, borderRadius: 16, cursor: "pointer", textAlign: "left" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "1.25rem", marginBottom: 8 }}>{t("pod.orderNumber", { number: ord.orderNumber })}</div>
                <div style={{ color: COLORS.textMuted, fontSize: "1rem" }}>
                  {ord.items.slice(0, 3).map((item, i) => <span key={item.id}>{item.quantity}x {item.menuItem.name}{i < Math.min(ord.items.length, 3) - 1 ? ", " : ""}</span>)}
                  {ord.items.length > 3 && ` +${ord.items.length - 3} more`}
                </div>
              </div>
              <div style={{ background: COLORS.primary, color: COLORS.textOnPrimary, padding: "8px 16px", borderRadius: 8, fontWeight: 600, fontSize: "1.1rem" }}>${(ord.totalCents / 100).toFixed(2)}</div>
            </button>
          ))}
        </div>
        <button onClick={handleBackToHome} className="kiosk-btn kiosk-btn-ghost" style={{ marginTop: 32 }}>{tCommon("cancel")}</button>
      </main>
    );
  }

  // Complete state - compact layout to fit on screen without scrolling
  if (step === "complete") {
    return (
      <main className="kiosk-screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: COLORS.surface, padding: "24px 48px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: 40, background: COLORS.successLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h1 className="kiosk-title" style={{ marginBottom: 8, fontSize: "2rem" }}>{t("pod.welcome", { name: order?.user?.name || order?.guestName || "Guest" })}</h1>
        {assignedSeat && (
          <div style={{ background: COLORS.primary, borderRadius: 20, padding: "24px 48px", marginTop: 16, marginBottom: 16, color: COLORS.textOnPrimary }}>
            <div style={{ fontSize: "1rem", opacity: 0.85, marginBottom: 6 }}>{t("pod.proceedTo")}</div>
            <div style={{ fontSize: "4rem", fontWeight: 700, lineHeight: 1 }}>{t("pod.podNumber", { number: assignedSeat.label || assignedSeat.number })}</div>
          </div>
        )}
        <div style={{ background: COLORS.surfaceElevated, borderRadius: 16, padding: "16px 24px", border: `1px solid ${COLORS.border}`, marginBottom: 16, minWidth: 280 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: "1.1rem" }}>{t("pod.orderNumber", { number: order?.orderNumber })}</div>
          <div style={{ color: COLORS.textMuted, fontSize: "1rem" }}>
            {order?.items.slice(0, 3).map((item) => <div key={item.id}>{item.quantity}x {item.menuItem.name}</div>)}
            {(order?.items.length || 0) > 3 && <div style={{ fontStyle: "italic" }}>+{(order?.items.length || 0) - 3} more items</div>}
          </div>
        </div>
        <p style={{ color: COLORS.textMuted, marginBottom: 12, fontSize: "1rem" }}>{t("pod.foodBeingPrepared")}</p>

        {/* Auto-redirect countdown */}
        <div style={{ background: COLORS.primaryLight, border: `1px solid ${COLORS.primaryBorder}`, borderRadius: 10, padding: "8px 20px", marginBottom: 16 }}>
          <p style={{ margin: 0, color: COLORS.text, fontSize: "0.9rem" }}>
            {t("checkIn.redirectingIn", { seconds: countdown })}
          </p>
        </div>

        <button onClick={handleBackToHome} className="kiosk-btn kiosk-btn-primary" style={{ padding: "12px 32px" }}>{tCommon("ok")}</button>
      </main>
    );
  }

  // Pod selection - EXACT layout from kiosk-order-flow.tsx
  const customerName = order?.user?.name || order?.guestName || "Guest";
  const selectedPod = podNames(comb.seats, selectedPodId);

  return (
    <main style={{ height: "calc(var(--kvh, 1vh) * 100)", maxHeight: "calc(var(--kvh, 1vh) * 100)", background: COLORS.surface, color: COLORS.text, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div style={{ position: "absolute", top: "50%", right: "-15%", transform: "translateY(-50%)", opacity: 0.08, pointerEvents: "none", zIndex: 0 }}>
        <img src="/Oh_Logo_Mark_Web.png" alt="" style={{ height: "calc(var(--kvh, 1vh) * 90)", width: "auto", objectFit: "contain" }} />
      </div>

      {/* Large Brand Header - top left */}
      <div style={{ position: "absolute", top: 20, left: 40, zIndex: 1 }}>
        <KioskBrand size="large" />
      </div>

      {/* Compact header on the pod step so the whole comb fits (D12 fix round 1) */}
      <div style={{ textAlign: "center", paddingTop: 20, paddingBottom: 14, background: COLORS.primaryLight, borderBottom: `1px solid ${COLORS.primaryBorder}`, zIndex: 1 }}>
        <h1 className="kiosk-title" style={{ fontSize: "2.75rem", fontWeight: 700, marginBottom: 4 }}>{t("orderFlow.chooseYourPod")}</h1>
        <p style={{ color: COLORS.textMuted, margin: 0, fontSize: "1.25rem" }}>
          <strong style={{ color: COLORS.text }}>{customerName}</strong>, {t("orderFlow.pickPrivatePod")}
        </p>
      </div>

      {/* Content: the choice line first, then the comb sized to the height that is left */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "12px 40px", paddingBottom: 104 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", background: COLORS.primaryLight, border: `2px solid ${COLORS.primary}`, borderRadius: 10, padding: "8px 16px", minHeight: 60 }}>
          {selectedPod ? (
            <>
              <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                {selectedPod.duo ? t("pod.dualPodSelected", { numbers: selectedPod.label }) : t("pod.podSelected", { number: selectedPod.label })}
              </span>
              <span style={{ color: COLORS.textMuted, fontSize: "0.95rem" }}>{selectedPod.duo ? t("pod.dualPod") : t("pod.singlePod")}</span>
            </>
          ) : (
            <>
              <span style={{ fontWeight: 600, color: COLORS.text, fontSize: "1.05rem" }}>{t("orderFlow.noPreferenceTitle")}</span>
              <button onClick={() => handlePodSelection("auto")} style={{ minHeight: 44, padding: "8px 20px", background: COLORS.primary, border: "none", borderRadius: 8, color: COLORS.textOnPrimary, fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}>
                {t("orderFlow.autoAssignPod")}
              </button>
            </>
          )}
        </div>

        {comb.layoutKey ? (
          <div className="mx-auto self-center" style={{ width: "min(100%, 1040px, calc((var(--kvh, 1vh) * 100 - 460px) * 1.36))" }}>
            <KioskCombPicker
              layoutKey={comb.layoutKey}
              seats={comb.seats}
              selectedPodId={selectedPodId}
              canSelectDualPod={canSelectDualPod}
              onSelectPod={handlePodSelection}
              onDualBlocked={() => setShowDualPodRules(true)}
            />
          </div>
        ) : null}
      </div>

      {/* Fixed Bottom Navigation with color */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 24px", background: "#F1F0EC", borderTop: `1px solid ${COLORS.primaryBorder}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.06)", display: "flex", justifyContent: "center", gap: 16, zIndex: 10 }}>
        <button onClick={handleBackToHome} style={{ padding: "16px 32px", background: COLORS.surface, border: `2px solid ${COLORS.primary}`, borderRadius: 12, color: COLORS.text, fontSize: "1.1rem", fontWeight: 600, cursor: "pointer" }}>
          {t("orderFlow.back")}
        </button>
        <button onClick={handleCheckIn} disabled={checkingIn} style={{ padding: "16px 48px", background: checkingIn ? "#ccc" : COLORS.primary, border: "none", borderRadius: 12, color: COLORS.textOnPrimary, fontSize: "1.1rem", fontWeight: 600, cursor: checkingIn ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <strong>{checkingIn ? tCommon("loading") : t("pod.checkInButton")}</strong>
          {!checkingIn && <span style={{ display: "inline-block", animation: "chevronBounceHorizontal 1s ease-in-out infinite" }}>→</span>}
        </button>
      </div>

      <style>{`
        @keyframes chevronBounceHorizontal {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
      `}</style>

      {/* Dual Pod Rules Modal */}
      {showDualPodRules && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowDualPodRules(false)}
        >
          <div
            style={{
              background: COLORS.surface,
              borderRadius: 24,
              padding: 40,
              maxWidth: 500,
              margin: 24,
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                background: "rgba(8, 145, 178, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            </div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 16, color: COLORS.text }}>
              {t("pod.dualPodRulesTitle")}
            </h2>
            <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
              {t("pod.dualPodRulesMessage")}
            </p>
            <ul style={{ textAlign: "left", marginBottom: 32, paddingLeft: 24 }}>
              <li style={{ fontSize: "1rem", color: COLORS.text, marginBottom: 12 }}>
                {t("pod.dualPodRule1")}
              </li>
              <li style={{ fontSize: "1rem", color: COLORS.text, marginBottom: 12 }}>
                {t("pod.dualPodRule2")}
              </li>
            </ul>
            <button
              onClick={() => setShowDualPodRules(false)}
              style={{
                padding: "16px 48px",
                background: COLORS.primary,
                border: "none",
                borderRadius: 12,
                color: COLORS.textOnPrimary,
                fontSize: "1.1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tCommon("ok")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
