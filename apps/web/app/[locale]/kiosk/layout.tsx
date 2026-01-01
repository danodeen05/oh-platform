"use client";
import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import "./kiosk.css";
import { IdleTimer } from "@/components/kiosk";

// Default staff PIN - in production this would come from environment/config
const STAFF_PIN = process.env.NEXT_PUBLIC_KIOSK_STAFF_PIN || "1234";

export default function KioskLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const t = useTranslations("kiosk");
  const tCommon = useTranslations("common");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [lastTap, setLastTap] = useState(0);

  // Triple-tap in corner to show PIN modal
  function handleCornerTap() {
    const now = Date.now();
    if (now - lastTap < 500) {
      setTapCount((prev) => prev + 1);
    } else {
      setTapCount(1);
    }
    setLastTap(now);
  }

  useEffect(() => {
    if (tapCount >= 3) {
      setShowPinModal(true);
      setTapCount(0);
      setPinInput("");
      setPinError(false);
    }
  }, [tapCount]);

  function handlePinSubmit() {
    if (pinInput === STAFF_PIN) {
      setShowPinModal(false);
      // Exit kiosk mode - navigate to home
      router.push("/");
    } else {
      setPinError(true);
      setPinInput("");
      // Clear error after 2 seconds
      setTimeout(() => setPinError(false), 2000);
    }
  }

  function handlePinKey(key: string) {
    if (key === "clear") {
      setPinInput("");
      setPinError(false);
    } else if (key === "back") {
      setPinInput((prev) => prev.slice(0, -1));
      setPinError(false);
    } else if (pinInput.length < 6) {
      const newPin = pinInput + key;
      setPinInput(newPin);
      setPinError(false);
      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        setTimeout(() => {
          if (newPin === STAFF_PIN) {
            setShowPinModal(false);
            router.push("/");
          } else {
            setPinError(true);
            setPinInput("");
          }
        }, 200);
      }
    }
  }

  return (
    <div className="kiosk-container kiosk-no-select" style={{ position: "relative" }}>
      {/* Idle Timer - auto-return to attract screen after 60s inactivity, reset to English */}
      <IdleTimer timeout={60000} redirectPath="/en/kiosk" showWarning />

      {/* Hidden exit button - triple tap to reveal */}
      <button
        onClick={handleCornerTap}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 80,
          height: 80,
          background: "transparent",
          border: "none",
          zIndex: 9999,
          cursor: "default",
        }}
        aria-label="Staff access"
      />

      {children}

      {/* Staff PIN Modal */}
      {showPinModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: "#1a1a1a",
              borderRadius: 24,
              padding: 48,
              textAlign: "center",
              color: "white",
              minWidth: 350,
            }}
          >
            <h2 style={{ marginBottom: 8, fontSize: "1.5rem" }}>{t("staff.staffAccess")}</h2>
            <p style={{ color: "#999", marginBottom: 32, fontSize: "0.9rem" }}>
              {t("staff.enterPin")}
            </p>

            {/* PIN Display */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginBottom: 32,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 50,
                    height: 60,
                    borderRadius: 12,
                    border: pinError
                      ? "2px solid #ef4444"
                      : pinInput.length > i
                      ? "2px solid #7C7A67"
                      : "2px solid #333",
                    background: pinInput.length > i ? "#7C7A67" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    fontWeight: 700,
                    transition: "all 0.2s",
                  }}
                >
                  {pinInput.length > i ? "*" : ""}
                </div>
              ))}
            </div>

            {pinError && (
              <div
                style={{
                  color: "#ef4444",
                  marginBottom: 16,
                  fontSize: "0.9rem",
                }}
              >
                {t("staff.incorrectPin")}
              </div>
            )}

            {/* Number Pad - Touch optimized */}
            <div className="kiosk-numpad" style={{ margin: "0 auto 24px" }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map(
                (key) => (
                  <button
                    key={key}
                    onClick={() => handlePinKey(key)}
                    className="kiosk-numpad-btn"
                    style={{
                      background: key === "clear" || key === "back" ? "#333" : "#444",
                      color: "white",
                      fontSize: key === "clear" || key === "back" ? "1rem" : "1.75rem",
                    }}
                  >
                    {key === "clear" ? t("staff.clear") : key === "back" ? "<" : key}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() => setShowPinModal(false)}
              style={{
                padding: "12px 32px",
                background: "transparent",
                border: "2px solid #666",
                borderRadius: 12,
                color: "#999",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              {tCommon("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
