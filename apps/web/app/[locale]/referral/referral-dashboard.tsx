"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import { event } from "@/lib/analytics";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Helper to translate credit event descriptions
function translateCreditEvent(
  description: string,
  type: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  // Match "X% cashback on order"
  const cashbackMatch = description?.match(/^(\d+)% cashback on order$/);
  if (cashbackMatch) {
    return t("creditEvents.cashback", { percent: cashbackMatch[1] });
  }

  // Match "Applied to order ORD-XXX"
  const appliedMatch = description?.match(/^Applied to order (ORD-[\w-]+)$/);
  if (appliedMatch) {
    return t("creditEvents.appliedToOrder", { orderId: appliedMatch[1] });
  }

  // Fallback to original description or type
  return description || type;
}

export default function ReferralDashboard() {
  const locale = useLocale();
  const t = useTranslations("referral.dashboard");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<any>(null);
  const [pendingCredits, setPendingCredits] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  async function createUser() {
    if (!email) {
      toast.warning(tCommon("enterEmail"));
      return;
    }

    setLoading(true);
    const response = await fetch(`${BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const userData = await response.json();
    setUser(userData);
    localStorage.setItem("userId", userData.id);
    loadCredits(userData.id);
    loadPendingCredits(userData.id);
    setLoading(false);
  }

  async function loadCredits(userId: string) {
    const response = await fetch(`${BASE}/users/${userId}/credits`);
    const data = await response.json();
    setCredits(data);
  }

  async function loadPendingCredits(userId: string) {
    try {
      const response = await fetch(`${BASE}/users/${userId}/pending-credits`);
      const data = await response.json();
      setPendingCredits(data);
    } catch (err) {
      console.error("Failed to load pending credits:", err);
    }
  }

  useEffect(() => {
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId) {
      fetch(`${BASE}/users/${savedUserId}/credits`)
        .then((r) => r.json())
        .then((data) => {
          setCredits(data);
          setUser({ id: savedUserId });
        });
      // Also load pending credits
      loadPendingCredits(savedUserId);
    }
  }, []);

  if (!user) {
    return (
      <div
        style={{
          maxWidth: 400,
          margin: "0 auto",
          padding: 32,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ marginBottom: 16 }}>{t("getStarted")}</h2>
        <p style={{ color: "#666", marginBottom: 24 }}>
          {t("enterEmailPrompt")}
        </p>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: "1rem",
          }}
        />
        <button
          onClick={createUser}
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: "#7C7A67",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? t("creating") : t("getMyReferralLink")}
        </button>
      </div>
    );
  }

  const referralUrl = `${window.location.origin}/order?ref=${credits?.referralCode}`;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Credits Balance */}
      <div
        style={{
          background: "#7C7A67",
          color: "white",
          padding: 32,
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: 8 }}>
          {t("availableCredits")}
        </div>
        <div style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: 4 }}>
          ${((credits?.balance || 0) / 100).toFixed(2)}
        </div>
        <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
          {t("useCreditsNote")}
        </div>
      </div>

      {/* Pending Credits */}
      {pendingCredits && pendingCredits.totalPendingCents > 0 && (
        <div
          style={{
            background: "rgba(199, 168, 120, 0.2)",
            border: "2px solid #C7A878",
            padding: 24,
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: "1.5rem" }}>⏳</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "bold", color: "#222", fontSize: "1.1rem" }}>
                {t("pendingCredits")}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                {t("scheduledForDisbursement")}
              </div>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#7C7A67" }}>
              ${(pendingCredits.totalPendingCents / 100).toFixed(2)}
            </div>
          </div>
          {pendingCredits.nextDisbursement && (
            <div
              style={{
                background: "white",
                padding: 12,
                borderRadius: 8,
                fontSize: "0.85rem",
                color: "#666",
                textAlign: "center",
              }}
            >
              {t("nextDisbursement")} <strong style={{ color: "#222" }}>
                {new Date(pendingCredits.nextDisbursement).toLocaleDateString(locale, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>
            </div>
          )}
        </div>
      )}

      {/* Referral Link */}
      <div
        style={{
          padding: 24,
          background: "#f9fafb",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 16 }}>{t("yourReferralLink")}</h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 12,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <input
            type="text"
            value={referralUrl}
            readOnly
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "0.9rem",
              color: "#7C7A67",
            }}
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(referralUrl);
              // Track referral link copy
              event({
                action: "copy_referral_link",
                category: "engagement",
                label: credits?.referralCode,
              });
              toast.success(tCommon("linkCopied"));
            }}
            style={{
              padding: "8px 16px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "bold",
            }}
          >
            {t("copy")}
          </button>
        </div>

        {/* Show QR Button */}
        <button
          onClick={() => {
            setShowQR(true);
            event({
              action: "show_referral_qr",
              category: "engagement",
              label: credits?.referralCode,
            });
          }}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "12px 16px",
            background: "#222222",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="14" width="3" height="3" fill="currentColor"/>
            <rect x="18" y="14" width="3" height="3" fill="currentColor"/>
            <rect x="14" y="18" width="3" height="3" fill="currentColor"/>
            <rect x="18" y="18" width="3" height="3" fill="currentColor"/>
          </svg>
          {t("showMyOhQRCode")}
          <span style={{ fontFamily: '"Ma Shan Zheng", cursive', fontSize: "1.2rem", marginLeft: 4 }}>哦</span>
        </button>

        <p
          style={{
            fontSize: "0.85rem",
            color: "#666",
            margin: 0,
            marginTop: 12,
          }}
        >
          {t("shareToEarn")}
        </p>
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div
          onClick={() => setShowQR(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 20,
              padding: 32,
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: "1.3rem" }}>
              {t("scanToJoin")}
            </h3>
            <p style={{ color: "#666", marginBottom: 24, fontSize: "0.9rem" }}>
              {t("scanDescription")}
            </p>

            {/* QR Code with Oh! logo in center */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 24,
                position: "relative",
              }}
            >
              <div style={{ position: "relative", display: "inline-block" }}>
                <QRCodeSVG
                  value={referralUrl}
                  size={240}
                  level="H"
                  includeMargin
                />
                {/* Logo overlay with rounded corners */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "white",
                    borderRadius: 14,
                    padding: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    src="/Oh_Logo_Mark_Web.png"
                    alt="Oh!"
                    width={56}
                    height={56}
                    style={{ objectFit: "contain" }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#f9fafb",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                fontSize: "0.85rem",
                color: "#7C7A67",
                wordBreak: "break-all",
              }}
            >
              {referralUrl}
            </div>

            <button
              onClick={() => setShowQR(false)}
              style={{
                width: "100%",
                padding: 14,
                background: "#7C7A67",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "bold",
              }}
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {credits?.events && credits.events.length > 0 && (
        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 16 }}>{t("recentActivity")}</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {credits.events.slice(0, 10).map((event: any) => (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  background: "#f9fafb",
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                    {translateCreditEvent(event.description, event.type, t)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666" }}>
                    {new Date(event.createdAt).toLocaleDateString(locale)}
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: "bold",
                    color: event.amountCents > 0 ? "#7C7A67" : "#222222",
                  }}
                >
                  {event.amountCents > 0 ? "+" : ""}$
                  {(event.amountCents / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
