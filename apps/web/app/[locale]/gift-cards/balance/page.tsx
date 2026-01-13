"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Design gradients matching the gift card designs
const designGradients: Record<string, string> = {
  classic: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
  dark: "linear-gradient(135deg, #222222 0%, #444444 100%)",
  gold: "linear-gradient(135deg, #C7A878 0%, #8B7355 100%)",
};

interface GiftCardInfo {
  id: string;
  balanceCents: number;
  designId: string;
}

export default function GiftCardBalancePage() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [code, setCode] = useState(codeFromUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [giftCard, setGiftCard] = useState<GiftCardInfo | null>(null);

  // Auto-check balance if code is in URL
  useEffect(() => {
    if (codeFromUrl) {
      checkBalance(codeFromUrl);
    }
  }, [codeFromUrl]);

  const checkBalance = async (codeToCheck: string) => {
    if (!codeToCheck.trim()) {
      setError("Please enter a gift card code");
      return;
    }

    setLoading(true);
    setError(null);
    setGiftCard(null);

    try {
      const res = await fetch(`${API_URL}/gift-cards/code/${encodeURIComponent(codeToCheck.trim())}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError("Gift card not found or has no remaining balance");
        } else {
          setError("Unable to check balance. Please try again.");
        }
        return;
      }

      const data = await res.json();
      setGiftCard(data);
    } catch (err) {
      setError("Unable to connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkBalance(code);
  };

  const formatCode = (value: string) => {
    // Remove all non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Add dashes every 4 characters
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.join("-").slice(0, 19); // Max 16 chars + 3 dashes
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(formatCode(e.target.value));
    setError(null);
    setGiftCard(null);
  };

  const cardGradient = giftCard ? (designGradients[giftCard.designId] || designGradients.classic) : designGradients.classic;

  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#222", padding: "80px 24px 60px" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <Link
            href="/gift-cards"
            style={{
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "32px",
              fontSize: "0.9rem",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Gift Cards
          </Link>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              color: "white",
              letterSpacing: "1px",
              marginBottom: "16px",
            }}
          >
            Check Your Balance
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.05rem" }}>
            Enter your gift card code to view your remaining balance
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: "500px", margin: "0 auto", padding: "48px 24px" }}>
        {/* Code Input Form */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              marginBottom: "24px",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.9rem",
                fontWeight: "600",
                color: "#222",
                marginBottom: "12px",
              }}
            >
              Gift Card Code
            </label>
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              style={{
                width: "100%",
                padding: "18px 20px",
                border: "2px solid #e5e7eb",
                borderRadius: "12px",
                fontSize: "1.2rem",
                fontFamily: "'Courier New', monospace",
                letterSpacing: "2px",
                textAlign: "center",
                textTransform: "uppercase",
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => e.target.style.borderColor = "#7C7A67"}
              onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
            />
            <p style={{ color: "#999", fontSize: "0.85rem", marginTop: "12px", textAlign: "center" }}>
              Find your code in your gift card email or on your receipt
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "24px",
                color: "#dc2626",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {/* Check Balance Button */}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              width: "100%",
              padding: "18px",
              background: loading || !code.trim() ? "#d1d5db" : "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "1.1rem",
              fontWeight: "600",
              cursor: loading || !code.trim() ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Checking...
              </>
            ) : (
              "Check Balance"
            )}
          </button>
        </form>

        {/* Balance Result */}
        {giftCard && (
          <div
            style={{
              marginTop: "32px",
              animation: "fadeIn 0.3s ease",
            }}
          >
            {/* Gift Card Preview */}
            <div
              style={{
                width: "100%",
                aspectRatio: "1.6 / 1",
                borderRadius: "20px",
                background: cardGradient,
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                overflow: "hidden",
                position: "relative",
                marginBottom: "24px",
              }}
            >
              <div style={{ position: "relative", height: "100%", padding: "24px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.6)", letterSpacing: "2px", textTransform: "uppercase" }}>
                    Digital Gift Card
                  </div>
                  <div style={{ width: "70px", height: "70px", position: "relative", marginTop: "-8px", marginRight: "-4px" }}>
                    <Image
                      src="/Oh_Logo_Large.png"
                      alt="Oh! Logo"
                      fill
                      sizes="70px"
                      style={{ objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.85 }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: "-16px" }}>
                  <p style={{ margin: "0 0 8px", fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "2px" }}>
                    Available Balance
                  </p>
                  <div style={{ fontSize: "clamp(2.5rem, 10vw, 3.5rem)", fontWeight: "300", color: "white" }}>
                    ${(giftCard.balanceCents / 100).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.9rem", fontWeight: "300", color: "white" }}>Oh! Beef Noodle Soup</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>ohbeef.com</div>
                </div>
              </div>
            </div>

            {/* Balance Info Card */}
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #eee" }}>
                <span style={{ color: "#666", fontSize: "1rem" }}>Current Balance</span>
                <span style={{ color: "#222", fontWeight: "700", fontSize: "1.5rem" }}>
                  ${(giftCard.balanceCents / 100).toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#666", fontSize: "0.9rem" }}>Card Code</span>
                <span style={{ color: "#7C7A67", fontWeight: "600", fontSize: "0.9rem", fontFamily: "'Courier New', monospace" }}>
                  {code}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
              <button
                onClick={() => {
                  // Store gift card code for auto-apply at checkout
                  localStorage.setItem("pendingGiftCardCode", code);
                  window.location.href = "/order";
                }}
                style={{
                  display: "block",
                  padding: "16px",
                  background: "#7C7A67",
                  color: "white",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  textDecoration: "none",
                  textAlign: "center",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Order Now
              </button>
              <button
                onClick={() => {
                  // Store gift card code for auto-apply at checkout
                  localStorage.setItem("pendingGiftCardCode", code);
                  window.location.href = "/store";
                }}
                style={{
                  display: "block",
                  padding: "16px",
                  background: "white",
                  color: "#7C7A67",
                  border: "2px solid #7C7A67",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  textDecoration: "none",
                  textAlign: "center",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Shop Products
              </button>
            </div>
          </div>
        )}

        {/* Help Text */}
        {!giftCard && (
          <div style={{ marginTop: "48px", textAlign: "center" }}>
            <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "16px" }}>
              Don't have a gift card yet?
            </p>
            <Link
              href="/gift-cards"
              style={{
                color: "#7C7A67",
                fontWeight: "600",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Purchase a Gift Card
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
