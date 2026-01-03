"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { API_URL } from "@/lib/api";

const STAFF_PIN = process.env.NEXT_PUBLIC_KIOSK_STAFF_PIN || "1234";
const STORAGE_KEY = "oh_kiosk_api_key";

export default function KioskSetupPage() {
  const router = useRouter();
  const locale = useLocale();

  const [step, setStep] = useState<"pin" | "setup">("pin");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ deviceName: string; locationName: string } | null>(null);

  // Handle PIN entry
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
            setStep("setup");
          } else {
            setPinError(true);
            setPinInput("");
          }
        }, 200);
      }
    }
  }

  // Validate and save API key
  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/kiosk/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          appVersion: "1.0.0",
          deviceInfo: {
            userAgent: navigator.userAgent,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            setupAt: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Invalid API key");
        setIsLoading(false);
        return;
      }

      const data = await res.json();

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, apiKey.trim());

      // Show success
      setSuccess({
        deviceName: data.device.name,
        locationName: data.location.name,
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/${locale}/kiosk`);
      }, 2000);

    } catch (err) {
      setError("Connection error. Please check your network.");
      setIsLoading(false);
    }
  }

  // Clear existing configuration
  function handleClearConfig() {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey("");
    setSuccess(null);
    setError(null);
  }

  // Check if already configured
  const existingKey = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        color: "white",
        padding: 24,
      }}
    >
      {step === "pin" ? (
        // PIN Entry Screen
        <div
          style={{
            background: "#252525",
            borderRadius: 24,
            padding: 48,
            textAlign: "center",
            minWidth: 350,
          }}
        >
          <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Kiosk Setup</h1>
          <p style={{ color: "#999", marginBottom: 32, fontSize: "0.9rem" }}>
            Enter staff PIN to continue
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
                    : "2px solid #444",
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
            <div style={{ color: "#ef4444", marginBottom: 16, fontSize: "0.9rem" }}>
              Incorrect PIN
            </div>
          )}

          {/* Number Pad */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              maxWidth: 280,
              margin: "0 auto",
            }}
          >
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
              <button
                key={key}
                onClick={() => handlePinKey(key)}
                style={{
                  padding: "20px 0",
                  background: key === "clear" || key === "back" ? "#333" : "#444",
                  border: "none",
                  borderRadius: 12,
                  color: "white",
                  fontSize: key === "clear" || key === "back" ? "0.9rem" : "1.5rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {key === "clear" ? "Clear" : key === "back" ? "←" : key}
              </button>
            ))}
          </div>

          <button
            onClick={() => router.push(`/${locale}/kiosk`)}
            style={{
              marginTop: 32,
              padding: "12px 32px",
              background: "transparent",
              border: "1px solid #444",
              borderRadius: 8,
              color: "#999",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      ) : success ? (
        // Success Screen
        <div
          style={{
            background: "#252525",
            borderRadius: 24,
            padding: 48,
            textAlign: "center",
            maxWidth: 400,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Setup Complete!</h1>
          <p style={{ color: "#999", marginBottom: 8 }}>
            Device: <strong style={{ color: "white" }}>{success.deviceName}</strong>
          </p>
          <p style={{ color: "#999", marginBottom: 24 }}>
            Location: <strong style={{ color: "white" }}>{success.locationName}</strong>
          </p>
          <p style={{ color: "#666", fontSize: "0.85rem" }}>
            Redirecting to kiosk...
          </p>
        </div>
      ) : (
        // Setup Form
        <div
          style={{
            background: "#252525",
            borderRadius: 24,
            padding: 48,
            textAlign: "center",
            maxWidth: 500,
            width: "100%",
          }}
        >
          <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Kiosk Device Setup</h1>
          <p style={{ color: "#999", marginBottom: 32, fontSize: "0.9rem" }}>
            Enter the API key for this device
          </p>

          {existingKey && (
            <div
              style={{
                background: "#333",
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                textAlign: "left",
              }}
            >
              <div style={{ color: "#999", fontSize: "0.8rem", marginBottom: 4 }}>
                Currently configured:
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "0.85rem", wordBreak: "break-all" }}>
                {existingKey.slice(0, 20)}...
              </div>
              <button
                onClick={handleClearConfig}
                style={{
                  marginTop: 12,
                  padding: "8px 16px",
                  background: "#ef4444",
                  border: "none",
                  borderRadius: 6,
                  color: "white",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Clear Configuration
              </button>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="apiKey"
              style={{
                display: "block",
                textAlign: "left",
                marginBottom: 8,
                color: "#999",
                fontSize: "0.9rem",
              }}
            >
              API Key
            </label>
            <input
              id="apiKey"
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="kiosk_abc123..."
              style={{
                width: "100%",
                padding: 16,
                background: "#333",
                border: error ? "2px solid #ef4444" : "2px solid #444",
                borderRadius: 12,
                color: "white",
                fontSize: "1rem",
                fontFamily: "monospace",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#7f1d1d",
                borderRadius: 8,
                padding: 12,
                marginBottom: 24,
                color: "#fca5a5",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => router.push(`/${locale}/kiosk`)}
              style={{
                flex: 1,
                padding: 16,
                background: "transparent",
                border: "1px solid #444",
                borderRadius: 12,
                color: "#999",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveApiKey}
              disabled={isLoading || !apiKey.trim()}
              style={{
                flex: 2,
                padding: 16,
                background: isLoading ? "#555" : "#7C7A67",
                border: "none",
                borderRadius: 12,
                color: "white",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: isLoading ? "wait" : "pointer",
                opacity: !apiKey.trim() ? 0.5 : 1,
              }}
            >
              {isLoading ? "Validating..." : "Save & Connect"}
            </button>
          </div>

          <p style={{ color: "#666", fontSize: "0.8rem", marginTop: 24 }}>
            Get your API key from the admin panel or IT team
          </p>
        </div>
      )}
    </main>
  );
}
