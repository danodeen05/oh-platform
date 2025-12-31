"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QRScanner, parseKioskQR } from "@/components/kiosk";

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

// Brand component for consistent branding across kiosk screens
function KioskBrand({ size = "normal" }: { size?: "small" | "normal" | "large" | "xlarge" }) {
  const sizes = {
    small: { logo: 32, chinese: "1.2rem", english: "0.65rem", gap: 4 },
    normal: { logo: 48, chinese: "1.8rem", english: "0.95rem", gap: 6 },
    large: { logo: 96, chinese: "3.5rem", english: "1.8rem", gap: 10 },
    xlarge: { logo: 160, chinese: "5.6rem", english: "2.8rem", gap: 12 },
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
        className="kiosk-screen"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.surface,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Video Background - Exact 1920x1080 fit */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          className="kiosk-video-bg"
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
          {/* Main CTA - Start New Order - Touch optimized */}
          <button
            onClick={handleStartOrder}
            className="kiosk-btn kiosk-btn-primary"
            style={{
              padding: "32px 80px",
              borderRadius: 24,
              fontSize: "2rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              marginBottom: 28,
            }}
          >
            Tap to Start Your Order
          </button>

          {/* Secondary CTA - Online Order Check-in - Touch optimized */}
          <button
            onClick={handleScanQR}
            className="kiosk-btn"
            style={{
              padding: "20px 48px",
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: 16,
              border: `3px solid ${COLORS.primary}`,
              color: COLORS.primary,
              fontSize: "1.25rem",
              fontWeight: 600,
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: 14,
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
        className="kiosk-screen"
        style={{
          display: "flex",
          flexDirection: "column",
          background: COLORS.surface,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative Oh! mark on right side - 30% cut off */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: "-15%",
            transform: "translateY(-50%)",
            opacity: 0.08,
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <img
            src="/Oh_Logo_Mark_Web.png"
            alt=""
            style={{
              height: "90vh",
              width: "auto",
              objectFit: "contain",
            }}
          />
        </div>

        {/* Large Brand Header - top left */}
        <div style={{ position: "absolute", top: 48, left: 48, zIndex: 1 }}>
          <KioskBrand size="xlarge" />
        </div>

        {/* Centered content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <h1 className="kiosk-title" style={{ marginBottom: 12, textAlign: "center", color: COLORS.text, fontSize: "3.5rem" }}>
            How many guests today?
          </h1>
          <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 48, fontSize: "1.5rem" }}>
            Select your party size
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
              maxWidth: 800,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
              <button
                key={size}
                onClick={() => handlePartySelect(size)}
                className="kiosk-party-btn"
                style={{
                  border: `3px solid ${COLORS.primary}`,
                  background: COLORS.primaryLight,
                  color: COLORS.text,
                }}
              >
                {size}
                <span style={{ fontSize: "1rem", fontWeight: 400, marginTop: 4, color: COLORS.textMuted }}>
                  {size === 1 ? "guest" : "guests"}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={handleBackToWelcome}
            className="kiosk-btn"
            style={{
              marginTop: 48,
              background: COLORS.primary,
              color: COLORS.textOnPrimary,
            }}
          >
            Cancel
          </button>
        </div>
      </main>
    );
  }

  // Payment type selector (for parties of 2+)
  return (
    <main
      className="kiosk-screen"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.surface,
        padding: 48,
      }}
    >
      <h1 className="kiosk-title" style={{ marginBottom: 12, textAlign: "center", color: COLORS.text }}>
        How would you like to pay?
      </h1>
      <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 48 }}>
        Party of {partySize}
      </p>

      <div style={{ display: "flex", gap: 40, maxWidth: 900 }}>
        {/* One Check */}
        <button
          onClick={() => handlePaymentType("single")}
          className="kiosk-btn"
          style={{
            flex: 1,
            padding: 56,
            borderRadius: 28,
            border: `3px solid ${COLORS.primary}`,
            background: COLORS.primaryLight,
            color: COLORS.text,
            textAlign: "center",
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "5rem", marginBottom: 20, color: COLORS.primary, lineHeight: 1 }}>1</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 12 }}>
            One Check
          </div>
          <div style={{ fontSize: "1.125rem", color: COLORS.textMuted }}>
            Everyone orders, one person pays at the end
          </div>
        </button>

        {/* Separate Checks */}
        <button
          onClick={() => handlePaymentType("separate")}
          className="kiosk-btn"
          style={{
            flex: 1,
            padding: 56,
            borderRadius: 28,
            border: `3px solid ${COLORS.primary}`,
            background: COLORS.primaryLight,
            color: COLORS.text,
            textAlign: "center",
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "5rem", marginBottom: 20, color: COLORS.primary, lineHeight: 1 }}>{partySize}</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 12 }}>
            Separate Checks
          </div>
          <div style={{ fontSize: "1.125rem", color: COLORS.textMuted }}>
            Each person orders and pays individually
          </div>
        </button>
      </div>

      <button
        onClick={() => setStep("party-size")}
        className="kiosk-btn kiosk-btn-ghost"
        style={{ marginTop: 48 }}
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
  const [scannerActive, setScannerActive] = useState(true);

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

  // Handle QR scan result from camera
  function handleQRScan(data: string) {
    // Disable scanner to prevent multiple navigations
    setScannerActive(false);

    // Parse QR code data using helper
    const parsed = parseKioskQR(data);

    if (parsed.type === "order" && parsed.token) {
      router.push(`/kiosk/check-in?token=${parsed.token}&locationId=${location.id}`);
    } else if (parsed.type === "member" && parsed.id) {
      router.push(`/kiosk/check-in?memberId=${parsed.id}&locationId=${location.id}`);
    } else {
      // Unknown format - try as order number
      setOrderCode(data.toUpperCase());
      setShowManualEntry(true);
      setScannerActive(false);
    }
  }

  function handleScannerError(err: Error) {
    console.warn("QR Scanner error:", err);
    // Don't show error to user - manual entry is always available
  }

  return (
    <main
      className="kiosk-screen"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.surface,
        padding: 48,
      }}
    >
      <h1 className="kiosk-title" style={{ marginBottom: 12, textAlign: "center", color: COLORS.text }}>
        Check In Your Online Order
      </h1>
      <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 48, textAlign: "center" }}>
        Scan your order QR code or enter your order number
      </p>

      {/* Real QR Scanner with camera */}
      <QRScanner
        onScan={handleQRScan}
        onError={handleScannerError}
        active={scannerActive && !showManualEntry}
        width={360}
        height={360}
      />

      {/* Spacer */}
      <div style={{ height: 32 }} />

      {/* Manual entry toggle */}
      {!showManualEntry ? (
        <button
          onClick={() => {
            setShowManualEntry(true);
            setScannerActive(false);
          }}
          className="kiosk-btn kiosk-btn-secondary"
          style={{ marginBottom: 32 }}
        >
          Enter Order Number Manually
        </button>
      ) : (
        <div style={{ width: "100%", maxWidth: 480, marginBottom: 32 }}>
          <input
            type="text"
            value={orderCode}
            onChange={(e) => {
              setOrderCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Enter order number (e.g., ORD-1234...)"
            autoFocus
            className="kiosk-input"
            style={{
              border: `3px solid ${error ? "#ef4444" : COLORS.primary}`,
              letterSpacing: "0.05em",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLookup();
            }}
          />

          {error && (
            <p style={{ color: "#ef4444", marginTop: 12, textAlign: "center", fontSize: "1.125rem" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleLookup}
            disabled={!orderCode.trim() || loading}
            className="kiosk-btn kiosk-btn-primary"
            style={{
              width: "100%",
              marginTop: 20,
              background: orderCode.trim() && !loading ? COLORS.primary : "#ccc",
              cursor: orderCode.trim() && !loading ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Looking up..." : "Find My Order"}
          </button>

          <button
            onClick={() => {
              setShowManualEntry(false);
              setScannerActive(true);
              setOrderCode("");
              setError(null);
            }}
            className="kiosk-btn kiosk-btn-ghost"
            style={{ width: "100%", marginTop: 12 }}
          >
            Back to Scanner
          </button>
        </div>
      )}

      <button onClick={onBack} className="kiosk-btn kiosk-btn-ghost">
        Back
      </button>
    </main>
  );
}
