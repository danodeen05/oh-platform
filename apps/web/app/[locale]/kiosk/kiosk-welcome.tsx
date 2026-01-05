"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { QRScanner, parseKioskQR, LanguageSelector, AnimatedOrderQR, useKioskMode, useKioskScale } from "@/components/kiosk";

// Welcome messages in different languages for cycling animation
const WELCOME_MESSAGES = [
  { text: "Welcome to", lang: "en" },
  { text: "Bienvenidos a", lang: "es" },
  { text: "欢迎光临", lang: "zh-CN" },
  { text: "歡迎光臨", lang: "zh-TW" },
];

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
  const tHome = useTranslations("home");
  const { s: scale } = useKioskScale();
  // Base sizes for 720p, scales up for 1080p
  const sizes = {
    small: { logo: scale(22), chinese: `${0.8 * (scale(10) / 10)}rem`, english: `${0.45 * (scale(10) / 10)}rem`, gap: scale(3) },
    normal: { logo: scale(32), chinese: `${1.2 * (scale(10) / 10)}rem`, english: `${0.65 * (scale(10) / 10)}rem`, gap: scale(4) },
    large: { logo: scale(64), chinese: `${2.3 * (scale(10) / 10)}rem`, english: `${1.2 * (scale(10) / 10)}rem`, gap: scale(7) },
    xlarge: { logo: scale(107), chinese: `${3.7 * (scale(10) / 10)}rem`, english: `${1.9 * (scale(10) / 10)}rem`, gap: scale(8) },
  };
  const sz = sizes[size];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: sz.gap }}>
      <img
        src="/Oh_Logo_Large.png"
        alt="Oh! Logo"
        style={{ width: sz.logo, height: sz.logo, objectFit: "contain" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: scale(3), fontSize: sz.english, lineHeight: 1 }}>
        {tHome.rich("brandName", {
          oh: () => (
            <span
              style={{
                fontFamily: '"Ma Shan Zheng", cursive',
                fontSize: sz.chinese,
                color: "#C7A878",
              }}
            >
              哦
            </span>
          ),
          bebas: (chunks) => (
            <span
              style={{
                fontFamily: '"Bebas Neue", sans-serif',
                color: COLORS.text,
                letterSpacing: "0.02em",
              }}
            >
              {chunks}
            </span>
          ),
        })}
      </div>
    </div>
  );
}

