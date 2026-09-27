"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useSiteApi } from "@/lib/site/api";
import { useGuest } from "@/contexts/guest-context";
import { trackBeginCheckout, trackReferralCodeUsed } from "@/lib/analytics";
import { useTranslations } from "next-intl";
import { StripeProvider, PaymentForm, SavedPaymentMethod } from "@/components/payments";
import { PromoCodeInput, type AppliedPromo } from "@/components/PromoCodeInput";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ServerTotals = {
  subtotalCents: number;
  promoDiscountCents: number;
  rewardDiscountCents: number;
  taxCents: number;
  totalCents: number;
  creditsAppliedCents: number;
  mealGiftAppliedCents: number;
  giftCardAppliedCents: number;
  amountDueCents: number;
};

export default function OrderPaymentForm({
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
  const api = useSiteApi();
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
  const [applyCredits, setApplyCredits] = useState(true);
  const initializingRef = useRef(false);
  const MAX_CREDITS_PER_ORDER = 500; // $5.00 limit in cents for food orders

  // Stripe payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);

  // Gift card state
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardApplied, setGiftCardApplied] = useState<{
    id: string;
    code: string;
    balanceCents: number;
    amountToApply: number;
  } | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [giftCardLoading, setGiftCardLoading] = useState(false);

  // Promo code state
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  // Guest checkout form state
  const [guestName, setGuestName] = useState(guest?.name === "Guest" ? "" : guest?.name || "");
  const [guestPhone, setGuestPhone] = useState(guest?.phone || "");
  const [guestEmail, setGuestEmail] = useState(guest?.email || "");
  const [guestSmsOptIn, setGuestSmsOptIn] = useState(guest?.smsOptIn || false);
  const [guestFormError, setGuestFormError] = useState("");

  // Totals come from the server's quote (POST /orders/:id/payment-intent).
  // The browser never computes what is charged; it only shows it.
  const [serverTotals, setServerTotals] = useState<ServerTotals | null>(null);
  const validTotalCents = typeof totalCents === "number" && !isNaN(totalCents) ? totalCents : 0;
  const promoDiscount = serverTotals?.promoDiscountCents ?? 0;
  const creditsApplied = serverTotals?.creditsAppliedCents ?? 0;
  const giftApplied = serverTotals?.mealGiftAppliedCents ?? 0;
  const giftExcess = Math.max(0, mealGiftCredit - giftApplied);
  const giftCardAmount = serverTotals?.giftCardAppliedCents ?? 0;
  const discountedTotal = serverTotals ? serverTotals.amountDueCents : validTotalCents;
  const afterMealGiftTotal = discountedTotal + giftCardAmount;
  const showCreditsBreakdown = promoDiscount > 0 || creditsApplied > 0 || giftApplied > 0 || giftCardAmount > 0;

  function messageForCode(code: string | undefined, fallback?: string) {
    const known = ["CREDIT_SHORT", "GIFT_CARD_SHORT", "MEAL_GIFT_UNAVAILABLE", "REWARD_UNAVAILABLE", "PAYMENT_NOT_VERIFIED"];
    if (code && known.includes(code)) return t(`errorCodes.${code}`);
    return fallback || t("errorCodes.ORDER_FAILED");
  }

  useEffect(() => {
    const referralCode = localStorage.getItem("pendingReferralCode");
    if (referralCode) {
      console.log("Found pending referral code:", referralCode);
    }

    trackBeginCheckout({
      items: [],
      total: totalCents / 100,
    });
  }, [totalCents]);

  // Auto-apply pending gift card from balance page
  useEffect(() => {
    const pendingCode = localStorage.getItem("pendingGiftCardCode");
    if (pendingCode && !giftCardApplied && !giftCardLoading) {
      setGiftCardCode(pendingCode);
      // Trigger auto-apply
      const autoApply = async () => {
        setGiftCardLoading(true);
        setGiftCardError(null);
        try {
          const response = await fetch(`${BASE}/gift-cards/code/${encodeURIComponent(pendingCode.trim())}`);
          if (response.ok) {
            const giftCard = await response.json();
            if (giftCard.balanceCents > 0) {
              const remainingTotal = validTotalCents;
              const amountToApply = Math.min(giftCard.balanceCents, remainingTotal);
              setGiftCardApplied({
                id: giftCard.id,
                code: giftCard.code,
                balanceCents: giftCard.balanceCents,
                amountToApply,
              });
              setGiftCardCode("");
            }
          }
          // Clear from storage after attempting to apply
          localStorage.removeItem("pendingGiftCardCode");
        } catch (err) {
          console.error("Error auto-applying gift card:", err);
        } finally {
          setGiftCardLoading(false);
        }
      };
      autoApply();
    }
  }, [validTotalCents]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user && !userInitialized && !initializingRef.current) {
      initializeUser();
    }
  }, [isLoaded, isSignedIn, user, userInitialized]);

  // Fetch meal gift credit if mealGiftId is provided
  useEffect(() => {
    async function fetchMealGift() {
      try {
        const response = await fetch(`${BASE}/meal-gifts/${mealGiftId}`, {
          headers: { "x-tenant-slug": "oh" },
        });

        if (response.ok) {
          const giftData = await response.json();
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

  // Re-quote the order with the chosen savings and get a PaymentIntent for
  // the server's amount due (Task A6). Nothing is spent until payment is
  // confirmed; credits, gift cards and meal gifts are applied at PAID.
  const wantsCredits = Boolean(userId) && applyCredits;
  const promoCodeValue = appliedPromo?.code ?? null;
  const giftCardCodeValue = giftCardApplied?.code ?? null;
  const refreshPayment = useCallback(async () => {
    const request = (useCreditsCents: number) =>
      api(`${BASE}/orders/${orderId}/payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useCreditsCents,
          promoCode: promoCodeValue,
          giftCardCode: giftCardCodeValue,
          mealGiftId: mealGiftId ?? null,
        }),
      });

    try {
      let response = await request(wantsCredits ? MAX_CREDITS_PER_ORDER : 0);
      // An order started before signing in can't take member credits.
      if (response.status === 403 && wantsCredits) response = await request(0);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(messageForCode(data.error));
        return;
      }
      setServerTotals(data.totals ?? null);
      setClientSecret(data.clientSecret ?? null);
      setPaymentIntentId(data.paymentIntentId ?? null);
    } catch (err) {
      console.error("Error creating payment intent:", err);
      setError(messageForCode(undefined));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, wantsCredits, promoCodeValue, giftCardCodeValue, mealGiftId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && !userInitialized) return;
    if (!isSignedIn && !(isGuest && guest)) return;
    refreshPayment();
  }, [isLoaded, isSignedIn, userInitialized, isGuest, guest?.id, refreshPayment]);

  /** POST /orders/:id/confirm-payment: the server verifies the PaymentIntent (or a zero balance). */
  async function confirmPaid(stripePaymentIntentId?: string) {
    const response = await api(`${BASE}/orders/${orderId}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId: stripePaymentIntentId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(messageForCode(data.error));
    return data;
  }

  async function initializeUser() {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    setLoadingCredits(true);

    try {
      const referralCode = localStorage.getItem("pendingReferralCode");

      // Create or get user in our system
      const userResponse = await api(`${BASE}/users`, {
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
      setUserId(userData.id);
      setUserCredits(userData.creditsCents || 0);
      localStorage.setItem("userId", userData.id);
      localStorage.setItem("referralCode", userData.referralCode);
      setUserInitialized(true);

      // Get or create Stripe customer
      try {
        const customerResponse = await api(`${BASE}/users/${userData.id}/stripe-customer`, {
          method: "POST",
        });

        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          setStripeCustomerId(customerData.customerId);

          // Fetch saved payment methods
          const methodsResponse = await api(`${BASE}/users/${userData.id}/payment-methods`);
          if (methodsResponse.ok) {
            const methods = await methodsResponse.json();
            setSavedPaymentMethods(methods);
          }
        }
      } catch (stripeErr) {
        console.warn("Could not initialize Stripe customer:", stripeErr);
      }

      // Check if referral code was provided but not applied
      if (referralCode && !userData.referralJustApplied && userData.referredById) {
        setReferralNotApplied(true);
      }

      if (userData.referralJustApplied) {
        setHasReferral(true);
        if (referralCode) {
          trackReferralCodeUsed(referralCode);
        }
      }

      if (referralCode) {
        localStorage.removeItem("pendingReferralCode");
      }

      setLoadingCredits(false);
      initializingRef.current = false;
    } catch (err: any) {
      console.error("Failed to initialize user:", err);
      setError(err.message || "Failed to load user account");
      setLoadingCredits(false);
      initializingRef.current = false;
    }
  }

  // Apply gift card code
  async function handleApplyGiftCard() {
    if (!giftCardCode.trim()) return;

    setGiftCardLoading(true);
    setGiftCardError(null);

    try {
      const response = await fetch(`${BASE}/gift-cards/code/${giftCardCode.trim()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gift card not found");
      }

      const giftCard = await response.json();
      if (giftCard.balanceCents <= 0) {
        throw new Error("This gift card has no remaining balance");
      }

      // Calculate how much to apply (limited to remaining order total)
      const remainingTotal = afterMealGiftTotal;
      const amountToApply = Math.min(giftCard.balanceCents, remainingTotal);

      setGiftCardApplied({
        id: giftCard.id,
        code: giftCard.code,
        balanceCents: giftCard.balanceCents,
        amountToApply,
      });
      setGiftCardCode("");
    } catch (err) {
      setGiftCardError(err instanceof Error ? err.message : "Failed to apply gift card");
    } finally {
      setGiftCardLoading(false);
    }
  }
  // Handle successful Stripe payment
  async function handlePaymentSuccess(stripePaymentIntentId: string) {
    setProcessing(true);
    setError("");

    try {
      // The server verifies the PaymentIntent, spends the credits, gift card
      // and meal gift on the quote, and marks the order PAID (once).
      const updatedOrder = await confirmPaid(stripePaymentIntentId);
      localStorage.removeItem("mealGiftMessage");

      router.push(
        `/order/confirmation?orderId=${orderId}&orderNumber=${orderNumber}&total=${updatedOrder.totalCents}&paid=true`
      );
    } catch (err: any) {
      setError(err.message || messageForCode(undefined));
      setProcessing(false);
    }
  }

  // Handle free order (fully covered by credits/gifts, verified by the server)
  async function handleFreeOrder() {
    if (discountedTotal > 0) {
      setError(messageForCode(undefined));
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const updatedOrder = await confirmPaid();
      localStorage.removeItem("mealGiftMessage");

      router.push(
        `/order/confirmation?orderId=${orderId}&orderNumber=${orderNumber}&total=${updatedOrder.totalCents}&paid=true`
      );
    } catch (err: any) {
      setError(err.message || messageForCode(undefined));
      setProcessing(false);
    }
  }

  async function saveGuestDetails() {
    if (guest && (guestName !== guest.name || guestPhone !== guest.phone || guestEmail !== guest.email || guestSmsOptIn !== guest.smsOptIn)) {
      await updateGuest({
        name: guestName.trim(),
        phone: guestPhone.trim() || undefined,
        email: guestEmail.trim() || undefined,
        smsOptIn: guestPhone.trim() ? guestSmsOptIn : false,
      });
    }
    // Link the guest to the order (PATCH still accepts guestId; never payment fields).
    if (guest?.id) {
      await fetch(`${BASE}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: guest.id }),
      }).catch(() => undefined);
    }
  }

  // Handle guest payment success (Stripe) or a guest's fully covered order (no PaymentIntent)
  async function handleGuestPaymentSuccess(stripePaymentIntentId?: string) {
    setProcessing(true);
    setError("");

    try {
      await saveGuestDetails();
      const updatedOrder = await confirmPaid(stripePaymentIntentId);
      localStorage.removeItem("mealGiftMessage");

      router.push(
        `/order/confirmation?orderId=${orderId}&orderNumber=${orderNumber}&total=${updatedOrder.totalCents}&paid=true`
      );
    } catch (err: any) {
      setError(err.message || messageForCode(undefined));
      setProcessing(false);
    }
  }

  function handlePaymentError(errorMessage: string) {
    setError(errorMessage);
    setProcessing(false);
  }

  // Loading state
  if (!isLoaded) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: 16 }}>⏳</div>
        <p style={{ color: "#666" }}>{t("loading")}</p>
      </div>
    );
  }

  // Guest checkout
  if (!isSignedIn) {
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

              {/* SMS Consent Checkbox */}
              {guestPhone.trim() && (
                <div style={{ marginTop: 4 }}>
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
                      checked={guestSmsOptIn}
                      onChange={(e) => setGuestSmsOptIn(e.target.checked)}
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
              )}
            </div>
          </div>

          {/* Promo Code for Guests */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <img
                src="/Oh_Logo_Large.png"
                alt="Oh!"
                style={{
                  width: 20,
                  height: 20,
                  objectFit: "contain",
                  opacity: 0.85,
                }}
              />
              <span style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>Have a promo code?</span>
            </div>
            <PromoCodeInput
              scope="MENU"
              subtotalCents={validTotalCents}
              guestId={guest?.id}
              onApply={(promo) => setAppliedPromo(promo)}
              onRemove={() => setAppliedPromo(null)}
              appliedPromo={appliedPromo}
              placeholder="Enter promo code"
            />
          </div>

          {/* Order Total with Promo for Guests */}
          {promoDiscount > 0 && appliedPromo && (
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "12px 14px",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#666" }}>{t("subtotal")}</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  color: "#16a34a",
                  fontWeight: "bold",
                }}
              >
                <span>🏷️ Promo ({appliedPromo.code})</span>
                <span>-${(promoDiscount / 100).toFixed(2)}</span>
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
                <span>{t("total")}</span>
                <span>${(discountedTotal / 100).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>{t("paymentMethod")}</h3>

            {!guestName.trim() ? (
              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fbbf24",
                  borderRadius: 8,
                  padding: 16,
                  color: "#92400e",
                  textAlign: "center",
                }}
              >
                Please enter your name above to continue with payment
              </div>
            ) : discountedTotal === 0 && promoDiscount > 0 ? (
              /* Free order - promo covers full amount for guest */
              <div>
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "2px solid #22c55e",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎉</div>
                  <div style={{ fontWeight: "bold", color: "#15803d", marginBottom: 4 }}>
                    Your order is fully covered!
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#166534" }}>
                    No payment required - your promo code covers the full amount.
                  </div>
                </div>
                <button
                  onClick={() => handleGuestPaymentSuccess()}
                  disabled={processing || !guestName.trim()}
                  style={{
                    width: "100%",
                    padding: 16,
                    background: processing || !guestName.trim() ? "#d1d5db" : "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: 12,
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                    cursor: processing || !guestName.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {processing ? "Processing..." : "Complete Order"}
                </button>
              </div>
            ) : clientSecret ? (
              <StripeProvider key={clientSecret} clientSecret={clientSecret}>
                <PaymentForm
                  amountCents={discountedTotal}
                  onSuccess={handleGuestPaymentSuccess}
                  onError={handlePaymentError}
                  onProcessingChange={setProcessing}
                  showExpressCheckout={true}
                  showSaveCard={false}
                  returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/order/confirmation?orderId=${orderId}&orderNumber=${orderNumber}&paid=true`}
                  disabled={processing || !guestName.trim()}
                />
              </StripeProvider>
            ) : (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>⏳</div>
                <p style={{ color: "#666" }}>Loading payment form...</p>
              </div>
            )}
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

    // Sign-in prompt (no guest session)
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
          <p style={{ color: "#666", margin: 0 }}>{t("loadingAccount")}</p>
        </div>
      )}

      {userInitialized && (
        <>
          {/* Referral Banner */}
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
                <div style={{ fontWeight: "bold", color: "#222222" }}>{t("welcomeReferred")}</div>
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
                <div style={{ fontWeight: "bold", color: "#92400e" }}>{t("referralAlreadyUsed")}</div>
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
                  <div style={{ fontWeight: "bold", color: "#222222" }}>{t("availableCredits")}</div>
                  <div style={{ fontSize: "0.85rem", color: "#7C7A67" }}>
                    {t.rich("youHaveCredits", {
                      amount: (userCredits / 100).toFixed(2),
                      bold: (chunks) => <strong style={{ color: "#222" }}>{chunks}</strong>,
                    })}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#7C7A67", marginTop: 4 }}>
                    {t("maxCreditsNote")}
                  </div>
                </div>
              </div>

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
                  {t("applyToOrder", {
                    amount:
                      Math.min(userCredits, MAX_CREDITS_PER_ORDER) === MAX_CREDITS_PER_ORDER
                        ? "5.00"
                        : (userCredits / 100).toFixed(2),
                  })}
                </span>
              </label>
            </div>
          )}

          {/* Promo Code Entry */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <img
                src="/Oh_Logo_Large.png"
                alt="Oh!"
                style={{
                  width: 20,
                  height: 20,
                  objectFit: "contain",
                  opacity: 0.85,
                }}
              />
              <span style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>Have a promo code?</span>
            </div>
            <PromoCodeInput
              scope="MENU"
              subtotalCents={validTotalCents}
              userId={userId || undefined}
              guestId={guest?.id}
              onApply={(promo) => setAppliedPromo(promo)}
              onRemove={() => setAppliedPromo(null)}
              appliedPromo={appliedPromo}
              placeholder="Enter promo code"
            />
          </div>

          {/* Gift Card Code Entry */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {/* Mini gift card visual with Oh! logo */}
              <div
                style={{
                  width: 32,
                  height: 20,
                  borderRadius: 3,
                  background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
                <img
                  src="/Oh_Logo_Large.png"
                  alt="Oh!"
                  style={{
                    width: 16,
                    height: 16,
                    objectFit: "contain",
                    filter: "brightness(0) invert(1)",
                    opacity: 0.9,
                    position: "relative",
                  }}
                />
              </div>
              <span style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>Have a gift card?</span>
            </div>

            {giftCardApplied ? (
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid #22c55e",
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: "600", color: "#15803d" }}>
                    Gift card applied!
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#166534" }}>
                    Code: {giftCardApplied.code} • -${(giftCardApplied.amountToApply / 100).toFixed(2)}
                  </div>
                </div>
                <button
                  onClick={() => setGiftCardApplied(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: "500",
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                    placeholder="Enter gift card code"
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      border: giftCardError ? "1px solid #ef4444" : "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: "14px",
                      letterSpacing: "0.5px",
                      outline: "none",
                    }}
                    disabled={giftCardLoading}
                  />
                  <button
                    onClick={handleApplyGiftCard}
                    disabled={!giftCardCode.trim() || giftCardLoading}
                    style={{
                      padding: "12px 20px",
                      background: "#5A5847",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: giftCardCode.trim() && !giftCardLoading ? "pointer" : "not-allowed",
                      minWidth: 80,
                      opacity: !giftCardCode.trim() || giftCardLoading ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {giftCardLoading ? "..." : "Apply"}
                  </button>
                </div>
                {giftCardError && (
                  <p style={{ color: "#ef4444", fontSize: "0.85rem", marginTop: 8, marginBottom: 0 }}>
                    {giftCardError}
                  </p>
                )}
              </div>
            )}
          </div>

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
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#666" }}>{t("subtotal")}</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
              {promoDiscount > 0 && appliedPromo && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    color: "#16a34a",
                    fontWeight: "bold",
                  }}
                >
                  <span>🏷️ Promo ({appliedPromo.code})</span>
                  <span>-${(promoDiscount / 100).toFixed(2)}</span>
                </div>
              )}
              {creditsApplied > 0 && (
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
              )}
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
              {giftCardAmount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    color: "#7C7A67",
                    fontWeight: "bold",
                  }}
                >
                  <span>🎁 Gift Card</span>
                  <span>-${(giftCardAmount / 100).toFixed(2)}</span>
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

          {/* Payment Method Section */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 16 }}>{t("paymentMethod")}</h3>

            {/* Free order - fully covered by credits/gifts */}
            {discountedTotal === 0 ? (
              <div>
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "2px solid #22c55e",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎉</div>
                  <div style={{ fontWeight: "bold", color: "#15803d", marginBottom: 4 }}>
                    Your order is fully covered!
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#166534" }}>
                    No payment required - your credits and gifts cover the full amount.
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
                  onClick={handleFreeOrder}
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
                  {processing ? t("processingPayment") : "Complete Order"}
                </button>
              </div>
            ) : clientSecret ? (
              <StripeProvider key={clientSecret} clientSecret={clientSecret}>
                <PaymentForm
                  amountCents={discountedTotal}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onProcessingChange={setProcessing}
                  showExpressCheckout={true}
                  showSaveCard={!!stripeCustomerId}
                  savedPaymentMethods={savedPaymentMethods}
                  returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/order/confirmation?orderId=${orderId}&orderNumber=${orderNumber}&paid=true`}
                  disabled={processing || loadingCredits}
                />
              </StripeProvider>
            ) : (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>⏳</div>
                <p style={{ color: "#666" }}>Loading payment form...</p>
              </div>
            )}
          </div>

          {error && discountedTotal > 0 && (
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
        </>
      )}
    </div>
  );
}
