"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useUser } from "@clerk/nextjs";
import { useGuest } from "@/contexts/guest-context";
import { useCart } from "@/contexts/cart-context";
import { StripeProvider, PaymentForm, type SavedPaymentMethod } from "@/components/payments";
import { PromoCodeInput, type AppliedPromo } from "@/components/PromoCodeInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface UserCredits {
  referralCredits: number;
  giftCreditsReceived: number;
  totalCredits: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("store");
  const tCommon = useTranslations("common");
  const { user, isLoaded: clerkLoaded } = useUser();
  const { guestId, isGuest } = useGuest();
  const { items, itemCount, subtotalCents, clearCart } = useCart();

  // Track if order completed successfully (to prevent redirect race condition)
  const [orderCompleted, setOrderCompleted] = useState(false);

  // Redirect if cart is empty (but not if order just completed)
  useEffect(() => {
    if (items.length === 0 && !orderCompleted) {
      router.push(`/${locale}/store`);
    }
  }, [items.length, router, locale, orderCompleted]);

  // Shipping form
  const [shippingName, setShippingName] = useState("");
  const [shippingEmail, setShippingEmail] = useState("");
  const [shippingAddress1, setShippingAddress1] = useState("");
  const [shippingAddress2, setShippingAddress2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingZip, setShippingZip] = useState("");

  // Credits & Gift Cards
  const [applyCredits, setApplyCredits] = useState(true);
  const [userCredits, setUserCredits] = useState<UserCredits | null>(null);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardApplied, setGiftCardApplied] = useState<{
    id: string;
    code: string;
    balanceCents: number;
    amountToApply: number;
  } | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [giftCardLoading, setGiftCardLoading] = useState(false);

  // Promo Code
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  // Payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // UI state
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate totals
  const shippingCents = subtotalCents >= 7500 ? 0 : 799;
  const taxCents = Math.round(subtotalCents * 0.0825);

  // Promo discount applied (applies to subtotal, or shipping for FREE_SHIPPING)
  const promoDiscount = appliedPromo?.discountCents || 0;
  const effectiveShipping = appliedPromo?.discountType === 'FREE_SHIPPING' ? 0 : shippingCents;

  const orderTotalCents = subtotalCents + effectiveShipping + taxCents - (appliedPromo?.discountType !== 'FREE_SHIPPING' ? promoDiscount : 0);

  // Credits applied (UNLIMITED for shop orders)
  const creditsToApply = applyCredits && userCredits
    ? Math.min(userCredits.totalCredits, orderTotalCents)
    : 0;

  // Gift card applied
  const giftCardToApply = giftCardApplied?.amountToApply || 0;

  // Amount after all discounts
  const amountAfterCredits = orderTotalCents - creditsToApply - giftCardToApply;

  // Pre-fill email for signed-in users
  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setShippingEmail(user.primaryEmailAddress.emailAddress);
    }
    if (user?.fullName) {
      setShippingName(user.fullName);
    }
  }, [user]);

  // Internal user ID from our database
  const [internalUserId, setInternalUserId] = useState<string | null>(null);

  // Fetch user credits and saved payment methods
  useEffect(() => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    const fetchUserData = async () => {
      try {
        // Create or get user in our system (same pattern as order payment)
        const userRes = await fetch(`${API_URL}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.primaryEmailAddress?.emailAddress,
            name: user.fullName || user.firstName || undefined,
          }),
        });

        if (!userRes.ok) {
          console.error("Failed to initialize user");
          return;
        }

        const userData = await userRes.json();
        setInternalUserId(userData.id);
        setUserCredits({
          referralCredits: userData.creditsCents || 0,
          giftCreditsReceived: 0,
          totalCredits: userData.creditsCents || 0,
        });

        // Fetch or create Stripe customer
        const customerRes = await fetch(`${API_URL}/users/${userData.id}/stripe-customer`, {
          method: "POST",
        });
        if (customerRes.ok) {
          const customerData = await customerRes.json();
          setStripeCustomerId(customerData.customerId);
        }

        // Fetch saved payment methods
        const methodsRes = await fetch(`${API_URL}/users/${userData.id}/payment-methods`);
        if (methodsRes.ok) {
          const methods = await methodsRes.json();
          setSavedPaymentMethods(methods);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchUserData();
  }, [user?.primaryEmailAddress?.emailAddress, user?.fullName, user?.firstName]);

  // Create PaymentIntent when amount changes
  const createPaymentIntent = useCallback(async () => {
    if (amountAfterCredits <= 0) {
      setClientSecret(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: amountAfterCredits,
          customerId: stripeCustomerId,
          metadata: {
            type: "shop_order",
            itemCount: itemCount.toString(),
            subtotalCents: subtotalCents.toString(),
            creditsApplied: creditsToApply.toString(),
            giftCardApplied: giftCardToApply.toString(),
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to create payment intent");

      const data = await res.json();
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.id);
    } catch (err) {
      console.error("Error creating payment intent:", err);
      setError("Failed to initialize payment. Please try again.");
    }
  }, [amountAfterCredits, stripeCustomerId, itemCount, subtotalCents, creditsToApply, giftCardToApply]);

  useEffect(() => {
    // Only create payment intent once we have customer ID (or for guest checkout)
    // Don't create if we already have a clientSecret to avoid duplicate intents
    if (amountAfterCredits > 0 && !clientSecret && (stripeCustomerId || isGuest)) {
      createPaymentIntent();
    } else if (amountAfterCredits <= 0) {
      setClientSecret(null);
    }
  }, [amountAfterCredits, stripeCustomerId, isGuest, clientSecret, createPaymentIntent]);

  // Apply gift card
  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) return;

    setGiftCardLoading(true);
    setGiftCardError(null);

    try {
      const res = await fetch(`${API_URL}/gift-cards/code/${giftCardCode.trim()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gift card not found");
      }

      const giftCard = await res.json();
      if (giftCard.balanceCents <= 0) {
        throw new Error("This gift card has no remaining balance");
      }

      const amountToApply = Math.min(giftCard.balanceCents, orderTotalCents - creditsToApply);
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
  };

  // Validate shipping form
  const isShippingValid =
    shippingName.trim().length > 0 &&
    shippingEmail.includes("@") &&
    shippingAddress1.trim().length > 0 &&
    shippingCity.trim().length > 0 &&
    shippingState.trim().length > 0 &&
    shippingZip.trim().length >= 5;

  // Handle free purchase (credits/gift cards cover full amount)
  const handleFreePurchase = async () => {
    if (!isShippingValid) {
      setError("Please complete shipping information");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/shop/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: internalUserId,
          guestId: isGuest ? guestId : undefined,
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            priceCents: item.priceCents,
            variant: item.variant,
          })),
          subtotalCents,
          shippingCents: effectiveShipping,
          taxCents,
          totalCents: orderTotalCents,
          creditsToApply: creditsToApply,
          giftCardId: giftCardApplied?.id,
          promoCodeId: appliedPromo?.id,
          promoDiscountCents: promoDiscount,
          fulfillmentType: "SHIPPING",
          shipping: {
            name: shippingName,
            email: shippingEmail,
            address1: shippingAddress1,
            address2: shippingAddress2,
            city: shippingCity,
            state: shippingState,
            zip: shippingZip,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create order");
      }

      const order = await res.json();
      setOrderCompleted(true); // Prevent empty cart redirect
      clearCart();
      router.push(`/${locale}/store/confirmation/${order.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setProcessing(false);
    }
  };

  // Handle Stripe payment success
  const handlePaymentSuccess = async (stripePaymentIntentId: string) => {
    if (!isShippingValid) {
      setError("Please complete shipping information");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/shop/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: internalUserId,
          guestId: isGuest ? guestId : undefined,
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            priceCents: item.priceCents,
            variant: item.variant,
          })),
          subtotalCents,
          shippingCents: effectiveShipping,
          taxCents,
          totalCents: orderTotalCents,
          creditsToApply: creditsToApply,
          giftCardId: giftCardApplied?.id,
          promoCodeId: appliedPromo?.id,
          promoDiscountCents: promoDiscount,
          stripePaymentId: stripePaymentIntentId,
          fulfillmentType: "SHIPPING",
          shipping: {
            name: shippingName,
            email: shippingEmail,
            address1: shippingAddress1,
            address2: shippingAddress2,
            city: shippingCity,
            state: shippingState,
            zip: shippingZip,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create order");
      }

      const order = await res.json();
      setOrderCompleted(true); // Prevent empty cart redirect
      clearCart();
      router.push(`/${locale}/store/confirmation/${order.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (items.length === 0) {
    return null; // Will redirect
  }

  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#222", padding: "80px 24px 40px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <Link
            href={`/${locale}/store/cart`}
            style={{
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
              fontSize: "0.9rem",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Cart
          </Link>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              color: "white",
              letterSpacing: "1px",
            }}
          >
            Checkout
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Error Display */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "24px",
              color: "#dc2626",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "32px" }} className="checkout-grid">
          {/* Main Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Shipping Information */}
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Shipping Information
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={shippingName}
                    onChange={(e) => setShippingName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      fontSize: "1rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={shippingEmail}
                    onChange={(e) => setShippingEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      fontSize: "1rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress1}
                    onChange={(e) => setShippingAddress1(e.target.value)}
                    placeholder="Street address"
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      fontSize: "1rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={shippingAddress2}
                    onChange={(e) => setShippingAddress2(e.target.value)}
                    placeholder="Apt, suite, unit (optional)"
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      fontSize: "1rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                    City *
                  </label>
                  <input
                    type="text"
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      fontSize: "1rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                      State *
                    </label>
                    <input
                      type="text"
                      value={shippingState}
                      onChange={(e) => setShippingState(e.target.value)}
                      maxLength={2}
                      placeholder="UT"
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        border: "2px solid #e5e7eb",
                        borderRadius: "10px",
                        fontSize: "1rem",
                        outline: "none",
                        textTransform: "uppercase",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                      ZIP *
                    </label>
                    <input
                      type="text"
                      value={shippingZip}
                      onChange={(e) => setShippingZip(e.target.value)}
                      maxLength={10}
                      placeholder="84101"
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        border: "2px solid #e5e7eb",
                        borderRadius: "10px",
                        fontSize: "1rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Credits & Gift Cards */}
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Discounts
              </h2>

              {/* Promo Code Section */}
              <div style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #e5e7eb" }}>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                  Promo Code
                </label>
                <PromoCodeInput
                  scope="SHOP"
                  subtotalCents={subtotalCents}
                  userId={internalUserId || undefined}
                  guestId={isGuest ? guestId || undefined : undefined}
                  shippingCents={shippingCents}
                  onApply={(promo) => setAppliedPromo(promo)}
                  onRemove={() => setAppliedPromo(null)}
                  appliedPromo={appliedPromo}
                  placeholder="Enter promo code"
                />
              </div>

              {/* Credits Section */}
              {user && userCredits && userCredits.totalCredits > 0 && (
                <div style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #e5e7eb" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={applyCredits}
                        onChange={(e) => setApplyCredits(e.target.checked)}
                        style={{ width: "18px", height: "18px", accentColor: "#7C7A67" }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", color: "#222" }}>Apply Credits (No Limit)</div>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>
                          Available: ${(userCredits.totalCredits / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    {applyCredits && (
                      <div style={{ color: "#16a34a", fontWeight: "500" }}>
                        -${(creditsToApply / 100).toFixed(2)}
                      </div>
                    )}
                  </label>
                </div>
              )}

              {/* Gift Card Section */}
              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                  Gift Card Code
                </label>
                {giftCardApplied ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: "#dcfce7",
                      borderRadius: "10px",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: "500", color: "#166534" }}>
                        {giftCardApplied.code}
                      </span>
                      <span style={{ color: "#166534", marginLeft: "8px" }}>
                        -${(giftCardApplied.amountToApply / 100).toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => setGiftCardApplied(null)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#166534",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "12px" }}>
                    <input
                      type="text"
                      value={giftCardCode}
                      onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      style={{
                        flex: 1,
                        padding: "14px 16px",
                        border: "2px solid #e5e7eb",
                        borderRadius: "10px",
                        fontSize: "1rem",
                        outline: "none",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                      }}
                    />
                    <button
                      onClick={handleApplyGiftCard}
                      disabled={!giftCardCode.trim() || giftCardLoading}
                      style={{
                        padding: "14px 24px",
                        background: giftCardCode.trim() ? "#7C7A67" : "#e5e7eb",
                        color: giftCardCode.trim() ? "white" : "#9ca3af",
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "0.95rem",
                        fontWeight: "600",
                        cursor: giftCardCode.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      {giftCardLoading ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {giftCardError && (
                  <p style={{ color: "#dc2626", fontSize: "0.85rem", marginTop: "8px" }}>
                    {giftCardError}
                  </p>
                )}
              </div>
            </div>

            {/* Payment */}
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Payment
              </h2>

              {amountAfterCredits <= 0 ? (
                <div>
                  <div style={{ textAlign: "center", padding: "24px" }}>
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        background: "#dcfce7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                      }}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </div>
                    <p style={{ color: "#222", fontWeight: "500", marginBottom: "8px" }}>
                      Your credits and gift cards cover the full amount!
                    </p>
                    <p style={{ color: "#666", fontSize: "0.9rem" }}>
                      No additional payment needed.
                    </p>
                  </div>

                  <button
                    onClick={handleFreePurchase}
                    disabled={processing || !isShippingValid}
                    style={{
                      width: "100%",
                      padding: "18px",
                      background: processing || !isShippingValid ? "#d1d5db" : "#7C7A67",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      cursor: processing || !isShippingValid ? "not-allowed" : "pointer",
                    }}
                  >
                    {processing ? "Processing..." : "Place Order"}
                  </button>
                  {!isShippingValid && (
                    <p style={{ color: "#dc2626", fontSize: "0.85rem", marginTop: "8px", textAlign: "center" }}>
                      Please complete shipping information
                    </p>
                  )}
                </div>
              ) : clientSecret ? (
                <StripeProvider clientSecret={clientSecret}>
                  <PaymentForm
                    amountCents={amountAfterCredits}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    showExpressCheckout={true}
                    showSaveCard={!!stripeCustomerId}
                    savedPaymentMethods={savedPaymentMethods}
                    returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/store/checkout?complete=true`}
                    disabled={processing || !isShippingValid}
                  />
                </StripeProvider>
              ) : (
                <div style={{ textAlign: "center", padding: "32px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      border: "3px solid #e5e7eb",
                      borderTopColor: "#7C7A67",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                      margin: "0 auto",
                    }}
                  />
                  <p style={{ color: "#666", marginTop: "12px" }}>Loading payment options...</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div>
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", position: "sticky", top: "24px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Order Summary
              </h2>

              {/* Items */}
              <div style={{ marginBottom: "20px", maxHeight: "300px", overflowY: "auto" }}>
                {items.map((item) => (
                  <div
                    key={`${item.id}-${item.variant || ""}`}
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "12px",
                      paddingBottom: "12px",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "60px",
                        height: "60px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "#f3f4f6",
                        flexShrink: 0,
                      }}
                    >
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          sizes="60px"
                          style={{ objectFit: "cover" }}
                        />
                      )}
                      <span
                        style={{
                          position: "absolute",
                          top: "-6px",
                          right: "-6px",
                          background: "#7C7A67",
                          color: "white",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {item.quantity}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.9rem", fontWeight: "500", color: "#222", marginBottom: "2px" }}>
                        {item.name}
                      </p>
                      {item.variant && (
                        <p style={{ fontSize: "0.8rem", color: "#666" }}>{item.variant}</p>
                      )}
                    </div>
                    <span style={{ fontWeight: "500", color: "#222", fontSize: "0.9rem" }}>
                      ${((item.priceCents * item.quantity) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666", fontSize: "0.95rem" }}>Subtotal</span>
                  <span style={{ fontWeight: "500" }}>${(subtotalCents / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666", fontSize: "0.95rem" }}>Shipping</span>
                  <span style={{ fontWeight: "500", color: effectiveShipping === 0 ? "#16a34a" : undefined }}>
                    {effectiveShipping === 0 ? "FREE" : `$${(effectiveShipping / 100).toFixed(2)}`}
                    {appliedPromo?.discountType === 'FREE_SHIPPING' && shippingCents > 0 && (
                      <span style={{ textDecoration: "line-through", color: "#9ca3af", marginLeft: "8px" }}>
                        ${(shippingCents / 100).toFixed(2)}
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666", fontSize: "0.95rem" }}>Tax</span>
                  <span style={{ fontWeight: "500" }}>${(taxCents / 100).toFixed(2)}</span>
                </div>
                {promoDiscount > 0 && appliedPromo?.discountType !== 'FREE_SHIPPING' && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#16a34a", fontSize: "0.95rem" }}>
                      Promo ({appliedPromo?.code})
                    </span>
                    <span style={{ fontWeight: "500", color: "#16a34a" }}>
                      -${(promoDiscount / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {creditsToApply > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#16a34a", fontSize: "0.95rem" }}>Credits Applied</span>
                    <span style={{ fontWeight: "500", color: "#16a34a" }}>
                      -${(creditsToApply / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {giftCardToApply > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#16a34a", fontSize: "0.95rem" }}>Gift Card</span>
                    <span style={{ fontWeight: "500", color: "#16a34a" }}>
                      -${(giftCardToApply / 100).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "16px",
                  borderTop: "2px solid #e5e7eb",
                }}
              >
                <span style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222" }}>Total</span>
                <span style={{ fontSize: "1.25rem", fontWeight: "700", color: "#7C7A67" }}>
                  ${(amountAfterCredits / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <style jsx global>{`
        @media (min-width: 900px) {
          .checkout-grid {
            grid-template-columns: 1fr 380px !important;
          }
        }
      `}</style>
    </div>
  );
}
