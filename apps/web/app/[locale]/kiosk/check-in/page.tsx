"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../kiosk.css";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Consistent kiosk color system
const COLORS = {
  primary: "#7C7A67",
  primaryLight: "rgba(124, 122, 103, 0.15)",
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
  location?: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    menuItem: {
      name: string;
    };
  }>;
  user?: {
    name?: string;
    membershipTier?: string;
  };
};

export default function CheckInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const locationId = searchParams.get("locationId");

  const [order, setOrder] = useState<Order | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInComplete, setCheckInComplete] = useState(false);
  const [assignedSeat, setAssignedSeat] = useState<Seat | null>(null);

  // Load order and seats
  useEffect(() => {
    async function loadData() {
      if (!orderId || !locationId) {
        setError("Missing order or location information");
        setLoading(false);
        return;
      }

      try {
        const [orderRes, seatsRes] = await Promise.all([
          fetch(`${BASE}/orders/${orderId}`, {
            headers: { "x-tenant-slug": "oh" },
          }),
          fetch(`${BASE}/locations/${locationId}/seats`, {
            headers: { "x-tenant-slug": "oh" },
          }),
        ]);

        if (!orderRes.ok) {
          setError("Order not found");
          setLoading(false);
          return;
        }

        const orderData = await orderRes.json();
        setOrder(orderData);

        // Pre-select pod if already assigned
        if (orderData.seatId) {
          setSelectedPodId(orderData.seatId);
        }

        if (seatsRes.ok) {
          const seatsData = await seatsRes.json();
          setSeats(seatsData);
        }

        setLoading(false);
      } catch (err) {
        setError("Failed to load order details");
        setLoading(false);
      }
    }

    loadData();
  }, [orderId, locationId]);

  async function handleCheckIn() {
    if (!order || !selectedPodId) return;

    setCheckingIn(true);

    try {
      // Call check-in endpoint
      const response = await fetch(`${BASE}/orders/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderQrCode: order.orderQrCode,
          locationId,
          selectedSeatId: selectedPodId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Check-in failed");
      }

      const result = await response.json();

      // Find the assigned seat
      const seat = seats.find((s) => s.id === (result.order?.seatId || selectedPodId));
      setAssignedSeat(seat || null);
      setCheckInComplete(true);
    } catch (err: any) {
      setError(err.message || "Check-in failed. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  }

  function handleBackToHome() {
    router.push("/kiosk");
  }

  if (loading) {
    return (
      <main
        className="kiosk-screen"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.surface,
          color: COLORS.text,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: 16, color: COLORS.primary }}>Oh!</div>
          <div className="kiosk-body" style={{ color: COLORS.textMuted }}>Loading your order...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        className="kiosk-screen"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.surface,
          color: COLORS.text,
          padding: 48,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            background: "rgba(239, 68, 68, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke={COLORS.error} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="kiosk-subtitle" style={{ marginBottom: 12 }}>Oops!</h1>
        <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 40, textAlign: "center" }}>{error}</p>
        <button onClick={handleBackToHome} className="kiosk-btn kiosk-btn-primary">
          Back to Home
        </button>
      </main>
    );
  }

  if (checkInComplete) {
    return (
      <main
        className="kiosk-screen"
        style={{
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
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            background: COLORS.successLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h1 className="kiosk-title" style={{ marginBottom: 16 }}>
          Welcome Back!
        </h1>
        <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 8 }}>
          {order?.user?.name || order?.guestName || "Guest"}
        </p>

        {assignedSeat && (
          <div
            style={{
              background: COLORS.primary,
              borderRadius: 24,
              padding: "40px 64px",
              marginTop: 40,
              marginBottom: 40,
              color: COLORS.textOnPrimary,
            }}
          >
            <div style={{ fontSize: "1.125rem", opacity: 0.85, marginBottom: 12 }}>
              Please proceed to
            </div>
            <div style={{ fontSize: "5rem", fontWeight: 700, lineHeight: 1 }}>Pod {assignedSeat.number}</div>
          </div>
        )}

        <div
          style={{
            background: COLORS.surfaceElevated,
            borderRadius: 20,
            padding: 28,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 40,
            minWidth: 320,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: "1.25rem" }}>Order #{order?.orderNumber}</div>
          <div style={{ color: COLORS.textMuted, fontSize: "1.125rem" }}>
            {order?.items.map((item) => (
              <div key={item.id}>
                {item.quantity}x {item.menuItem.name}
              </div>
            ))}
          </div>
        </div>

        <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 40 }}>
          Your food is being prepared and will arrive at your pod shortly.
        </p>

        <button onClick={handleBackToHome} className="kiosk-btn kiosk-btn-primary">
          Done
        </button>
      </main>
    );
  }

  // Pod selection for check-in
  const availableSeats = seats.filter((s) => s.status === "AVAILABLE");
  const recommendedPods = availableSeats.slice(0, 3);

  // Group seats by side for U-shape layout
  const leftSeats = seats.filter((s) => s.side === "left").sort((a, b) => a.col - b.col);
  const bottomSeats = seats.filter((s) => s.side === "bottom").sort((a, b) => a.col - b.col);
  const rightSeats = seats.filter((s) => s.side === "right").sort((a, b) => a.col - b.col);

  const selectedSeat = seats.find((s) => s.id === selectedPodId);

  return (
    <main
      className="kiosk-screen kiosk-scroll"
      style={{
        background: COLORS.surface,
        color: COLORS.text,
        padding: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h1 className="kiosk-title" style={{ marginBottom: 12 }}>
        Welcome, {order?.user?.name || order?.guestName || "Guest"}!
      </h1>
      <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 8 }}>
        Order #{order?.orderNumber}
      </p>
      {order?.user?.membershipTier && (
        <div
          style={{
            padding: "6px 16px",
            background: COLORS.primaryLight,
            borderRadius: 20,
            fontSize: "0.85rem",
            fontWeight: 600,
            color: COLORS.primary,
            marginBottom: 32,
          }}
        >
          {order.user.membershipTier} Member
        </div>
      )}

      <p style={{ color: COLORS.text, marginBottom: 32, fontSize: "1.1rem" }}>
        Select your pod to complete check-in
      </p>

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
            onClick={() => setSelectedPodId(recommendedPods[0].id)}
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

      {/* Pod Map */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div style={{ color: COLORS.textMuted, fontSize: "0.85rem" }}>Kitchen</div>

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {leftSeats.map((seat) => (
              <PodButton
                key={seat.id}
                seat={seat}
                isSelected={selectedPodId === seat.id}
                isRecommended={recommendedPods.some((r) => r.id === seat.id)}
                onClick={() => setSelectedPodId(seat.id)}
              />
            ))}
          </div>

          {/* Bottom Row */}
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
                isRecommended={recommendedPods.some((r) => r.id === seat.id)}
                onClick={() => setSelectedPodId(seat.id)}
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
                isRecommended={recommendedPods.some((r) => r.id === seat.id)}
                onClick={() => setSelectedPodId(seat.id)}
              />
            ))}
          </div>
        </div>

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
      <div style={{ display: "flex", gap: 20 }}>
        <button onClick={handleBackToHome} className="kiosk-btn kiosk-btn-ghost">
          Cancel
        </button>
        <button
          onClick={handleCheckIn}
          disabled={!selectedPodId || checkingIn}
          className="kiosk-btn kiosk-btn-primary"
          style={{
            background: selectedPodId && !checkingIn ? COLORS.success : "#ccc",
            cursor: selectedPodId && !checkingIn ? "pointer" : "not-allowed",
          }}
        >
          {checkingIn ? "Checking In..." : "Check In"}
        </button>
      </div>
    </main>
  );
}

function PodButton({
  seat,
  isSelected,
  isRecommended,
  onClick,
}: {
  seat: Seat;
  isSelected: boolean;
  isRecommended: boolean;
  onClick: () => void;
}) {
  const isAvailable = seat.status === "AVAILABLE";
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
      className="kiosk-pod-btn"
      style={{
        border: isSelected ? `4px solid ${COLORS.text}` : "none",
        background: bgColor,
        color: isAvailable ? COLORS.textOnPrimary : "rgba(255,255,255,0.7)",
        cursor: isAvailable ? "pointer" : "not-allowed",
        position: "relative",
      }}
    >
      {seat.number}
      {seat.podType === "DUAL" && (
        <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>DUAL</span>
      )}
      {isRecommended && !isSelected && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            borderRadius: 10,
            background: COLORS.warning,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "0.7rem", color: COLORS.text }}>★</span>
        </div>
      )}
    </button>
  );
}
