"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";

type PhoneCollectionModalProps = {
  userId: string;
  userName?: string;
  onSubmit: (phone: string, smsOptIn: boolean) => void;
  onSkip: () => void;
};

export function PhoneCollectionModal({
  userId,
  userName,
  onSubmit,
  onSkip,
}: PhoneCollectionModalProps) {
  const t = useTranslations("phoneCollection");
  const [phone, setPhone] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!phone.trim()) {
      setError(t("phoneRequired"));
      return;
    }

    // Basic phone validation
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError(t("invalidPhone"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/users/${userId}/phone`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          phone: cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`,
          smsOptIn,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update phone");
      }

      onSubmit(phone, smsOptIn);
    } catch (err) {
      console.error("Failed to update phone:", err);
      setError(t("updateFailed"));
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          maxWidth: 420,
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #7C7A67 0%, #5a5847 100%)",
            color: "white",
            padding: "24px 24px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 600 }}>
            {t("title")}
          </h2>
          {userName && (
            <p style={{ margin: "8px 0 0", opacity: 0.9, fontSize: "0.95rem" }}>
              {t("greeting", { name: userName })}
            </p>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          <p style={{ color: "#444", lineHeight: 1.6, marginBottom: 20 }}>
            {t("description")}
          </p>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 500,
                fontSize: "0.9rem",
                color: "#333",
              }}
            >
              {t("phoneLabel")}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: error ? "2px solid #ef4444" : "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem", marginTop: 6 }}>
                {error}
              </p>
            )}
          </div>

          {/* SMS Consent */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
                fontSize: "0.85rem",
                color: "#444",
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                style={{ marginTop: 3, cursor: "pointer", width: 16, height: 16 }}
              />
              <span>
                {t("smsConsent")}{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#7C7A67", textDecoration: "underline" }}
                >
                  {t("privacyPolicy")}
                </a>
              </span>
            </label>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                background: "#7C7A67",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "14px 24px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? t("saving") : t("savePhone")}
            </button>
            <button
              onClick={onSkip}
              disabled={submitting}
              style={{
                background: "transparent",
                color: "#666",
                border: "none",
                padding: "10px",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              {t("skipForNow")}
            </button>
          </div>

          <p
            style={{
              marginTop: 16,
              fontSize: "0.8rem",
              color: "#999",
              textAlign: "center",
            }}
          >
            {t("skipNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
