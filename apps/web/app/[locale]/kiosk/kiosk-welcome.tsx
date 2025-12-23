"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Location = {
  id: string;
  name: string;
  address: string;
  tenantId: string;
};

// Kiosk color system for consistency
const COLORS = {
  primary: "#7C7A67",
  primaryLight: "rgba(124, 122, 103, 0.15)",
  primaryBorder: "rgba(124, 122, 103, 0.4)",
  surface: "#FFFFFF",
  surfaceDark: "#1a1a1a",
  text: "#1a1a1a",
  textLight: "#666666",
  textMuted: "#999999",
  textOnPrimary: "#FFFFFF",
  success: "#22c55e",
  border: "#e5e5e5",
  borderDark: "#333333",
};

export default function KioskWelcome({ location }: { location: Location }) {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "party-size" | "payment-type" | "scan-qr">("welcome");
  const [partySize, setPartySize] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle video end - pause for 12 seconds on last frame, then restart
  const handleVideoEnded = useCallback(() => {
    setIsPaused(true);
    pauseTimeoutRef.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        setIsPaused(false);
      }
    }, 12000); // 12 second pause on last frame
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  function handleStartOrder() {
    // Cancel any pending video restart
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    setStep("party-size");
  }

  function handleScanQR() {
    // Cancel any pending video restart
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    setStep("scan-qr");
  }

  function handlePartySelect(size: number) {
    setPartySize(size);
    if (size === 1) {
      // Single person goes straight to ordering
      router.push(`/kiosk/order?locationId=${location.id}&partySize=1&paymentType=single`);
    } else {
      // Multiple people need to choose payment type
      setStep("payment-type");
    }
  }

  function handlePaymentType(type: "single" | "separate") {
    router.push(`/kiosk/order?locationId=${location.id}&partySize=${partySize}&paymentType=${type}`);
  }

  function handleBackToWelcome() {
    setStep("welcome");
    // Restart video if it was paused
    if (videoRef.current && isPaused) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPaused(false);
    }
  }

  // Welcome screen with video background
  if (step === "welcome") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.surface,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Video Background - Full Screen */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            minWidth: "100%",
            minHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "cover",
            zIndex: 0,
          }}
        >
          <source src="/kiosk-video.mp4" type="video/mp4" />
        </video>

        {/* Content Overlay */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            minHeight: "100vh",
            paddingBottom: 80,
            width: "100%",
          }}
        >
          {/* Main CTA - Start New Order */}
          <button
            onClick={handleStartOrder}
            style={{
              padding: "28px 72px",
              background: COLORS.primary,
              borderRadius: 20,
              border: "none",
              color: COLORS.textOnPrimary,
              fontSize: "1.75rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              marginBottom: 24,
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            Tap to Start Your Order
          </button>

          {/* Secondary CTA - Online Order Check-in */}
          <button
            onClick={handleScanQR}
            style={{
              padding: "16px 40px",
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: 14,
              border: `2px solid ${COLORS.primary}`,
              color: COLORS.primary,
              fontSize: "1.1rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              transition: "transform 0.2s",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            I Ordered Online - Check In
          </button>

          {/* Location indicator */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              color: COLORS.textMuted,
              fontSize: "0.9rem",
              background: "rgba(255,255,255,0.9)",
              padding: "8px 20px",
              borderRadius: 20,
            }}
          >
            {location.name}
          </div>
        </div>
      </main>
    );
  }

  // QR Scan / Order Lookup screen
  if (step === "scan-qr") {
    return <QRScanView location={location} onBack={handleBackToWelcome} />;
  }

  // Party size selector
  if (step === "party-size") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.surface,
          padding: 48,
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            marginBottom: 12,
            textAlign: "center",
            color: COLORS.text,
          }}
        >
          How many guests today?
        </h1>
        <p style={{ fontSize: "1.25rem", color: COLORS.textMuted, marginBottom: 48 }}>
          Select your party size
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            maxWidth: 720,
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
            <button
              key={size}
              onClick={() => handlePartySelect(size)}
              style={{
                width: 130,
                height: 130,
                borderRadius: 20,
                border: `3px solid ${COLORS.primary}`,
                background: COLORS.primaryLight,
                color: COLORS.text,
                fontSize: "2.75rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {size}
              <span style={{ fontSize: "0.85rem", fontWeight: 400, marginTop: 2, color: COLORS.textMuted }}>
                {size === 1 ? "guest" : "guests"}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={handleBackToWelcome}
          style={{
            marginTop: 48,
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
      </main>
    );
  }

  // Payment type selector (for parties of 2+)
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.surface,
        padding: 48,
      }}
    >
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: 700,
          marginBottom: 12,
          textAlign: "center",
          color: COLORS.text,
        }}
      >
        How would you like to pay?
      </h1>
      <p style={{ fontSize: "1.25rem", color: COLORS.textMuted, marginBottom: 48 }}>
        Party of {partySize}
      </p>

      <div style={{ display: "flex", gap: 32, maxWidth: 800 }}>
        {/* One Check */}
        <button
          onClick={() => handlePaymentType("single")}
          style={{
            flex: 1,
            padding: 48,
            borderRadius: 24,
            border: `3px solid ${COLORS.primary}`,
            background: COLORS.primaryLight,
            color: COLORS.text,
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "4rem", marginBottom: 16, color: COLORS.primary }}>1</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
            One Check
          </div>
          <div style={{ fontSize: "1rem", color: COLORS.textMuted }}>
            Everyone orders, one person pays at the end
          </div>
        </button>

        {/* Separate Checks */}
        <button
          onClick={() => handlePaymentType("separate")}
          style={{
            flex: 1,
            padding: 48,
            borderRadius: 24,
            border: `3px solid ${COLORS.primary}`,
            background: COLORS.primaryLight,
            color: COLORS.text,
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "4rem", marginBottom: 16, color: COLORS.primary }}>{partySize}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
            Separate Checks
          </div>
          <div style={{ fontSize: "1rem", color: COLORS.textMuted }}>
            Each person orders and pays individually
          </div>
        </button>
      </div>

      <button
        onClick={() => setStep("party-size")}
        style={{
          marginTop: 48,
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
    </main>
  );
}

