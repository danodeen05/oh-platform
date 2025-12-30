"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useGuest } from "@/contexts/guest-context";
import { trackBeginCheckout, trackReferralCodeUsed } from "@/lib/analytics";
import { useTranslations } from "next-intl";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PaymentForm({
  orderId,
  totalCents,
  orderNumber,
  mealGiftId,
}: {
  orderId: string;
  totalCents: number;
  orderNumber: string;
  mealGiftId?: string;
}) {
  const router = useRouter();
  const t = useTranslations("payment");
  const tMealGift = useTranslations("mealGift");
  const { user, isLoaded, isSignedIn } = useUser();
  const { guest, isGuest, updateGuest } = useGuest();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [hasReferral, setHasReferral] = useState(false);
  const [referralNotApplied, setReferralNotApplied] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [mealGiftCredit, setMealGiftCredit] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [userInitialized, setUserInitialized] = useState(false);
  const [applyCredits, setApplyCredits] = useState(true); // Allow user to choose whether to apply credits
  const initializingRef = useRef(false); // Prevent concurrent initialization calls
  const MAX_CREDITS_PER_ORDER = 500; // $5.00 limit in cents

  // Guest checkout form state
  const [guestName, setGuestName] = useState(guest?.name === "Guest" ? "" : guest?.name || "");
  const [guestPhone, setGuestPhone] = useState(guest?.phone || "");
  const [guestEmail, setGuestEmail] = useState(guest?.email || "");
  const [guestFormError, setGuestFormError] = useState("");

  useEffect(() => {
    // Check if there's a pending referral code
    // NOTE: We don't set hasReferral here anymore - we only set it when the API
    // confirms the referral was just applied (referralJustApplied === true)
    const referralCode = localStorage.getItem("pendingReferralCode");
    if (referralCode) {
      console.log("Found pending referral code:", referralCode);
    }

    // Track begin_checkout event when payment form loads
    trackBeginCheckout({
      items: [], // Items are displayed in the parent page, we track the order number and total
      total: totalCents / 100,
    });
  }, [totalCents]);

  useEffect(() => {
    // Initialize user in our system when Clerk user is available
    if (isLoaded && isSignedIn && user && !userInitialized && !initializingRef.current) {
      initializeUser();
    }
  }, [isLoaded, isSignedIn, user, userInitialized]);

  // Fetch meal gift credit if mealGiftId is provided
  // We fetch directly from the meal gift endpoint since the gift isn't linked to the order yet
  useEffect(() => {
    async function fetchMealGift() {
      try {
        const response = await fetch(`${BASE}/meal-gifts/${mealGiftId}`, {
          headers: { "x-tenant-slug": "oh" },
        });

        if (response.ok) {
          const giftData = await response.json();
          // Only apply if gift is still pending (will be accepted at payment time)
          if (giftData.status === "PENDING") {
            setMealGiftCredit(giftData.amountCents);
          }
        }
      } catch (err) {
        console.error("Failed to fetch meal gift:", err);
      }
    }

    if (mealGiftId) {
      fetchMealGift();
    }
  }, [mealGiftId]);

  async function initializeUser() {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    // Prevent concurrent calls
    if (initializingRef.current) {
      console.log("⚠️ initializeUser already running, skipping duplicate call");
      return;
    }

    initializingRef.current = true;
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

        // Track referral code usage in GA4
        if (referralCode) {
          trackReferralCodeUsed(referralCode);
        }
      }

      // Clear the pending referral code after successful user creation
      if (referralCode) {
        console.log("🧹 Clearing pendingReferralCode from localStorage");
        localStorage.removeItem("pendingReferralCode");
      }

      setLoadingCredits(false);
      initializingRef.current = false;
    } catch (err: any) {
      console.error("❌ Failed to initialize user:", err);
      setError(err.message || "Failed to load user account");
      setLoadingCredits(false);
      initializingRef.current = false;
    }
  }

  async function acceptMealGift() {
    if (!mealGiftId) return;

    const recipientId = userId || guest?.id;
    if (!recipientId) {
      console.warn("No user/guest ID available to accept meal gift");
      return;
    }

    // Get the thank-you message from localStorage (set in menu builder)
    const messageFromRecipient = localStorage.getItem("mealGiftMessage") || undefined;

    try {
      const response = await fetch(`${BASE}/meal-gifts/${mealGiftId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          recipientId,
          orderId,
          messageFromRecipient,
          orderTotalCents: validTotalCents, // Pass order total so API can calculate excess credit
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn("Failed to accept meal gift:", errorData);
        // Dont throw - continue with payment even if gift acceptance fails
      } else {
        console.log("Meal gift accepted successfully");
        // Clear the message from localStorage after successful accept
        localStorage.removeItem("mealGiftMessage");
      }
    } catch (error) {
      console.warn("Error accepting meal gift:", error);
      // Dont throw - continue with payment even if gift acceptance fails
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
      // Accept meal gift if one was selected
      await acceptMealGift();

      // Apply credits to order if user has any AND they chose to apply them
      if (applyCredits && userCredits > 0) {
        const creditsToApply = Math.min(userCredits, totalCents, MAX_CREDITS_PER_ORDER);
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

      // Redirect to confirmation with the final total and orderId for fetching details
      router.push(
        `/order/confirmation?orderId=${orderId}&orderNumber=${orderNumber}&total=${updatedOrder.totalCents}&paid=true`
      );
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setProcessing(false);
    }
  }

  async function handleGuestPayment() {
    // Validate guest name
    if (!guestName.trim()) {
      setGuestFormError("Please enter your name");
      return;
    }

    setProcessing(true);
    setError("");

    setGuestFormError("");

    try {
      // Accept meal gift if one was selected
      await acceptMealGift();

      // Update guest details if changed
      if (guest && (guestName !== guest.name || guestPhone !== guest.phone || guestEmail !== guest.email)) {
        await updateGuest({
          name: guestName.trim(),
          phone: guestPhone.trim() || undefined,
          email: guestEmail.trim() || undefined,
        });
      }

      // Mark order as paid and link to guest
      const response = await fetch(`${BASE}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: "PAID",
          guestId: guest?.id,
        }),
      });

      if (!response.ok) throw new Error("Payment failed");

      const updatedOrder = await response.json();

      // Redirect to confirmation
      router.push(
        `/order/confirmation?orderId=${orderId}&orderNumber=${orderNumber}&total=${updatedOrder.totalCents}&paid=true`
      );
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setProcessing(false);
    }
  }

  // Ensure totalCents is a valid number
  const validTotalCents =
    typeof totalCents === "number" && !isNaN(totalCents) ? totalCents : 0;
  const creditsApplied = applyCredits ? Math.min(userCredits, validTotalCents, MAX_CREDITS_PER_ORDER) : 0;
  // Cap the gift applied to the remaining order total after credits
  const afterCreditsTotal = validTotalCents - creditsApplied;
  const giftApplied = Math.min(mealGiftCredit, afterCreditsTotal);
  const giftExcess = mealGiftCredit - giftApplied; // Excess will be credited to recipient's account
  const discountedTotal = afterCreditsTotal - giftApplied;
  const showCreditsBreakdown = (applyCredits && creditsApplied > 0) || giftApplied > 0;

  // Show sign-in prompt if not authenticated
  if (!isLoaded) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: 16 }}>⏳</div>
        <p style={{ color: "#666" }}>{t("loading")}</p>
      </div>
    );
  }

  if (!isSignedIn) {
    // Show guest checkout form if user has a guest session
    if (isGuest && guest) {
      return (
        <div>
          {/* Guest Info Form */}
          <div
            style={{
              background: "rgba(199, 168, 120, 0.1)",
              border: "1px solid #C7A878",
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <h3 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span>👤</span> {t("guestCheckout")}
            </h3>
            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: 20 }}>
              {t("guestCheckoutDescription")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: "500", fontSize: "0.9rem" }}>
                  {t("name")} <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={t("yourName")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: guestFormError ? "2px solid #ef4444" : "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />
                {guestFormError && (
                  <p style={{ color: "#ef4444", fontSize: "0.85rem", marginTop: 4 }}>{guestFormError}</p>
                )}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: "500", fontSize: "0.9rem" }}>
                  {t("phone")} <span style={{ color: "#9ca3af" }}>({t("optional")})</span>
                </label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder={t("forOrderUpdates")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: "500", fontSize: "0.9rem" }}>
                  {t("email")} <span style={{ color: "#9ca3af" }}>({t("optional")})</span>
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder={t("forReceipt")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>{t("paymentMethod")}</h3>
            <div
              style={{
                border: "2px solid #7C7A67",
                borderRadius: 12,
                padding: 20,
                background: "rgba(124, 122, 103, 0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
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
                  <div style={{ fontWeight: "bold" }}>{t("testPayment")}</div>
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>{t("demoMode")}</div>
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
                ⚠️ {t("demoWarning")}
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
            onClick={handleGuestPayment}
            disabled={processing}
            style={{
              width: "100%",
              padding: 16,
              background: processing ? "#d1d5db" : "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: processing ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {processing ? t("processingPayment") : t("payAmount", { amount: (validTotalCents / 100).toFixed(2) })}
          </button>

          {/* Sign in option for rewards */}
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: "#f9fafb",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: 12 }}>
              {t("wantToEarnRewards")}
            </p>
            <SignInButton mode="modal">
              <button
                style={{
                  padding: "10px 24px",
                  background: "transparent",
                  color: "#7C7A67",
                  border: "1px solid #7C7A67",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {t("signInInstead")}
              </button>
            </SignInButton>
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: "0.75rem",
              color: "#9ca3af",
              marginTop: 16,
            }}
          >
            🔒 {t("secureCheckout")}
          </p>
        </div>
      );
    }

    // Show sign-in prompt (no guest session)
    return (
      <div
        style={{
          background: "rgba(124, 122, 103, 0.1)",
          border: "2px solid #7C7A67",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🔐</div>
        <h3 style={{ marginBottom: 12 }}>{t("signInToComplete")}</h3>
        <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.6 }}>
          {t("signInDescription")}
          {hasReferral && (
            <span style={{ color: "#7C7A67", fontWeight: "bold", display: "block", marginTop: 8 }}>
              🎉 {t("referralDiscountWaiting")}
            </span>
          )}
        </p>
        <SignInButton mode="modal">
          <button
            style={{
              padding: "16px 32px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t("signInSignUp")}
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
            background: "rgba(124, 122, 103, 0.1)",
            border: "1px solid #7C7A67",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>⏳</div>
          <p style={{ color: "#666", margin: 0 }}>
            {t("loadingAccount")}
          </p>
        </div>
      )}

      {userInitialized && (
        <>
          {/* Referral Banner - Only show if referral was JUST applied */}
          {hasReferral && userCredits > 0 && !referralNotApplied && (
            <div
              style={{
                background: "rgba(199, 168, 120, 0.2)",
                border: "2px solid #C7A878",
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
                <div style={{ fontWeight: "bold", color: "#222222" }}>
                  {t("welcomeReferred")}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#7C7A67" }}>
                  {t("referralCreditsNote", { amount: (userCredits / 100).toFixed(2) })}
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
                  {t("referralAlreadyUsed")}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#b45309", lineHeight: 1.5 }}>
                  {t("referralAlreadyUsedNote")}
                </div>
              </div>
            </div>
          )}

          {/* Credits Balance */}
          {userCredits > 0 && !hasReferral && (
            <div
              style={{
                background: "rgba(124, 122, 103, 0.1)",
                border: "1px solid #7C7A67",
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: "1.5rem" }}>💰</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", color: "#222222" }}>
                    {t("availableCredits")}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#7C7A67" }}>
                    {t.rich("youHaveCredits", {
                      amount: (userCredits / 100).toFixed(2),
                      bold: (chunks) => <strong style={{ color: "#222" }}>{chunks}</strong>
                    })}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#7C7A67", marginTop: 4 }}>
                    {t("maxCreditsNote")}
                  </div>
                </div>
              </div>

              {/* Checkbox to apply credits */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  padding: 8,
                  background: "white",
                  borderRadius: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={applyCredits}
                  onChange={(e) => setApplyCredits(e.target.checked)}
                  style={{
                    width: 18,
                    height: 18,
                    cursor: "pointer",
                  }}
                />
                <span style={{ fontSize: "0.9rem", color: "#222222" }}>
                  {t("applyToOrder", { amount: Math.min(userCredits, MAX_CREDITS_PER_ORDER) === MAX_CREDITS_PER_ORDER ? '5.00' : (userCredits / 100).toFixed(2) })}
                </span>
              </label>
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
                <span style={{ color: "#666" }}>{t("subtotal")}</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  color: "#7C7A67",
                  fontWeight: "bold",
                }}
              >
                <span>{t("creditsApplied")}</span>
                <span>-${(creditsApplied / 100).toFixed(2)}</span>
              </div>
              {giftApplied > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    color: "#22c55e",
                    fontWeight: "bold",
                  }}
                >
                  <span>🎁 {tMealGift("payment.giftApplied")}</span>
                  <span>-${(giftApplied / 100).toFixed(2)}</span>
                </div>
              )}
              {giftExcess > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    color: "#0284c7",
                    fontSize: "0.9rem",
                  }}
                >
                  <span>💰 {tMealGift("payment.giftExcess")}</span>
                  <span>+${(giftExcess / 100).toFixed(2)}</span>
                </div>
              )}
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
                <span>{t("total")}</span>
                <span>${(discountedTotal / 100).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Method Selection */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 16 }}>{t("paymentMethod")}</h3>

            <div
              style={{
                border: "2px solid #7C7A67",
                borderRadius: 12,
                padding: 20,
                background: "rgba(124, 122, 103, 0.1)",
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
                  <div style={{ fontWeight: "bold" }}>{t("testPayment")}</div>
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                    {t("demoMode")}
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
                ⚠️ {t("demoWarning")}
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
              background: processing || loadingCredits ? "#d1d5db" : "#7C7A67",
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
              ? t("processingPayment")
              : t("payAmount", { amount: (discountedTotal / 100).toFixed(2) })}
          </button>

          <p
            style={{
              textAlign: "center",
              fontSize: "0.75rem",
              color: "#9ca3af",
              marginTop: 16,
            }}
          >
            🔒 {t("secureCheckout")}</p>
        </>
      )}
    </div>
  );
}
