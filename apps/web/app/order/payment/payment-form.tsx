"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";

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
  const { user, isLoaded, isSignedIn } = useUser();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [hasReferral, setHasReferral] = useState(false);
  const [referralNotApplied, setReferralNotApplied] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [userInitialized, setUserInitialized] = useState(false);

  useEffect(() => {
    // Check if there's a pending referral code
    // NOTE: We don't set hasReferral here anymore - we only set it when the API
    // confirms the referral was just applied (referralJustApplied === true)
    const referralCode = localStorage.getItem("pendingReferralCode");
    if (referralCode) {
      console.log("Found pending referral code:", referralCode);
    }
  }, []);

  useEffect(() => {
    // Initialize user in our system when Clerk user is available
    if (isLoaded && isSignedIn && user && !userInitialized) {
      initializeUser();
    }
  }, [isLoaded, isSignedIn, user, userInitialized]);

  async function initializeUser() {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    console.log("=== 💳 PAYMENT FORM: initializeUser() called ===");
    console.log("Clerk user email:", user.primaryEmailAddress.emailAddress);
    console.log("Clerk user name:", user.fullName || user.firstName);

    setLoadingCredits(true);
    try {
      // Get referral code from localStorage
      const referralCode = localStorage.getItem("pendingReferralCode");
      console.log("📦 localStorage state before API call:");
      console.log("  - pendingReferralCode:", referralCode);
      console.log("  - userId:", localStorage.getItem("userId"));
      console.log("  - referralCode:", localStorage.getItem("referralCode"));

      console.log("🚀 Calling POST /users API with:");
      console.log("  - email:", user.primaryEmailAddress.emailAddress);
      console.log("  - name:", user.fullName || user.firstName || undefined);
      console.log("  - referredByCode:", referralCode);

      // Create or get user in our system
      const userResponse = await fetch(`${BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.primaryEmailAddress.emailAddress,
          name: user.fullName || user.firstName || undefined,
          referredByCode: referralCode,
        }),
      });

      if (!userResponse.ok) {
        throw new Error("Failed to initialize user");
      }

      const userData = await userResponse.json();
      console.log("✅ API Response received:");
      console.log("  - userId:", userData.id);
      console.log("  - creditsCents:", userData.creditsCents);
      console.log("  - referralCode:", userData.referralCode);
      console.log("  - referredById:", userData.referredById);
      console.log("  - referralJustApplied:", userData.referralJustApplied);
      console.log("  - Full user data:", userData);

      setUserId(userData.id);
      setUserCredits(userData.creditsCents || 0);
      localStorage.setItem("userId", userData.id);
      localStorage.setItem("referralCode", userData.referralCode);
      setUserInitialized(true);

      console.log("💰 Credits set to:", userData.creditsCents || 0);

      // Check if referral code was provided but not applied
      // This happens when user already had a referrer from their first order
      if (referralCode && !userData.referralJustApplied && userData.referredById) {
        console.log("ℹ️ Referral code provided but user already used their first-order referral");
        setReferralNotApplied(true);
      }

      // If referral was just applied, ensure hasReferral is set
      if (userData.referralJustApplied) {
        console.log("🎉 Referral just applied!");
        setHasReferral(true);
      }

      // Clear the pending referral code after successful user creation
      if (referralCode) {
        console.log("🧹 Clearing pendingReferralCode from localStorage");
        localStorage.removeItem("pendingReferralCode");
      }

      setLoadingCredits(false);
    } catch (err: any) {
      console.error("❌ Failed to initialize user:", err);
      setError(err.message || "Failed to load user account");
      setLoadingCredits(false);
    }
  }

  async function handleTestPayment() {
    if (!userId) {
      setError("Please wait while we load your account...");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // Apply credits to order if user has any
      if (userCredits > 0) {
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

      // Mark order as paid and link to user
      const response = await fetch(`${BASE}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: "PAID",
          userId: userId,
        }),
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
  const validTotalCents =
    typeof totalCents === "number" && !isNaN(totalCents) ? totalCents : 0;
  const creditsApplied = Math.min(userCredits, validTotalCents);
  const discountedTotal = validTotalCents - creditsApplied;
  const showCreditsBreakdown = creditsApplied > 0;

  // Show sign-in prompt if not authenticated
  if (!isLoaded) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: 16 }}>⏳</div>
        <p style={{ color: "#666" }}>Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div
        style={{
          background: "#f0f4ff",
          border: "2px solid #667eea",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🔐</div>
        <h3 style={{ marginBottom: 12 }}>Sign in to complete your order</h3>
        <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.6 }}>
          You'll need to sign in to track your order, earn rewards, and use
          referral credits.
          {hasReferral && (
            <span style={{ color: "#22c55e", fontWeight: "bold", display: "block", marginTop: 8 }}>
              🎉 You have a referral discount waiting!
            </span>
          )}
        </p>
        <SignInButton mode="modal">
          <button
            style={{
              padding: "16px 32px",
              background: "#667eea",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Sign In / Sign Up
          </button>
        </SignInButton>
      </div>
    );
  }

  // User is signed in, show payment form
  return (
    <div>
      {loadingCredits && (
        <div
          style={{
            background: "#f0f4ff",
            border: "1px solid #667eea",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>⏳</div>
          <p style={{ color: "#666", margin: 0 }}>
            Loading your account and rewards...
          </p>
        </div>
      )}

      {userInitialized && (
        <>
          {/* Referral Banner - Only show if referral was JUST applied */}
          {hasReferral && userCredits > 0 && !referralNotApplied && (
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
                  You got ${(userCredits / 100).toFixed(2)} in credits to use on
                  this order
                </div>
              </div>
            </div>
          )}

          {/* Referral Not Applied Message */}
          {referralNotApplied && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: "1.5rem" }}>ℹ️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", color: "#92400e" }}>
                  Referral credit already used
                </div>
                <div style={{ fontSize: "0.85rem", color: "#b45309", lineHeight: 1.5 }}>
                  Thanks for checking us out again! Referral credits are only applied to your first order. You can still earn credits by referring friends using your personal referral link.
                </div>
              </div>
            </div>
          )}

          {/* Credits Balance */}
          {userCredits > 0 && !hasReferral && (
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
            disabled={processing || loadingCredits}
            style={{
              width: "100%",
              padding: 16,
              background: processing || loadingCredits ? "#d1d5db" : "#22c55e",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: processing || loadingCredits ? "not-allowed" : "pointer",
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