export default function KioskWelcome({ location }: { location: Location }) {
  const router = useRouter();
  const t = useTranslations("kiosk");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const locale = useLocale();
  const [step, setStep] = useState<"welcome" | "party-size" | "payment-type" | "scan-qr">("welcome");
  const [partySize, setPartySize] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { isFullscreen, isSupported, toggleFullscreen, exitFullscreen, enterFullscreen } = useKioskMode();
  const { s: scale, rem } = useKioskScale();

  // Triple-tap detection for exiting fullscreen
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretTap = useCallback(() => {
    tapCountRef.current += 1;

    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    // If we hit 3 taps, exit fullscreen
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      exitFullscreen();
      return;
    }

    // Reset tap count after 1 second of no taps
    tapTimeoutRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1000);
  }, [exitFullscreen]);

  // Cycle through welcome messages
  useEffect(() => {
    if (step !== "welcome") return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setWelcomeIndex((prev) => (prev + 1) % WELCOME_MESSAGES.length);
        setIsTransitioning(false);
      }, 500); // Half of transition duration
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [step]);

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
        onClick={handleStartOrder}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.surface,
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        {/* Hidden triple-tap zone in top-right corner to exit fullscreen (for staff) */}
        {isFullscreen && (
          <div
            onClick={(e) => { e.stopPropagation(); handleSecretTap(); }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 100,
              height: 100,
              zIndex: 9999,
              background: "transparent",
              cursor: "default",
            }}
            aria-hidden="true"
          />
        )}

        {/* Animated Welcome Title */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "22%",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 70%, transparent 100%)",
            zIndex: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 52,
          }}
        >
          {/* Cycling welcome text */}
          <div
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: rem(1.7),
              color: COLORS.textMuted,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              opacity: isTransitioning ? 0 : 1,
              transform: isTransitioning ? "translateY(-10px)" : "translateY(0)",
              transition: "all 0.5s ease-in-out",
            }}
          >
            {WELCOME_MESSAGES[welcomeIndex].text}
          </div>
          {/* Restaurant name - always visible */}
          <div
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: rem(3),
              color: COLORS.text,
              letterSpacing: "0.08em",
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: "title-glow 3s ease-in-out infinite",
            }}
          >
            {tHome.rich("brandName", {
              oh: () => (
                <span style={{ color: "#C7A878", fontFamily: '"Ma Shan Zheng", cursive', fontSize: "1.1em" }}>
                  哦
                </span>
              ),
              bebas: (chunks) => (
                <span style={{ fontFamily: '"Bebas Neue", sans-serif' }}>
                  {chunks}
                </span>
              ),
            })}
          </div>
        </div>

        {/* Video Background - adjusted to fit below title */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          className="kiosk-video-bg"
          style={{ top: "calc(14% - 20px)", height: "86%" }}
        >
          <source src="/kiosk-video.mp4" type="video/mp4" />
        </video>

        {/* Floating Particles - in front of video, behind buttons */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
          {/* Edge particles */}
          <div
            className="kiosk-particle"
            style={{ width: 12, height: 12, top: "15%", left: "10%", animationDelay: "0s", animationDuration: "10s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 8, height: 8, top: "25%", left: "85%", animationDelay: "2s", animationDuration: "12s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 16, height: 16, top: "60%", left: "5%", animationDelay: "1s", animationDuration: "9s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 10, height: 10, top: "40%", left: "90%", animationDelay: "3s", animationDuration: "11s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 14, height: 14, top: "70%", left: "15%", animationDelay: "4s", animationDuration: "8s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 6, height: 6, top: "20%", left: "75%", animationDelay: "2.5s", animationDuration: "13s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 18, height: 18, top: "50%", left: "92%", animationDelay: "1.5s", animationDuration: "10s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 8, height: 8, top: "80%", left: "80%", animationDelay: "3.5s", animationDuration: "14s" }}
          />
          {/* Center area particles */}
          <div
            className="kiosk-particle"
            style={{ width: 14, height: 14, top: "30%", left: "35%", animationDelay: "0.5s", animationDuration: "11s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 10, height: 10, top: "45%", left: "55%", animationDelay: "2.5s", animationDuration: "9s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 16, height: 16, top: "35%", left: "65%", animationDelay: "4s", animationDuration: "12s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 12, height: 12, top: "55%", left: "40%", animationDelay: "1s", animationDuration: "10s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 8, height: 8, top: "25%", left: "50%", animationDelay: "3s", animationDuration: "13s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 18, height: 18, top: "65%", left: "60%", animationDelay: "5s", animationDuration: "11s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 10, height: 10, top: "40%", left: "30%", animationDelay: "1.5s", animationDuration: "14s" }}
          />
          <div
            className="kiosk-particle"
            style={{ width: 14, height: 14, top: "50%", left: "70%", animationDelay: "3.5s", animationDuration: "10s" }}
          />
        </div>

        {/* Rising Steam Effects - across the bottom */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", overflow: "hidden" }}>
          {/* Left steam column */}
          <div className="kiosk-steam" style={{ left: "3%", animationDelay: "0s" }} />
          <div className="kiosk-steam" style={{ left: "8%", animationDelay: "1.5s" }} />
          <div className="kiosk-steam" style={{ left: "13%", animationDelay: "3s" }} />
          <div className="kiosk-steam" style={{ left: "6%", animationDelay: "4.5s" }} />
          <div className="kiosk-steam" style={{ left: "10%", animationDelay: "6s" }} />

          {/* Center steam */}
          <div className="kiosk-steam" style={{ left: "25%", animationDelay: "0.8s" }} />
          <div className="kiosk-steam" style={{ left: "35%", animationDelay: "2.3s" }} />
          <div className="kiosk-steam" style={{ left: "45%", animationDelay: "4.2s" }} />
          <div className="kiosk-steam" style={{ left: "55%", animationDelay: "1.2s" }} />
          <div className="kiosk-steam" style={{ left: "65%", animationDelay: "3.7s" }} />
          <div className="kiosk-steam" style={{ left: "75%", animationDelay: "5.5s" }} />

          {/* Right steam column */}
          <div className="kiosk-steam" style={{ right: "3%", left: "auto", animationDelay: "0.5s" }} />
          <div className="kiosk-steam" style={{ right: "8%", left: "auto", animationDelay: "2s" }} />
          <div className="kiosk-steam" style={{ right: "13%", left: "auto", animationDelay: "3.5s" }} />
          <div className="kiosk-steam" style={{ right: "6%", left: "auto", animationDelay: "5s" }} />
          <div className="kiosk-steam" style={{ right: "10%", left: "auto", animationDelay: "6.5s" }} />
        </div>

        {/* Content Overlay - above particles/steam */}
        <div
          style={{
            position: "relative",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            minHeight: "100vh",
            paddingBottom: 1,
            width: "100%",
          }}
        >
          {/* Language Selector - vertically centered on the left */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "50%",
              left: 48,
              transform: "translateY(-50%)",
            }}
          >
            <LanguageSelector variant="prominent" />
          </div>

          {/* CTA Buttons - Side by side with glow effect */}
          <div
            style={{
              position: "relative",
              display: "flex",
              gap: 20,
              alignItems: "center",
            }}
          >
            {/* Pulsing glow behind buttons */}
            <div
              className="kiosk-glow"
              style={{
                position: "absolute",
                top: -34,
                left: -50,
                right: -50,
                bottom: -34,
                zIndex: 0,
              }}
            />

            {/* Main CTA - Start New Order */}
            <button
              onClick={handleStartOrder}
              className="kiosk-btn kiosk-btn-primary"
              style={{
                position: "relative",
                padding: `${scale(20)}px ${scale(36)}px`,
                borderRadius: scale(16),
                fontSize: rem(1.3),
                border: `${scale(2)}px solid ${COLORS.primary}`,
                boxShadow: "0 6px 24px rgba(0,0,0,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: scale(12),
                overflow: "hidden",
                zIndex: 1,
                width: scale(437),
                height: scale(72),
              }}
            >
              {/* Shimmer effect */}
              <div className="kiosk-shimmer" />
              {/* Animated tap/hand icon */}
              <svg
                width={scale(24)}
                height={scale(24)}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: "tap-bounce 1.2s ease-in-out infinite",
                  flexShrink: 0,
                }}
              >
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
              </svg>
              {t("welcome.tapToStart")}
            </button>

            {/* Secondary CTA - Online Order Check-in */}
            <button
              onClick={(e) => { e.stopPropagation(); handleScanQR(); }}
              className="kiosk-btn"
              style={{
                position: "relative",
                padding: `${scale(20)}px ${scale(36)}px`,
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: scale(16),
                border: `${scale(2)}px solid ${COLORS.primary}`,
                color: COLORS.primary,
                fontSize: rem(1.3),
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: scale(12),
                overflow: "hidden",
                zIndex: 1,
                width: scale(437),
                height: scale(72),
              }}
            >
              {/* Shimmer effect */}
              <div className="kiosk-shimmer" style={{ animationDelay: "1.5s" }} />
              {/* Animated QR code icon */}
              <svg
                width={scale(24)}
                height={scale(24)}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: "qr-scan 2s ease-in-out infinite",
                  flexShrink: 0,
                }}
              >
                {/* Top-left QR block */}
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="5" y="5" width="3" height="3" fill="currentColor" />
                {/* Top-right QR block */}
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="16" y="5" width="3" height="3" fill="currentColor" />
                {/* Bottom-left QR block */}
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="5" y="16" width="3" height="3" fill="currentColor" />
                {/* Bottom-right data area */}
                <rect x="14" y="14" width="3" height="3" />
                <rect x="18" y="14" width="3" height="3" />
                <rect x="14" y="18" width="3" height="3" />
                <rect x="18" y="18" width="3" height="3" />
              </svg>
              {t("welcome.onlineCheckIn")}
            </button>
          </div>

          {/* Location indicator */}
          <div
            style={{
              marginTop: 6,
              color: COLORS.textMuted,
              fontSize: "0.9rem",
              background: "rgba(255,255,255,0.9)",
              padding: "8px 20px",
              borderRadius: 20,
            }}
          >
            {location.name}
          </div>

          {/* QR Code for online ordering - vertically centered on the right */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "50%",
              right: 48,
              transform: "translateY(-50%)",
            }}
          >
            <AnimatedOrderQR
              locationId={location.id}
              size={184}
              showVideo={true}
            />
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
            {t("welcome.howManyGuests")}
          </h1>
          <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 48, fontSize: "1.5rem" }}>
            {t("welcome.selectPartySize")}
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
                  {size === 1 ? t("welcome.guest") : t("welcome.guests")}
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
            {tCommon("cancel")}
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
        {t("payment.howToPay")}
      </h1>
      <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 48 }}>
        {t("payment.partyOf", { size: partySize })}
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
            {t("payment.oneCheck")}
          </div>
          <div style={{ fontSize: "1.125rem", color: COLORS.textMuted }}>
            {t("payment.oneCheckDescription")}
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
            {t("payment.separateChecks")}
          </div>
          <div style={{ fontSize: "1.125rem", color: COLORS.textMuted }}>
            {t("payment.separateChecksDescription")}
          </div>
        </button>
      </div>

      <button
        onClick={() => setStep("party-size")}
        className="kiosk-btn kiosk-btn-ghost"
        style={{ marginTop: 48 }}
      >
        {tCommon("back")}
      </button>
    </main>
  );
}

