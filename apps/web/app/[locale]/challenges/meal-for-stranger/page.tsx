"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { API_URL } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Location = {
  id: string;
  name: string;
  city: string;
  address: string;
};

function PaymentForm({
  selectedLocationId,
  giftAmount,
  message,
  userProfile,
  applyCredits,
  challengeAlreadyCompleted,
}: {
  selectedLocationId: string;
  giftAmount: number;
  message: string;
  userProfile: any;
  applyCredits: boolean;
  challengeAlreadyCompleted: boolean;
}) {
  const router = useRouter();
  const { user } = useUser();
  const t = useTranslations("mealGift");
  const toast = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const creditBalance = userProfile?.creditsCents || 0;
  const creditsToUse = applyCredits ? Math.min(creditBalance, giftAmount) : 0;
  const remainingAmount = giftAmount - creditsToUse;
  const needsStripePayment = remainingAmount > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      toast.error(t("errors.signIn"));
      return;
    }

    if (!selectedLocationId) {
      toast.error(t("errors.selectLocation"));
      return;
    }

    if (needsStripePayment && (!stripe || !elements)) {
      toast.error(t("errors.paymentNotReady"));
      return;
    }

    setSubmitting(true);

    try {
      // Get/create user in database
      const userResponse = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || user.firstName || undefined,
        }),
      });

      if (!userResponse.ok) {
        throw new Error(t("errors.createUser"));
      }

      const userData = await userResponse.json();
      const giverId = userData.id;
      localStorage.setItem("userId", giverId);

      let paymentIntentId: string | null = null;

      // Handle Stripe payment if needed
      if (needsStripePayment) {
        // Create payment intent
        const paymentResponse = await fetch(`${API_URL}/create-payment-intent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({
            amountCents: remainingAmount,
            metadata: {
              type: "meal_gift",
              giverId,
              locationId: selectedLocationId,
              creditsApplied: creditsToUse,
            },
          }),
        });

        if (!paymentResponse.ok) {
          throw new Error(t("errors.createPaymentIntent"));
        }

        const paymentData = await paymentResponse.json();

        // Confirm payment with card
        const cardElement = elements!.getElement(CardElement);
        if (!cardElement) {
          throw new Error(t("errors.cardNotFound"));
        }

        const { error, paymentIntent } = await stripe!.confirmCardPayment(
          paymentData.clientSecret,
          {
            payment_method: {
              card: cardElement,
              billing_details: {
                email: user.primaryEmailAddress?.emailAddress,
                name: user.fullName || undefined,
              },
            },
          }
        );

        if (error) {
          throw new Error(error.message);
        }

        if (paymentIntent?.status !== "succeeded") {
          throw new Error(t("errors.paymentFailed"));
        }

        paymentIntentId = paymentIntent.id;
      }

      // Create meal gift
      const mealGiftResponse = await fetch(`${API_URL}/meal-gifts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          giverId,
          locationId: selectedLocationId,
          amountCents: giftAmount,
          messageFromGiver: message || null,
          paymentIntentId,
        }),
      });

      if (!mealGiftResponse.ok) {
        const errorData = await mealGiftResponse.json();
        throw new Error(errorData.error || t("errors.createGift"));
      }

      const mealGift = await mealGiftResponse.json();

      // Deduct credits if used
      if (creditsToUse > 0) {
        await fetch(`${API_URL}/users/${giverId}/deduct-credits`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({
            amountCents: creditsToUse,
            description: `Meal for a Stranger gift - ${mealGift.id}`,
          }),
        });
      }

      toast.success(t("success.created"));
      router.push(`/member`);
    } catch (error: any) {
      console.error("Failed to create meal gift:", error);
      toast.error(error.message || t("errors.createGiftRetry"));
      setSubmitting(false);
    }
  }

  const amountDollar = (giftAmount / 100).toFixed(2);

  return (
    <form onSubmit={handleSubmit}>
      {/* Payment Summary */}
      <div style={{ background: "#fef3e2", padding: 16, borderRadius: 8, marginBottom: 24, border: "1px solid #fbbf24" }}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <span>{t("summary.giftAmount")}</span>
          <span style={{ fontWeight: "600" }}>${amountDollar}</span>
        </div>
        {creditsToUse > 0 && (
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", color: "#22c55e" }}>
            <span>{t("summary.creditsApplied")}</span>
            <span style={{ fontWeight: "600" }}>-${(creditsToUse / 100).toFixed(2)}</span>
          </div>
        )}
        {remainingAmount > 0 && (
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
            <span>{t("summary.cardPayment")}</span>
            <span style={{ fontWeight: "600" }}>${(remainingAmount / 100).toFixed(2)}</span>
          </div>
        )}
        {!challengeAlreadyCompleted && (
          <div style={{ borderTop: "1px solid #f9a825", paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
            <span>{t("summary.potentialReward")}</span>
            <span style={{ color: "#22c55e" }}>{t("summary.rewardAmount")}</span>
          </div>
        )}
        {challengeAlreadyCompleted && (
          <div style={{ borderTop: "1px solid #f9a825", paddingTop: 8, marginTop: 8, fontSize: "0.85rem", color: "#666", fontStyle: "italic" }}>
            {t("summary.alreadyCompleted")}
          </div>
        )}
      </div>

      {/* Stripe Card Element */}
      {needsStripePayment && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
            {t("form.paymentCard")}
          </label>
          <div style={{
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "white",
          }}>
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#424770",
                    "::placeholder": {
                      color: "#aab7c4",
                    },
                  },
                  invalid: {
                    color: "#9e2146",
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting || (!stripe && needsStripePayment)}
        style={{
          width: "100%",
          padding: 16,
          background: submitting || (!stripe && needsStripePayment) ? "#ccc" : "#7C7A67",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: "1.1rem",
          fontWeight: "600",
          cursor: submitting || (!stripe && needsStripePayment) ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? t("button.processing") : t("button.giftMeal", { amount: amountDollar })}
      </button>
    </form>
  );
}

export default function MealForStrangerPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const t = useTranslations("mealGift");

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [giftAmount, setGiftAmount] = useState<number>(1999); // $19.99 default
  const [message, setMessage] = useState<string>("");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [applyCredits, setApplyCredits] = useState<boolean>(true);
  const [challengeAlreadyCompleted, setChallengeAlreadyCompleted] = useState<boolean>(false);

  // Fetch locations on mount
  useEffect(() => {
    fetch(`${API_URL}/locations`, {
      headers: { "x-tenant-slug": "oh" },
    })
      .then((res) => res.json())
      .then((data) => {
        setLocations(data);
        if (data.length > 0) {
          setSelectedLocationId(data[0].id);
        }
      })
      .catch((err) => console.error("Failed to load locations:", err));
  }, []);

  // Fetch or create user profile if logged in
  useEffect(() => {
    async function initializeUserProfile() {
      if (!userLoaded || !user?.primaryEmailAddress?.emailAddress) return;

      try {
        // First, try to get/create user in our system (like payment form does)
        const userResponse = await fetch(`${API_URL}/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({
            email: user.primaryEmailAddress.emailAddress,
            name: user.fullName || user.firstName || undefined,
          }),
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          localStorage.setItem("userId", userData.id);

          // Now fetch the full profile to get credit balance
          const profileResponse = await fetch(`${API_URL}/users/${userData.id}/profile`, {
            headers: { "x-tenant-slug": "oh" },
          });

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            setUserProfile(profileData);
          }

          // Check if user has already completed this challenge
          const challengesResponse = await fetch(`${API_URL}/users/${userData.id}/challenges`, {
            headers: { "x-tenant-slug": "oh" },
          });

          if (challengesResponse.ok) {
            const challengesData = await challengesResponse.json();
            const mealChallenge = challengesData.find(
              (uc: any) => uc.challenge?.slug === "meal-for-stranger"
            );
            if (mealChallenge?.rewardClaimed) {
              setChallengeAlreadyCompleted(true);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    }

    initializeUserProfile();
  }, [userLoaded, user]);

  const amountDollar = (giftAmount / 100).toFixed(2);
  const creditBalance = userProfile?.creditsCents || 0;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: "3rem", marginBottom: 8 }}>🎁</div>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: 8 }}>
          {t("title")}
        </h1>
        <p style={{ color: "#666", fontSize: "1rem" }}>
          {t("description")}
        </p>
      </div>

      {/* How it Works */}
      <div style={{ background: "#f9fafb", padding: 24, borderRadius: 12, marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: 16 }}>
          {t("howItWorks")}
        </h2>
        <ol style={{ marginLeft: 20, color: "#666" }}>
          <li style={{ marginBottom: 8 }}>{t("steps.chooseLocation")}</li>
          <li style={{ marginBottom: 8 }}>{t("steps.nextDiner")}</li>
          <li style={{ marginBottom: 8 }}>{t("steps.acceptOrForward")}</li>
          <li style={{ marginBottom: 8 }}>
            {challengeAlreadyCompleted
              ? t("steps.seeMessage")
              : t("steps.earnReward")}
          </li>
          <li>{t("steps.refund")}</li>
        </ol>
      </div>

      {/* Location Selection */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
          {t("form.location")}
        </label>
        <select
          value={selectedLocationId}
          onChange={(e) => setSelectedLocationId(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: "1rem",
          }}
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} - {loc.city}
            </option>
          ))}
        </select>
      </div>

      {/* Amount Selection */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
          {t("form.giftAmountLabel")}: ${amountDollar}
        </label>
        <input
          type="range"
          min={1599}
          max={3500}
          step={100}
          value={giftAmount}
          onChange={(e) => setGiftAmount(parseInt(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#666" }}>
          <span>{t("form.minAmount")}</span>
          <span>{t("form.maxAmount")}</span>
        </div>
      </div>

      {/* Message (Optional) */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
          {t("form.message")}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("form.messagePlaceholder")}
          maxLength={200}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: "1rem",
            minHeight: 80,
            resize: "vertical",
          }}
        />
        <div style={{ textAlign: "right", fontSize: "0.875rem", color: "#666" }}>
          {message.length}/200
        </div>
      </div>

      {/* Credit Balance & Application */}
      {userProfile && (
        <div style={{ background: "#f0f9ff", padding: 16, borderRadius: 8, marginBottom: 24, border: "1px solid #bae6fd" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: "600" }}>{t("form.availableCredits")}:</span>
            <span style={{ fontWeight: "bold", color: "#0284c7", fontSize: "1.1rem" }}>
              ${(creditBalance / 100).toFixed(2)}
            </span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={applyCredits}
              onChange={(e) => setApplyCredits(e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            <span style={{ fontSize: "0.95rem" }}>{t("form.useCredits")}</span>
          </label>
        </div>
      )}

      {/* Wrap PaymentForm in Elements provider */}
      <Elements stripe={stripePromise}>
        <PaymentForm
          selectedLocationId={selectedLocationId}
          giftAmount={giftAmount}
          message={message}
          userProfile={userProfile}
          applyCredits={applyCredits}
          challengeAlreadyCompleted={challengeAlreadyCompleted}
        />
      </Elements>

      {!userLoaded || !user ? (
        <p style={{ textAlign: "center", marginTop: 16, color: "#666", fontSize: "0.875rem" }}>
          {t("signInPrompt")}
        </p>
      ) : null}
    </div>
  );
}
