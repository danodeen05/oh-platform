"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function PaymentForm({
  orderId,
  totalCents,
  orderNumber,
}: {
  orderId: string;
  totalCents: number;
  orderNumber: string;
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [hasReferral, setHasReferral] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  useEffect(() => {
    // Check if there's a pending referral code
    const referralCode = localStorage.getItem("pendingReferralCode");
    if (referralCode) {
      setHasReferral(true);
    }

    // Check if user already exists
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId) {
      setUserId(savedUserId);
      setEmailSubmitted(true);
      loadUserCredits(savedUserId);
    }
  }, []);

  async function loadUserCredits(uid: string) {
    try {
      setLoadingCredits(true);
      const response = await fetch(`${BASE}/users/${uid}/credits`);
      if (!response.ok) {
        // User doesn't exist, clear from localStorage
        localStorage.removeItem("userId");
        localStorage.removeItem("referralCode");
        setUserId(null);
        setEmailSubmitted(false);
        setLoadingCredits(false);
        return;
      }
      const data = await response.json();
      setUserCredits(data.balance);
      setLoadingCredits(false);
    } catch (err) {
      console.error("Failed to load credits:", err);
      // Clear invalid user data
      localStorage.removeItem("userId");
      localStorage.removeItem("referralCode");
      setUserId(null);
      setEmailSubmitted(false);
      setLoadingCredits(false);
    }
  }

  async function handleEmailSubmit() {
    if (!email) {
      setError("Please enter your email");
      return;
    }

    setLoadingCredits(true);
    setError("");

    try {
      // Get referral code from localStorage
      const referralCode = localStorage.getItem("pendingReferralCode");

      // Create or get user
      const userResponse = await fetch(`${BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          referredByCode: referralCode,
        }),
      });
      const userData = await userResponse.json();
      setUserId(userData.id);
      setUserCredits(userData.creditsCents || 0);
      localStorage.setItem("userId", userData.id);
      localStorage.setItem("referralCode", userData.referralCode);
      setEmailSubmitted(true);

      // Clear the pending referral code
      if (referralCode) {
        localStorage.removeItem("pendingReferralCode");
      }

      setLoadingCredits(false);
    } catch (err: any) {
      setError(err.message || "Failed to create account");
      setLoadingCredits(false);
    }
  }

  async function handleTestPayment() {
    setProcessing(true);
    setError("");

    try {
      // Apply credits to order if user has any
      if (userCredits > 0 && userId) {
        const creditsToApply = Math.min(userCredits, totalCents);
        await fetch(`${BASE}/orders/${orderId}/apply-credits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            creditsCents: creditsToApply,
          }),
        });
      }

      // Mark order as paid and optionally link to user (if user exists)
      const body: any = { paymentStatus: "PAID" };
      if (userId) {
        body.userId = userId;
      }

      const response = await fetch(`${BASE}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Payment failed");

      const updatedOrder = await response.json();

      // Redirect to confirmation with the final total
      router.push(
        `/order/confirmation?orderNumber=${orderNumber}&total=${updatedOrder.totalCents}&paid=true`
      );
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setProcessing(false);
    }
  }

  // Ensure totalCents is a valid number
  const validTotalCents = typeof totalCents === 'number' && !isNaN(totalCents) ? totalCents : 0;
  const creditsApplied = Math.min(userCredits, validTotalCents);
  const discountedTotal = validTotalCents - creditsApplied;
  const showCreditsBreakdown = creditsApplied > 0;

  return (
    <div>
      {/* Email Input */}
      {!emailSubmitted && (
        <div style={{ marginBottom: 24 }}>
          <label
            style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}
          >
            Email Address
          </label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") handleEmailSubmit();
            }}
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: "1rem",
              marginBottom: 12,
            }}
          />
          <button
            onClick={handleEmailSubmit}
            disabled={loadingCredits}
            style={{
              width: "100%",
              padding: 12,
              background: loadingCredits ? "#d1d5db" : "#667eea",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: loadingCredits ? "not-allowed" : "pointer",
            }}
          >
            {loadingCredits ? "Loading..." : "Continue to Payment"}
          </button>
          <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 8 }}>
            We'll use this to track your order and rewards
          </p>
        </div>
      )}

      {/* Show rest of payment form only after email submitted */}
      {emailSubmitted && (
        <>
          {/* Referral Banner */}
          {hasReferral && userCredits > 0 && (
            <div
              style={{
                background: "#d1fae5",
                border: "1px solid #22c55e",
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: "1.5rem" }}>🎉</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", color: "#065f46" }}>
                  Welcome! You've been referred
                </div>
                <div style={{ fontSize: "0.85rem", color: "#047857" }}>
                  You got $5 in credits to use on this order
                </div>
              </div>
            </div>
          )}

          {/* Credits Balance */}
          {userCredits > 0 && (
            <div
              style={{
                background: "#f0f4ff",
                border: "1px solid #667eea",
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: "1.5rem" }}>💰</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", color: "#4338ca" }}>
                  Available Credits
                </div>
                <div style={{ fontSize: "0.85rem", color: "#6366f1" }}>
                  You have ${(userCredits / 100).toFixed(2)} in credits
                </div>
              </div>
            </div>
          )}

          {/* Order Summary with Credits */}
          {showCreditsBreakdown && (
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ color: "#666" }}>Subtotal</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  color: "#22c55e",
                  fontWeight: "bold",
                }}
              >
                <span>Credits Applied</span>
                <span>-${(creditsApplied / 100).toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  borderTop: "2px solid #e5e7eb",
                  fontSize: "1.2rem",
                  fontWeight: "bold",
                }}
              >
                <span>Total</span>
                <span>${(discountedTotal / 100).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Method Selection */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 16 }}>Payment Method</h3>

            <div
              style={{
                border: "2px solid #667eea",
                borderRadius: 12,
                padding: 20,
                background: "#f0f4ff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem",
                  }}
                >
                  💳
                </div>
                <div>
                  <div style={{ fontWeight: "bold" }}>Test Payment</div>
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                    Demo mode - no real charge
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fbbf24",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: "0.85rem",
                  color: "#92400e",
                }}
              >
                ⚠️ This is a demo payment. Real Stripe integration coming soon!
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: "#fee2e2",
                border: "1px solid #ef4444",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                color: "#991b1b",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleTestPayment}
            disabled={processing}
            style={{
              width: "100%",
              padding: 16,
              background: processing ? "#d1d5db" : "#22c55e",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: processing ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {processing
              ? "Processing Payment..."
              : `Pay $${(discountedTotal / 100).toFixed(2)}`}
          </button>

          <p
            style={{
              textAlign: "center",
              fontSize: "0.75rem",
              color: "#9ca3af",
              marginTop: 16,
            }}
          >
            🔒 Secure checkout powered by Stripe (test mode)
          </p>
        </>
      )}
    </div>
  );
}
