"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import "../kiosk.css";

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
  const videoRef = useRef<HTMLVideoElement>(null);

  const orderId = searchParams.get("orderId");
  const memberId = searchParams.get("memberId");
  const token = searchParams.get("token");
  const orderQrCode = searchParams.get("orderQrCode");
  const locationId = searchParams.get("locationId");

  const [order, setOrder] = useState<Order | null>(null);
  const [memberOrders, setMemberOrders] = useState<Order[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
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

  // Ensure video plays on mount
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => console.log("Video autoplay blocked"));
    }
  }, [step]);

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
        const seatsRes = await fetch(`${BASE}/locations/${locationId}/seats`, { headers: { "x-tenant-slug": "oh" } });
        if (seatsRes.ok) setSeats(await seatsRes.json());

        if (orderId) {
          const orderRes = await fetch(`${BASE}/orders/${orderId}`, { headers: { "x-tenant-slug": "oh" } });
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
          const orderRes = await fetch(`${BASE}/orders/lookup?code=${encodeURIComponent(qrCode)}`, { headers: { "x-tenant-slug": "oh" } });
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
          const memberRes = await fetch(`${BASE}/orders/by-member?memberId=${encodeURIComponent(memberId)}&locationId=${encodeURIComponent(locationId)}`, { headers: { "x-tenant-slug": "oh" } });
          if (!memberRes.ok) {
            const errData = await memberRes.json().catch(() => ({}));
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
            <div style={{ fontSize: "4.5rem", fontWeight: 700, lineHeight: 1 }}>{t("pod.podNumber", { number: alreadyCheckedInSeat.number })}</div>
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
            <div style={{ fontSize: "4rem", fontWeight: 700, lineHeight: 1 }}>{t("pod.podNumber", { number: assignedSeat.number })}</div>
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
  const leftSeats = seats.filter((s) => s.side === "left").sort((a, b) => a.col - b.col);
  const bottomSeats = seats.filter((s) => s.side === "bottom").sort((a, b) => a.col - b.col);
  const rightSeats = seats.filter((s) => s.side === "right").sort((a, b) => b.col - a.col);
  const selectedSeat = seats.find((s) => s.id === selectedPodId);

  // Helper functions for dual pods - exact from kiosk-order-flow
  const isDualPod = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    if (seat.dualPartnerId) return true;
    return seats.some(s => s.dualPartnerId === seat.id);
  };
  const getPartner = (seat: Seat) => seat.dualPartnerId ? seats.find(s => s.id === seat.dualPartnerId) : seats.find(s => s.dualPartnerId === seat.id);
  const shouldHideSeat = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    if (seat.dualPartnerId) return false;
    return seats.some(s => s.dualPartnerId === seat.id);
  };

  return (
    <main style={{ height: "100vh", maxHeight: "100vh", background: COLORS.surface, color: COLORS.text, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div style={{ position: "absolute", top: "50%", right: "-15%", transform: "translateY(-50%)", opacity: 0.08, pointerEvents: "none", zIndex: 0 }}>
        <img src="/Oh_Logo_Mark_Web.png" alt="" style={{ height: "90vh", width: "auto", objectFit: "contain" }} />
      </div>

      {/* Large Brand Header - top left */}
      <div style={{ position: "absolute", top: 48, left: 48, zIndex: 1 }}>
        <KioskBrand size="xlarge" />
      </div>

      {/* Fixed Header with color */}
      <div style={{ textAlign: "center", paddingTop: 32, paddingBottom: 20, background: COLORS.primaryLight, borderBottom: `1px solid ${COLORS.primaryBorder}`, zIndex: 1 }}>
        <h1 className="kiosk-title" style={{ fontSize: "3.5rem", fontWeight: 700, marginBottom: 8 }}>{t("orderFlow.chooseYourPod")}</h1>
        <p style={{ color: COLORS.textMuted, margin: 0, fontSize: "1.25rem" }}>
          <strong style={{ color: COLORS.text }}>{customerName}</strong>, {t("orderFlow.pickPrivatePod")}
        </p>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 48px", paddingBottom: 100 }}>
        {/* Pod Map - U-Shape Layout (Centered) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {/* Store Border Container - wraps entire floor plan */}
          <div style={{ position: "relative", padding: "52px 73px 26px 73px", display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(124, 122, 103, 0.08)", border: "4px solid #7C7A67", borderRadius: 20 }}>
            {/* Entrance opening */}
            <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", width: "24%", height: 8, background: COLORS.surface }} />
            {/* Exit opening */}
            <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: "24%", height: 8, background: COLORS.surface }} />

            {/* Entrance Label */}
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", color: COLORS.textMuted, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🚪</span> {t("orderFlow.entrance")}
            </div>

            {/* Wall of Fame */}
            <div style={{ position: "absolute", top: 8, left: 12, display: "flex", alignItems: "center", gap: 6, color: COLORS.textMuted, fontSize: "0.9rem", fontWeight: 600 }}>
              <span style={{ fontSize: "1.25rem" }}>🏆</span><span>Wall of Fame</span>
            </div>

            {/* Kiosk / You Are Here */}
            <div style={{ position: "absolute", top: 75, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.textMuted, fontSize: "0.9rem", fontWeight: 600 }}>
                <span style={{ fontSize: "1.25rem" }}>🖥️</span><span>Kiosk</span>
              </div>
              <div style={{ fontSize: "0.7rem", color: COLORS.primary, fontWeight: 700, background: COLORS.primaryLight, padding: "2px 8px", borderRadius: 4 }}>📍 You are here</div>
            </div>

            {/* Spacer for lobby */}
            <div style={{ height: 50 }} />

            {/* U-Shape Container: Left Column | Kitchen | Right Column */}
            <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
              {/* Left Column with wall */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ width: "calc(100% + 10px)", height: 3, background: "#7C7A67", borderRadius: "2px 0 0 2px", marginBottom: 4 }} />
                {leftSeats.filter(seat => !shouldHideSeat(seat)).map((seat) => {
                  const isDual = isDualPod(seat);
                  const partner = isDual ? getPartner(seat) : null;
                  const isSelectedDual = isDual && partner && (selectedPodId === seat.id || selectedPodId === partner.id);
                  const isCurrentlySelected = selectedPodId === seat.id || isSelectedDual;
                  return (
                    <PodButton key={seat.id} seat={seat} seats={seats} partner={partner} isDual={isDual} isSelected={isCurrentlySelected} canSelectDualPod={canSelectDualPod} onClick={() => handlePodSelection(isCurrentlySelected ? "" : seat.id)} onDisabledDualClick={() => setShowDualPodRules(true)} orientation="vertical" />
                  );
                })}
              </div>

              {/* Kitchen in the center with full border */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 36px", minHeight: 180, border: "3px solid #7C7A67", borderRadius: "0 0 16px 16px", background: "rgba(124, 122, 103, 0.35)" }}>
                <div style={{ width: 140, height: 140, borderRadius: "50%", overflow: "hidden", marginBottom: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", border: `3px solid ${COLORS.primary}` }}>
                  <video ref={videoRef} autoPlay muted playsInline onEnded={(e) => { setTimeout(() => { e.currentTarget.currentTime = 0; e.currentTarget.play(); }, 3000); }} style={{ width: "100%", height: "100%", objectFit: "cover" }}>
                    <source src="/kiosk-video.mp4" type="video/mp4" />
                  </video>
                </div>
                <span style={{ fontSize: "1.25rem", fontWeight: 600, color: COLORS.text }}>{t("orderFlow.kitchen")}</span>
              </div>

              {/* Right Column with wall */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ width: "calc(100% + 10px)", height: 3, background: "#7C7A67", borderRadius: "0 2px 2px 0", marginLeft: -10, marginBottom: 4 }} />
                {rightSeats.filter(seat => !shouldHideSeat(seat)).map((seat) => {
                  const isDual = isDualPod(seat);
                  const partner = isDual ? getPartner(seat) : null;
                  const isSelectedDual = isDual && partner && (selectedPodId === seat.id || selectedPodId === partner.id);
                  const isCurrentlySelected = selectedPodId === seat.id || isSelectedDual;
                  return (
                    <PodButton key={seat.id} seat={seat} seats={seats} partner={partner} isDual={isDual} isSelected={isCurrentlySelected} canSelectDualPod={canSelectDualPod} onClick={() => handlePodSelection(isCurrentlySelected ? "" : seat.id)} onDisabledDualClick={() => setShowDualPodRules(true)} orientation="vertical" />
                  );
                })}
              </div>
            </div>

            {/* Bottom Row */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              {bottomSeats.filter(seat => !shouldHideSeat(seat)).map((seat) => {
                const isDual = isDualPod(seat);
                const partner = isDual ? getPartner(seat) : null;
                const isSelectedDual = isDual && partner && (selectedPodId === seat.id || selectedPodId === partner.id);
                const isCurrentlySelected = selectedPodId === seat.id || isSelectedDual;
                return (
                  <PodButton key={seat.id} seat={seat} seats={seats} partner={partner} isDual={isDual} isSelected={isCurrentlySelected} canSelectDualPod={canSelectDualPod} onClick={() => handlePodSelection(isCurrentlySelected ? "" : seat.id)} onDisabledDualClick={() => setShowDualPodRules(true)} orientation="horizontal" />
                );
              })}
            </div>

            {/* Spacer for exit area */}
            <div style={{ height: 50 }} />

            {/* Store Indicator - Bottom Left */}
            <div style={{ position: "absolute", bottom: 8, left: 12, display: "flex", alignItems: "center", gap: 6, color: COLORS.textMuted, fontSize: "0.9rem", fontWeight: 600 }}>
              <span style={{ fontSize: "1.25rem" }}>🛍️</span><span>{t("orderFlow.store")}</span>
            </div>

            {/* Restrooms Indicator - Bottom Right */}
            <div style={{ position: "absolute", bottom: 8, right: 12, display: "flex", alignItems: "center", gap: 6, color: COLORS.textMuted, fontSize: "0.9rem", fontWeight: 600 }}>
              <span style={{ fontSize: "1.25rem" }}>🚻</span><span>{t("orderFlow.restrooms")}</span>
            </div>

            {/* Exit Label */}
            <div style={{ position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)", color: COLORS.textMuted, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🚶</span> {t("orderFlow.exit")}
            </div>
          </div>

          {/* Selection Info Card */}
          <div style={{ background: COLORS.primaryLight, border: `2px solid ${COLORS.primary}`, borderRadius: 10, padding: 12, textAlign: "center", marginTop: 8 }}>
            {selectedSeat ? (
              <>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                  {(() => {
                    const isDual = isDualPod(selectedSeat);
                    if (isDual) {
                      const partner = getPartner(selectedSeat);
                      if (partner) {
                        const num1 = parseInt(selectedSeat.number);
                        const num2 = parseInt(partner.number);
                        return t("pod.dualPodSelected", { numbers: `${Math.min(num1, num2).toString().padStart(2, '0')} & ${Math.max(num1, num2).toString().padStart(2, '0')}` });
                      }
                    }
                    return t("pod.podSelected", { number: selectedSeat.number });
                  })()}
                </div>
                <div style={{ color: COLORS.textMuted, fontSize: "0.8rem" }}>{isDualPod(selectedSeat) ? t("pod.dualPod") : t("pod.singlePod")}</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, color: COLORS.text, fontSize: "0.9rem" }}>{t("orderFlow.noPreferenceTitle")}</div>
                <button onClick={() => handlePodSelection("auto")} style={{ padding: "8px 16px", background: COLORS.primary, border: "none", borderRadius: 8, color: COLORS.textOnPrimary, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
                  {t("orderFlow.autoAssignPod")}
                </button>
              </>
            )}
          </div>

          {/* Legend - Horizontal */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 4, background: COLORS.success }} />
              <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{t("orderFlow.available")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 40, height: 24, borderRadius: 4, background: "#0891b2" }} />
              <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{t("orderFlow.dualPod")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 4, background: "#f59e0b" }} />
              <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{t("orderFlow.cleaning")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 4, background: "#ef4444" }} />
              <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{t("orderFlow.occupied")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 4, background: COLORS.primary, border: `2px solid ${COLORS.text}` }} />
              <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{t("orderFlow.yourSelection")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation with color */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 24px", background: COLORS.primaryLight, borderTop: `1px solid ${COLORS.primaryBorder}`, display: "flex", justifyContent: "center", gap: 16, zIndex: 10 }}>
        <button onClick={handleBackToHome} style={{ padding: "16px 32px", background: "transparent", border: `2px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.textMuted, fontSize: "1.1rem", cursor: "pointer" }}>
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

// PodButton component - matching kiosk-order-flow.tsx with dual pod rules
function PodButton({ seat, seats, partner, isDual, isSelected, canSelectDualPod = true, onClick, onDisabledDualClick, orientation = "vertical" }: {
  seat: Seat;
  seats: Seat[];
  partner?: Seat | null;
  isDual?: boolean;
  isSelected: boolean;
  canSelectDualPod?: boolean;
  onClick: () => void;
  onDisabledDualClick?: () => void;
  orientation?: "vertical" | "horizontal";
}) {
  const t = useTranslations("kiosk");
  const partnerAvailable = partner ? partner.status === "AVAILABLE" : true;
  // For dual pods, also check if dual pods can be selected (requires 2+ guests with single payment)
  const isAvailable = seat.status === "AVAILABLE" && partnerAvailable && (!isDual || canSelectDualPod);
  const isCleaning = seat.status === "CLEANING";
  const isOccupied = seat.status === "OCCUPIED" || seat.status === "SERVING";

  const getStatusText = () => {
    if (isOccupied) return t("pod.statusOccupied");
    if (isCleaning) return t("pod.statusCleaning");
    if (isAvailable) return t("pod.statusAvailable");
    return null;
  };
  const statusText = getStatusText();

  // Update background color to show greyed-out dual pods
  const bgColor = isSelected
    ? COLORS.primary
    : isCleaning
    ? "#f59e0b"
    : isOccupied
    ? "#ef4444"
    : isDual && !canSelectDualPod
    ? "#9ca3af" // gray-400 - greyed out for unavailable dual pods
    : isDual
    ? "#0891b2"
    : COLORS.success;

  const isHorizontal = orientation === "horizontal";
  const width = isDual ? (isHorizontal ? 152 : 76) : 76;
  const height = isDual ? (isHorizontal ? 76 : 152) : 76;

  const getDisplayNumbers = () => {
    if (!isDual || !partner) return null;
    const num1 = parseInt(seat.number);
    const num2 = parseInt(partner.number);
    if (isHorizontal) {
      return { first: Math.min(num1, num2).toString().padStart(2, '0'), second: Math.max(num1, num2).toString().padStart(2, '0') };
    } else {
      const isRightSide = seat.side === "right";
      if (isRightSide) {
        return { first: Math.max(num1, num2).toString().padStart(2, '0'), second: Math.min(num1, num2).toString().padStart(2, '0') };
      } else {
        return { first: Math.min(num1, num2).toString().padStart(2, '0'), second: Math.max(num1, num2).toString().padStart(2, '0') };
      }
    }
  };
  const dualNumbers = getDisplayNumbers();

  // Check if this is a greyed-out dual pod (available but rules don't allow selection)
  const isGreyedOutDual = isDual && !canSelectDualPod && seat.status === "AVAILABLE" && partnerAvailable;

  const handleClick = () => {
    if (isAvailable) {
      onClick();
    } else if (isGreyedOutDual && onDisabledDualClick) {
      onDisabledDualClick();
    }
  };

  return (
    <button onClick={handleClick} disabled={!isAvailable && !isGreyedOutDual} style={{ width, height, borderRadius: 16, border: isSelected ? `4px solid ${COLORS.text}` : "none", background: bgColor, color: isAvailable ? COLORS.textOnPrimary : "rgba(255,255,255,0.7)", fontSize: "1.35rem", fontWeight: 700, cursor: isAvailable ? "pointer" : isGreyedOutDual ? "pointer" : "not-allowed", display: "flex", flexDirection: isHorizontal ? "row" : "column", alignItems: "center", justifyContent: "center", gap: isDual ? 8 : 0, transition: "all 0.2s", position: "relative" }}>
      {isDual && dualNumbers ? (
        <>
          <span style={{ fontSize: "1.35rem", fontWeight: 700 }}>{dualNumbers.first}</span>
          <span style={{ fontSize: "0.6rem", opacity: 0.9 }}>{statusText || "Dual"}</span>
          <span style={{ fontSize: "1.35rem", fontWeight: 700 }}>{dualNumbers.second}</span>
        </>
      ) : (
        <>
          <span>{seat.number}</span>
          {statusText && <span style={{ fontSize: "0.6rem", opacity: 0.9, marginTop: 2 }}>{statusText}</span>}
        </>
      )}
    </button>
  );
}