// QR Scan / Order Lookup Component
function QRScanView({ location, onBack }: { location: Location; onBack: () => void }) {
  const router = useRouter();
  const [orderCode, setOrderCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  async function handleLookup() {
    if (!orderCode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_URL}/orders/lookup?code=${encodeURIComponent(orderCode.trim())}`, {
        headers: { "x-tenant-slug": "oh" },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError("Order not found. Please check your order number.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      const order = await res.json();

      // Navigate to check-in flow with the order
      router.push(`/kiosk/check-in?orderId=${order.id}&locationId=${location.id}`);
    } catch (err) {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.surface,
        padding: 48,
      }}
    >
      <h1
        style={{
          fontSize: "2.25rem",
          fontWeight: 700,
          marginBottom: 12,
          textAlign: "center",
          color: COLORS.text,
        }}
      >
        Check In Your Online Order
      </h1>
      <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, marginBottom: 48, textAlign: "center" }}>
        Scan your order QR code or enter your order number
      </p>

      {/* QR Scanner Placeholder */}
      <div
        style={{
          width: 320,
          height: 320,
          background: COLORS.surfaceDark,
          borderRadius: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Scanner frame corners */}
        <div style={{ position: "absolute", top: 20, left: 20, width: 40, height: 40, borderTop: `4px solid ${COLORS.primary}`, borderLeft: `4px solid ${COLORS.primary}`, borderRadius: "8px 0 0 0" }} />
        <div style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderTop: `4px solid ${COLORS.primary}`, borderRight: `4px solid ${COLORS.primary}`, borderRadius: "0 8px 0 0" }} />
        <div style={{ position: "absolute", bottom: 20, left: 20, width: 40, height: 40, borderBottom: `4px solid ${COLORS.primary}`, borderLeft: `4px solid ${COLORS.primary}`, borderRadius: "0 0 0 8px" }} />
        <div style={{ position: "absolute", bottom: 20, right: 20, width: 40, height: 40, borderBottom: `4px solid ${COLORS.primary}`, borderRight: `4px solid ${COLORS.primary}`, borderRadius: "0 0 8px 0" }} />

        {/* Scanning animation line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 40,
            right: 40,
            height: 2,
            background: COLORS.primary,
            animation: "scanLine 2s ease-in-out infinite",
          }}
        />

        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3" />
          <path d="M17 17h3v3" />
          <path d="M14 20v-3h3" />
        </svg>
        <p style={{ color: COLORS.textMuted, marginTop: 16, fontSize: "0.95rem" }}>
          Position QR code in frame
        </p>
      </div>

      {/* Manual entry toggle */}
      {!showManualEntry ? (
        <button
          onClick={() => setShowManualEntry(true)}
          style={{
            padding: "12px 24px",
            background: "transparent",
            border: `2px solid ${COLORS.border}`,
            borderRadius: 10,
            color: COLORS.textMuted,
            fontSize: "1rem",
            cursor: "pointer",
            marginBottom: 32,
          }}
        >
          Enter Order Number Manually
        </button>
      ) : (
        <div style={{ width: "100%", maxWidth: 400, marginBottom: 32 }}>
          <input
            type="text"
            value={orderCode}
            onChange={(e) => {
              setOrderCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Enter order number (e.g., ORD-1234...)"
            autoFocus
            style={{
              width: "100%",
              padding: "18px 24px",
              fontSize: "1.25rem",
              border: `2px solid ${error ? "#ef4444" : COLORS.primary}`,
              borderRadius: 14,
              background: COLORS.surface,
              color: COLORS.text,
              textAlign: "center",
              letterSpacing: "0.05em",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLookup();
            }}
          />

          {error && (
            <p style={{ color: "#ef4444", marginTop: 12, textAlign: "center", fontSize: "0.95rem" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleLookup}
            disabled={!orderCode.trim() || loading}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "16px 32px",
              background: orderCode.trim() && !loading ? COLORS.primary : "#ccc",
              border: "none",
              borderRadius: 12,
              color: COLORS.textOnPrimary,
              fontSize: "1.1rem",
              fontWeight: 600,
              cursor: orderCode.trim() && !loading ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Looking up..." : "Find My Order"}
          </button>
        </div>
      )}

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

      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 40px; opacity: 1; }
          50% { top: 280px; opacity: 0.5; }
        }
      `}</style>
    </main>
  );
}