// QR Scan / Order Lookup Component
function QRScanView({ location, onBack }: { location: Location; onBack: () => void }) {
  const router = useRouter();
  const t = useTranslations("kiosk");
  const tCommon = useTranslations("common");
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
          setError(t("checkIn.orderNotFound"));
        } else {
          setError(t("checkIn.somethingWrong"));
        }
        return;
      }

      const order = await res.json();

      // Navigate to check-in flow with the order
      router.push(`/kiosk/check-in?orderId=${order.id}&locationId=${location.id}`);
    } catch (err) {
      setError(t("checkIn.unableToConnect"));
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

      {/* Large Camera indicator banner at top - where the actual camera is */}
      {!showManualEntry && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "24px 0 32px",
            background: "linear-gradient(to bottom, rgba(124, 122, 103, 0.12) 0%, rgba(124, 122, 103, 0.05) 70%, transparent 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            zIndex: 10,
          }}
        >
          {/* Multiple animated up arrows */}
          <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.primary}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: "arrow-bounce-up 1s ease-in-out infinite" }}
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.primary}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: "arrow-bounce-up 1s ease-in-out infinite", animationDelay: "0.15s" }}
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.primary}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: "arrow-bounce-up 1s ease-in-out infinite", animationDelay: "0.3s" }}
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>

          {/* Camera icon with pulsing glow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 32px",
              background: COLORS.primaryLight,
              borderRadius: 20,
              animation: "camera-pulse 2s ease-in-out infinite",
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                color: COLORS.primary,
                letterSpacing: "0.05em",
                fontFamily: '"Bebas Neue", sans-serif',
              }}
            >
              CAMERA
            </span>
          </div>
        </div>
      )}

      {/* Spacer to push content down when camera indicator is shown */}
      {!showManualEntry && <div style={{ height: 100 }} />}

      {/* Oh! Character Logo - larger */}
      <img
        src="/Oh_Logo_Mark_Web.png"
        alt="Oh!"
        style={{
          width: 220,
          height: 220,
          objectFit: "contain",
          marginBottom: 16,
          zIndex: 1,
        }}
      />

      <h1
        className="kiosk-title"
        style={{
          marginBottom: 16,
          textAlign: "center",
          color: COLORS.text,
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: "3rem",
          letterSpacing: "0.05em",
          zIndex: 1,
        }}
      >
        Online Order Check-In
      </h1>
      <p
        className="kiosk-body"
        style={{
          color: COLORS.textMuted,
          marginBottom: 40,
          textAlign: "center",
          maxWidth: 600,
          lineHeight: 1.5,
        }}
      >
        Scan your member QR code or order QR code
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
          {t("checkIn.manualEntry")}
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
            placeholder={t("checkIn.placeholder")}
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
            {loading ? t("checkIn.lookingUp") : t("checkIn.findOrder")}
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
            {t("checkIn.backToScanner")}
          </button>
        </div>
      )}

      <button onClick={onBack} className="kiosk-btn kiosk-btn-ghost" style={{ zIndex: 1 }}>
        {tCommon("back")}
      </button>
    </main>
  );
}
