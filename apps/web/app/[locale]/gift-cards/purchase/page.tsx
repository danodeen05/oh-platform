"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useUser } from "@clerk/nextjs";
import { useGuest } from "@/contexts/guest-context";
import { StripeProvider, PaymentForm, type SavedPaymentMethod } from "@/components/payments";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Step definitions
type Step = "amount" | "recipient" | "payment" | "confirmation";

// Gift card design options
const cardDesigns = [
  { id: "classic", name: "Classic", gradient: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)" },
  { id: "dark", name: "Dark", gradient: "linear-gradient(135deg, #222222 0%, #444444 100%)" },
  { id: "gold", name: "Gold", gradient: "linear-gradient(135deg, #C7A878 0%, #8B7355 100%)" },
];

const presetAmounts = [25, 50, 75, 100, 150, 200];

interface UserCredits {
  referralCredits: number;
  giftCreditsReceived: number;
  totalCredits: number;
}

interface GiftCardPurchaseData {
  amountCents: number;
  designId: string;
  recipientEmail: string;
  recipientName: string;
  personalMessage: string;
  sendImmediately: boolean;
  scheduledDate?: string;
}

export default function GiftCardPurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("giftCards");
  const tCommon = useTranslations("common");
  const { user, isLoaded: clerkLoaded } = useUser();
  const { guestId, isGuest } = useGuest();

  // Get initial values from URL params
  const initialAmount = searchParams.get("amount");
  const initialDesign = searchParams.get("design");

  // Step tracking
  const [currentStep, setCurrentStep] = useState<Step>("amount");

  // Amount & Design state - initialize from URL params if available
  const [selectedAmount, setSelectedAmount] = useState<number | null>(() => {
    if (initialAmount) {
      const amount = parseInt(initialAmount, 10);
      if (presetAmounts.includes(amount)) return amount;
      return null;
    }
    return 50;
  });
  const [customAmount, setCustomAmount] = useState(() => {
    if (initialAmount) {
      const amount = parseInt(initialAmount, 10);
      if (!presetAmounts.includes(amount) && amount >= 10 && amount <= 500) {
        return initialAmount;
      }
    }
    return "";
  });
  const [selectedDesign, setSelectedDesign] = useState(() => {
    if (initialDesign && cardDesigns.some(d => d.id === initialDesign)) {
      return initialDesign;
    }
    return "classic";
  });

  // Recipient state
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledDate, setScheduledDate] = useState("");

  // Payment state
  const [applyCredits, setApplyCredits] = useState(true);
  const [userCredits, setUserCredits] = useState<UserCredits | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Confirmation state
  const [purchasedGiftCard, setPurchasedGiftCard] = useState<{
    id: string;
    code: string;
    amountCents: number;
    recipientEmail: string;
  } | null>(null);

  // UI state
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate amounts
  const amountCents = (selectedAmount || Number(customAmount) || 0) * 100;
  const currentDesign = cardDesigns.find(d => d.id === selectedDesign) || cardDesigns[0];

  // Credits applied (UNLIMITED for gift cards)
  const creditsToApply = applyCredits && userCredits
    ? Math.min(userCredits.totalCredits, amountCents)
    : 0;
  const amountAfterCredits = amountCents - creditsToApply;

  // Fetch user credits and saved payment methods
  useEffect(() => {
    if (!user?.id) return;

    const fetchUserData = async () => {
      try {
        // Fetch user with credits
        const userRes = await fetch(`${API_URL}/users/${user.id}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserCredits({
            referralCredits: userData.referralCredits || 0,
            giftCreditsReceived: userData.giftCreditsReceived || 0,
            totalCredits: (userData.referralCredits || 0) + (userData.giftCreditsReceived || 0),
          });
        }

        // Fetch or create Stripe customer
        const customerRes = await fetch(`${API_URL}/users/${user.id}/stripe-customer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (customerRes.ok) {
          const customerData = await customerRes.json();
          setStripeCustomerId(customerData.stripeCustomerId);
        }

        // Fetch saved payment methods
        const methodsRes = await fetch(`${API_URL}/users/${user.id}/payment-methods`);
        if (methodsRes.ok) {
          const methods = await methodsRes.json();
          setSavedPaymentMethods(methods);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchUserData();
  }, [user?.id]);

  // Create PaymentIntent when entering payment step
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
            type: "gift_card",
            amountCents: amountCents.toString(),
            creditsApplied: creditsToApply.toString(),
            recipientEmail,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create payment intent");
      }

      const data = await res.json();
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.id);
    } catch (err) {
      console.error("Error creating payment intent:", err);
      setError("Failed to initialize payment. Please try again.");
    }
  }, [amountAfterCredits, amountCents, creditsToApply, stripeCustomerId, recipientEmail]);

  useEffect(() => {
    if (currentStep === "payment" && amountAfterCredits > 0) {
      createPaymentIntent();
    }
  }, [currentStep, amountAfterCredits, createPaymentIntent]);

  // Validate current step
  const validateStep = (step: Step): boolean => {
    switch (step) {
      case "amount":
        return amountCents >= 1000 && amountCents <= 50000; // $10-$500
      case "recipient":
        return (
          recipientEmail.includes("@") &&
          recipientName.trim().length > 0 &&
          (sendImmediately || scheduledDate.length > 0)
        );
      case "payment":
        return true;
      default:
        return true;
    }
  };

  // Handle step navigation
  const goToStep = (step: Step) => {
    if (step === "payment" && !user && !isGuest) {
      // Require auth for payment
      setError("Please sign in or continue as guest to proceed with payment.");
      return;
    }
    setCurrentStep(step);
    setError(null);
  };

  // Handle free purchase (credits cover full amount)
  const handleFreePurchase = async () => {
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/gift-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          designId: selectedDesign,
          recipientEmail,
          recipientName,
          personalMessage,
          purchaserId: user?.id,
          guestId: isGuest ? guestId : undefined,
          creditsApplied: creditsToApply,
          // No stripePaymentId since it's free
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to purchase gift card");
      }

      const giftCard = await res.json();
      setPurchasedGiftCard(giftCard);
      setCurrentStep("confirmation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setProcessing(false);
    }
  };

  // Handle Stripe payment success
  const handlePaymentSuccess = async (stripePaymentIntentId: string) => {
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/gift-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          designId: selectedDesign,
          recipientEmail,
          recipientName,
          personalMessage,
          purchaserId: user?.id,
          guestId: isGuest ? guestId : undefined,
          creditsApplied: creditsToApply,
          stripePaymentId: stripePaymentIntentId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to purchase gift card");
      }

      const giftCard = await res.json();
      setPurchasedGiftCard(giftCard);
      setCurrentStep("confirmation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setProcessing(false);
    }
  };

  // Handle payment error
  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Step progress indicator
  const steps: { key: Step; label: string }[] = [
    { key: "amount", label: "Amount" },
    { key: "recipient", label: "Recipient" },
    { key: "payment", label: "Payment" },
    { key: "confirmation", label: "Confirmation" },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#222", padding: "80px 24px 40px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <Link
            href="/gift-cards"
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
            Back to Gift Cards
          </Link>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              color: "white",
              letterSpacing: "1px",
            }}
          >
            Purchase Gift Card
          </h1>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "48px" }}>
          {steps.map((step, idx) => (
            <div key={step.key} style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: idx <= currentStepIndex ? "#7C7A67" : "#e5e7eb",
                    color: idx <= currentStepIndex ? "white" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    transition: "all 0.3s ease",
                  }}
                >
                  {idx < currentStepIndex ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  style={{
                    marginTop: "8px",
                    fontSize: "0.8rem",
                    color: idx <= currentStepIndex ? "#7C7A67" : "#9ca3af",
                    fontWeight: idx === currentStepIndex ? "600" : "400",
                  }}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background: idx < currentStepIndex ? "#7C7A67" : "#e5e7eb",
                    margin: "0 -8px",
                    marginBottom: "28px",
                  }}
                />
              )}
            </div>
          ))}
        </div>

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

        {/* Step: Amount & Design */}
        {currentStep === "amount" && (
          <div>
            {/* Gift Card Preview */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "40px" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: "360px",
                  aspectRatio: "1.6 / 1",
                  borderRadius: "20px",
                  background: currentDesign.gradient,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* Card content */}
                <div style={{ position: "relative", height: "100%", padding: "24px", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.6)", letterSpacing: "2px", textTransform: "uppercase" }}>
                      Digital Gift Card
                    </div>
                    <div style={{ width: "80px", height: "80px", position: "relative", marginTop: "-10px", marginRight: "-5px" }}>
                      <Image
                        src="/Oh_Logo_Large.png"
                        alt="Oh! Logo"
                        fill
                        sizes="80px"
                        style={{ objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.85 }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginTop: "-20px" }}>
                    <div style={{ fontSize: "clamp(2rem, 8vw, 3.5rem)", fontWeight: "300", color: "white" }}>
                      ${(amountCents / 100) || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: "300", color: "white" }}>Oh! Beef Noodle Soup</div>
                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>ohbeefnoodlesoup.com</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Design Selector */}
            <div style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "600", color: "#222", marginBottom: "12px" }}>
                Choose Design
              </label>
              <div style={{ display: "flex", gap: "12px" }}>
                {cardDesigns.map((design) => (
                  <button
                    key={design.id}
                    onClick={() => setSelectedDesign(design.id)}
                    style={{
                      width: "64px",
                      height: "40px",
                      borderRadius: "10px",
                      background: design.gradient,
                      border: selectedDesign === design.id ? "3px solid #7C7A67" : "3px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: selectedDesign === design.id ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
                    }}
                    title={design.name}
                  />
                ))}
              </div>
            </div>

            {/* Amount Selection */}
            <div style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "600", color: "#222", marginBottom: "12px" }}>
                Select Amount
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                {presetAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedAmount(amount);
                      setCustomAmount("");
                    }}
                    style={{
                      padding: "20px",
                      background: selectedAmount === amount ? "#7C7A67" : "white",
                      color: selectedAmount === amount ? "white" : "#222",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontSize: "1.25rem",
                      fontWeight: "500",
                      transition: "all 0.2s ease",
                      boxShadow: selectedAmount === amount ? "0 4px 12px rgba(124, 122, 103, 0.3)" : "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              {/* Custom Amount */}
              <div style={{ background: "white", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <label style={{ fontSize: "0.85rem", color: "#666", display: "block", marginBottom: "8px" }}>
                  Or enter custom amount ($10-$500)
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#7C7A67", fontSize: "1.25rem", fontWeight: "500" }}>
                    $
                  </span>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmount(null);
                    }}
                    placeholder="Enter amount"
                    style={{
                      width: "100%",
                      padding: "16px 16px 16px 40px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      fontSize: "1.1rem",
                      outline: "none",
                      transition: "border-color 0.2s ease",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#7C7A67"}
                    onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                  />
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <button
              onClick={() => goToStep("recipient")}
              disabled={!validateStep("amount")}
              style={{
                width: "100%",
                padding: "18px",
                background: validateStep("amount") ? "#7C7A67" : "#d1d5db",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "1.1rem",
                fontWeight: "600",
                cursor: validateStep("amount") ? "pointer" : "not-allowed",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              Continue
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Step: Recipient Details */}
        {currentStep === "recipient" && (
          <div>
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Recipient Information
              </h3>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                  Recipient Email *
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "10px",
                    fontSize: "1rem",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#7C7A67"}
                  onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                  Recipient Name *
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="John Doe"
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "10px",
                    fontSize: "1rem",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#7C7A67"}
                  onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "500", color: "#555", marginBottom: "8px" }}>
                  Personal Message (optional)
                </label>
                <textarea
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  placeholder="Add a personal message to your gift card..."
                  rows={3}
                  maxLength={500}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "10px",
                    fontSize: "1rem",
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#7C7A67"}
                  onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                />
                <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#9ca3af", marginTop: "4px" }}>
                  {personalMessage.length}/500
                </div>
              </div>
            </div>

            {/* Delivery Options */}
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Delivery
              </h3>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "16px",
                  border: `2px solid ${sendImmediately ? "#7C7A67" : "#e5e7eb"}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  marginBottom: "12px",
                  background: sendImmediately ? "#f9f9f7" : "white",
                }}
              >
                <input
                  type="radio"
                  name="delivery"
                  checked={sendImmediately}
                  onChange={() => setSendImmediately(true)}
                  style={{ marginRight: "12px" }}
                />
                <div>
                  <div style={{ fontWeight: "500", color: "#222" }}>Send immediately</div>
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                    Recipient will receive the gift card via email right after purchase
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  padding: "16px",
                  border: `2px solid ${!sendImmediately ? "#7C7A67" : "#e5e7eb"}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  background: !sendImmediately ? "#f9f9f7" : "white",
                }}
              >
                <input
                  type="radio"
                  name="delivery"
                  checked={!sendImmediately}
                  onChange={() => setSendImmediately(false)}
                  style={{ marginRight: "12px", marginTop: "4px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "500", color: "#222" }}>Schedule for later</div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "12px" }}>
                    Choose a date for the gift card to be delivered
                  </div>
                  {!sendImmediately && (
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      style={{
                        padding: "10px 14px",
                        border: "2px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "0.95rem",
                        outline: "none",
                      }}
                    />
                  )}
                </div>
              </label>
            </div>

            {/* Navigation Buttons */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => goToStep("amount")}
                style={{
                  flex: 1,
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
                Back
              </button>
              <button
                onClick={() => goToStep("payment")}
                disabled={!validateStep("recipient")}
                style={{
                  flex: 2,
                  padding: "16px",
                  background: validateStep("recipient") ? "#7C7A67" : "#d1d5db",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: validateStep("recipient") ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                Continue to Payment
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {currentStep === "payment" && (
          <div>
            {/* Order Summary */}
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Order Summary
              </h3>

              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #e5e7eb" }}>
                <div
                  style={{
                    width: "80px",
                    aspectRatio: "1.6 / 1",
                    borderRadius: "8px",
                    background: currentDesign.gradient,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "500", color: "#222" }}>Oh! Gift Card</div>
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>To: {recipientName}</div>
                </div>
                <div style={{ fontWeight: "600", color: "#222", fontSize: "1.1rem" }}>
                  ${(amountCents / 100).toFixed(2)}
                </div>
              </div>

              {/* Credits Section - Only for signed-in users */}
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

              {/* Total */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222" }}>Total</div>
                <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "#7C7A67" }}>
                  ${(amountAfterCredits / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Payment Method
              </h3>

              {amountAfterCredits <= 0 ? (
                // Free purchase - credits cover everything
                <div>
                  <div style={{ textAlign: "center", padding: "32px" }}>
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
                      Your credits cover the full amount!
                    </p>
                    <p style={{ color: "#666", fontSize: "0.9rem" }}>
                      No additional payment needed.
                    </p>
                  </div>

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
                    {processing ? "Processing..." : "Complete Purchase"}
                  </button>
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
                    returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/gift-cards/purchase?step=confirmation`}
                    disabled={processing}
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

            {/* Back Button */}
            <button
              onClick={() => goToStep("recipient")}
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
              Back
            </button>
          </div>
        )}

        {/* Step: Confirmation */}
        {currentStep === "confirmation" && purchasedGiftCard && (
          <div style={{ textAlign: "center" }}>
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

            <h2 style={{ fontSize: "1.8rem", fontWeight: "400", color: "#222", marginBottom: "16px" }}>
              Gift Card Purchased!
            </h2>
            <p style={{ color: "#666", marginBottom: "40px", fontSize: "1.05rem" }}>
              A ${(purchasedGiftCard.amountCents / 100).toFixed(2)} gift card will be sent to{" "}
              <strong>{purchasedGiftCard.recipientEmail}</strong>
            </p>

            {/* Gift Card Preview */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "40px" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  aspectRatio: "1.6 / 1",
                  borderRadius: "16px",
                  background: currentDesign.gradient,
                  boxShadow: "0 16px 32px rgba(0,0,0,0.15)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div style={{ position: "relative", height: "100%", padding: "20px", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.6)", letterSpacing: "2px", textTransform: "uppercase" }}>
                      Digital Gift Card
                    </div>
                    <div style={{ width: "60px", height: "60px", position: "relative", marginTop: "-8px", marginRight: "-4px" }}>
                      <Image
                        src="/Oh_Logo_Large.png"
                        alt="Oh! Logo"
                        fill
                        sizes="60px"
                        style={{ objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.85 }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginTop: "-16px" }}>
                    <div style={{ fontSize: "2.5rem", fontWeight: "300", color: "white" }}>
                      ${(purchasedGiftCard.amountCents / 100).toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: "300", color: "white" }}>Oh! Beef Noodle Soup</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px", margin: "0 auto" }}>
              <Link
                href="/gift-cards"
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
                }}
              >
                Buy Another Gift Card
              </Link>
              <Link
                href="/"
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
                }}
              >
                Return Home
              </Link>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
