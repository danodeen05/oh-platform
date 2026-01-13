"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useGuest } from "@/contexts/guest-context";
import { StripeProvider, PaymentForm, type SavedPaymentMethod } from "@/components/payments";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string;
  stockCount: number | null;
  isAvailable: boolean;
}

interface UserCredits {
  referralCredits: number;
  giftCreditsReceived: number;
  totalCredits: number;
}

interface Props {
  params: Promise<{ qrCode: string }>;
}

export default function InStoreItemPage({ params }: Props) {
  const { qrCode } = use(params);
  const router = useRouter();
  const locale = useLocale();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { guestId, isGuest, startGuestSession } = useGuest();

  // Product state
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Credits & Payment
  const [applyCredits, setApplyCredits] = useState(true);
  const [userCredits, setUserCredits] = useState<UserCredits | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);

  // UI state
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // Fetch product by QR code
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_URL}/shop/products/qr/${qrCode}`);
        if (!res.ok) {
          if (res.status === 404) {
            setNotFound(true);
          }
          return;
        }
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error("Error fetching product:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [qrCode]);

  // Internal user ID from our database
  const [internalUserId, setInternalUserId] = useState<string | null>(null);

  // Fetch user data
  useEffect(() => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    const fetchUserData = async () => {
      try {
        // Create or get user in our system
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

        const customerRes = await fetch(`${API_URL}/users/${userData.id}/stripe-customer`, {
          method: "POST",
        });
        if (customerRes.ok) {
          const customerData = await customerRes.json();
          setStripeCustomerId(customerData.customerId);
        }

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

  // Calculate totals
  const subtotalCents = product ? product.priceCents * quantity : 0;
  const taxCents = Math.round(subtotalCents * 0.0825);
  const totalCents = subtotalCents + taxCents;

  // Credits applied (UNLIMITED for in-store)
  const creditsToApply = applyCredits && userCredits
    ? Math.min(userCredits.totalCredits, totalCents)
    : 0;
  const amountAfterCredits = totalCents - creditsToApply;

  // Create PaymentIntent
  const createPaymentIntent = useCallback(async () => {
    if (amountAfterCredits <= 0 || !product) {
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
            type: "shop_order_instore",
            productId: product.id,
            quantity: quantity.toString(),
            creditsApplied: creditsToApply.toString(),
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to create payment intent");

      const data = await res.json();
      setClientSecret(data.clientSecret);
    } catch (err) {
      console.error("Error creating payment intent:", err);
      setError("Failed to initialize payment. Please try again.");
    }
  }, [amountAfterCredits, stripeCustomerId, product, quantity, creditsToApply]);

  useEffect(() => {
    if (product && (user || isGuest) && amountAfterCredits > 0) {
      createPaymentIntent();
    } else {
      setClientSecret(null);
    }
  }, [product, user, isGuest, amountAfterCredits, createPaymentIntent]);

  // Handle guest checkout
  const handleGuestCheckout = async () => {
    await startGuestSession();
  };

  // Handle free purchase
  const handleFreePurchase = async () => {
    if (!product) return;

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/shop/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: internalUserId,
          guestId: isGuest ? guestId : undefined,
          items: [{
            productId: product.id,
            quantity,
            priceCents: product.priceCents,
          }],
          subtotalCents,
          shippingCents: 0,
          taxCents,
          totalCents,
          creditsApplied: creditsToApply,
          fulfillmentType: "IN_STORE_PICKUP",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create order");
      }

      const order = await res.json();
      setOrderNumber(order.orderNumber);
      setPurchaseComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setProcessing(false);
    }
  };

  // Handle Stripe payment success
  const handlePaymentSuccess = async (stripePaymentIntentId: string) => {
    if (!product) return;

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/shop/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: internalUserId,
          guestId: isGuest ? guestId : undefined,
          items: [{
            productId: product.id,
            quantity,
            priceCents: product.priceCents,
          }],
          subtotalCents,
          shippingCents: 0,
          taxCents,
          totalCents,
          creditsApplied: creditsToApply,
          stripePaymentId: stripePaymentIntentId,
          fulfillmentType: "IN_STORE_PICKUP",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create order");
      }

      const order = await res.json();
      setOrderNumber(order.orderNumber);
      setPurchaseComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ background: "#faf9f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #e5e7eb",
              borderTopColor: "#7C7A67",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "#666" }}>Loading product...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Not found state
  if (notFound || !product) {
    return (
      <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
        <div style={{ background: "#222", padding: "80px 24px 40px" }}>
          <div style={{ maxWidth: "500px", margin: "0 auto" }}>
            <Link
              href={`/${locale}/store/scan`}
              style={{
                color: "rgba(255,255,255,0.7)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9rem",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Scan Again
            </Link>
          </div>
        </div>
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222", marginBottom: "12px" }}>
            Product Not Found
          </h1>
          <p style={{ color: "#666", marginBottom: "32px" }}>
            We couldn&apos;t find a product with code &quot;{qrCode}&quot;. Please try scanning again or enter a different code.
          </p>
          <Link
            href={`/${locale}/store/scan`}
            style={{
              display: "inline-block",
              padding: "16px 32px",
              background: "#7C7A67",
              color: "white",
              borderRadius: "12px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  // Purchase complete state
  if (purchaseComplete && orderNumber) {
    return (
      <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
        <div style={{ background: "#222", padding: "80px 24px 60px" }}>
          <div style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "#dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <h1
              style={{
                fontSize: "clamp(1.5rem, 5vw, 2rem)",
                fontWeight: "300",
                color: "white",
                marginBottom: "12px",
              }}
            >
              Purchase Complete!
            </h1>
            <p style={{ color: "rgba(255,255,255,0.8)" }}>
              Show this screen at the door to pick up your item.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "40px 24px 80px" }}>
          {/* Receipt */}
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              marginBottom: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "4px" }}>Order Number</p>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "600",
                  letterSpacing: "2px",
                  fontFamily: "monospace",
                }}
              >
                {orderNumber}
              </p>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "16px 0", borderTop: "1px solid #e5e7eb" }}>
              {product.imageUrl && (
                <div
                  style={{
                    position: "relative",
                    width: "60px",
                    height: "60px",
                    borderRadius: "10px",
                    overflow: "hidden",
                    background: "#f3f4f6",
                    flexShrink: 0,
                  }}
                >
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="60px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: "500", color: "#222" }}>{product.name}</p>
                <p style={{ fontSize: "0.85rem", color: "#666" }}>Qty: {quantity}</p>
              </div>
              <p style={{ fontWeight: "600", color: "#7C7A67" }}>
                ${(subtotalCents / 100).toFixed(2)}
              </p>
            </div>

            <div style={{ padding: "16px 0", borderTop: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#666" }}>Tax</span>
                <span>${(taxCents / 100).toFixed(2)}</span>
              </div>
              {creditsToApply > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#16a34a" }}>Credits Applied</span>
                  <span style={{ color: "#16a34a" }}>-${(creditsToApply / 100).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "1.1rem", paddingTop: "8px", borderTop: "2px solid #e5e7eb" }}>
                <span>Total Paid</span>
                <span style={{ color: "#7C7A67" }}>${(amountAfterCredits / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Link
              href={`/${locale}/store/scan`}
              style={{
                display: "block",
                padding: "16px",
                background: "#7C7A67",
                color: "white",
                borderRadius: "12px",
                textDecoration: "none",
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Scan Another Item
            </Link>
            <Link
              href={`/${locale}/store`}
              style={{
                display: "block",
                padding: "16px",
                background: "white",
                color: "#7C7A67",
                border: "2px solid #7C7A67",
                borderRadius: "12px",
                textDecoration: "none",
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Browse Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main product view
  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#222", padding: "80px 24px 24px" }}>
        <div style={{ maxWidth: "500px", margin: "0 auto" }}>
          <Link
            href={`/${locale}/store/scan`}
            style={{
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.9rem",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Scan Another
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: "500px", margin: "0 auto", padding: "0 24px 80px" }}>
        {/* Product Card */}
        <div
          style={{
            background: "white",
            borderRadius: "20px",
            marginTop: "-40px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          {/* Product Image */}
          <div style={{ position: "relative", height: "300px", background: "#f3f4f6" }}>
            {product.imageUrl && (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="500px"
                style={{ objectFit: "cover" }}
              />
            )}
            {product.stockCount !== null && product.stockCount <= 5 && product.stockCount > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "0.8rem",
                  fontWeight: "500",
                }}
              >
                Only {product.stockCount} left
              </div>
            )}
          </div>

          {/* Product Info */}
          <div style={{ padding: "24px" }}>
            <p
              style={{
                fontSize: "0.75rem",
                color: "#C7A878",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: "8px",
                fontWeight: "600",
              }}
            >
              {product.category}
            </p>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222", marginBottom: "12px" }}>
              {product.name}
            </h1>
            {product.description && (
              <p style={{ color: "#666", lineHeight: "1.6", marginBottom: "20px" }}>
                {product.description}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: "600", color: "#7C7A67" }}>
                ${(product.priceCents / 100).toFixed(2)}
              </span>

              {/* Quantity Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{
                    width: "36px",
                    height: "36px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "10px",
                    background: "white",
                    cursor: "pointer",
                    fontSize: "1.2rem",
                    color: "#666",
                  }}
                >
                  -
                </button>
                <span style={{ width: "30px", textAlign: "center", fontWeight: "600", fontSize: "1.1rem" }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={product.stockCount !== null && quantity >= product.stockCount}
                  style={{
                    width: "36px",
                    height: "36px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "10px",
                    background: "white",
                    cursor: product.stockCount !== null && quantity >= product.stockCount ? "not-allowed" : "pointer",
                    fontSize: "1.2rem",
                    color: "#666",
                    opacity: product.stockCount !== null && quantity >= product.stockCount ? 0.5 : 1,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              padding: "16px",
              marginTop: "24px",
              color: "#dc2626",
            }}
          >
            {error}
          </div>
        )}

        {/* Auth Gate */}
        {!user && !isGuest && (
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              marginTop: "24px",
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222", marginBottom: "12px" }}>
              How would you like to pay?
            </h3>
            <p style={{ color: "#666", marginBottom: "20px", fontSize: "0.9rem" }}>
              Sign in to use your credits, or continue as guest.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <SignInButton mode="modal">
                <button
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: "#7C7A67",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "1rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Sign In to Use Credits
                </button>
              </SignInButton>
              <button
                onClick={handleGuestCheckout}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "white",
                  color: "#7C7A67",
                  border: "2px solid #7C7A67",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Continue as Guest
              </button>
            </div>
          </div>
        )}

        {/* Payment Section */}
        {(user || isGuest) && (
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              marginTop: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
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
                      <div style={{ fontWeight: "500", color: "#222" }}>Apply Credits</div>
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

            {/* Order Summary */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#666" }}>Subtotal ({quantity} {quantity === 1 ? "item" : "items"})</span>
                <span>${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#666" }}>Tax</span>
                <span>${(taxCents / 100).toFixed(2)}</span>
              </div>
              {creditsToApply > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#16a34a" }}>Credits</span>
                  <span style={{ color: "#16a34a" }}>-${(creditsToApply / 100).toFixed(2)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "12px",
                  borderTop: "2px solid #e5e7eb",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                }}
              >
                <span>Total</span>
                <span style={{ color: "#7C7A67" }}>${(amountAfterCredits / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Payment */}
            {amountAfterCredits <= 0 ? (
              <button
                onClick={handleFreePurchase}
                disabled={processing}
                style={{
                  width: "100%",
                  padding: "18px",
                  background: processing ? "#d1d5db" : "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  cursor: processing ? "not-allowed" : "pointer",
                }}
              >
                {processing ? "Processing..." : "Complete Purchase (Free)"}
              </button>
            ) : clientSecret ? (
              <StripeProvider clientSecret={clientSecret}>
                <PaymentForm
                  amountCents={amountAfterCredits}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  showExpressCheckout={true}
                  showSaveCard={!!stripeCustomerId}
                  savedPaymentMethods={savedPaymentMethods}
                  returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/store/item/${qrCode}?complete=true`}
                  submitButtonText={`Pay $${(amountAfterCredits / 100).toFixed(2)}`}
                  disabled={processing}
                />
              </StripeProvider>
            ) : (
              <div style={{ textAlign: "center", padding: "24px" }}>
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
                <p style={{ color: "#666", marginTop: "12px", fontSize: "0.9rem" }}>Loading payment...</p>
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: "center", color: "#666", fontSize: "0.85rem", marginTop: "24px" }}>
          In-store pickup only. Show your receipt at the door.
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
