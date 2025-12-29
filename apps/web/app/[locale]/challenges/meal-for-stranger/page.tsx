"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import { API_URL } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Location = {
  id: string;
  name: string;
  city: string;
  address: string;
};

export default function MealForStrangerPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const t = useTranslations("challenges");
  const toast = useToast();
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [giftAmount, setGiftAmount] = useState<number>(1999); // $19.99 default
  const [message, setMessage] = useState<string>("");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // Fetch user profile if logged in
  useEffect(() => {
    if (userLoaded && user) {
      const userId = localStorage.getItem("userId");
      if (userId) {
        fetch(`${API_URL}/users/${userId}/profile`, {
          headers: { "x-tenant-slug": "oh" },
        })
          .then((res) => res.json())
          .then((data) => setUserProfile(data))
          .catch((err) => console.error("Failed to load profile:", err));
      }
    }
  }, [userLoaded, user]);

  async function handleSubmit() {
    if (!userLoaded || !user) {
      toast.error("Please sign in to gift a meal");
      return;
    }

    if (!selectedLocationId) {
      toast.error("Please select a location");
      return;
    }

    if (giftAmount < 1599 || giftAmount > 3500) {
      toast.error("Gift amount must be between $15.99 and $35.00");
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
        throw new Error("Failed to create user");
      }

      const userData = await userResponse.json();
      const giverId = userData.id;
      localStorage.setItem("userId", giverId);

      // Calculate payment split: use credits first, then Stripe
      const creditBalance = userProfile?.creditBalanceCents || 0;
      const creditsToUse = Math.min(creditBalance, giftAmount);
      const stripeAmount = giftAmount - creditsToUse;

      let paymentIntent = null;

      // If Stripe payment needed, create payment intent
      if (stripeAmount > 0) {
        const paymentResponse = await fetch(`${API_URL}/create-payment-intent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({
            amountCents: stripeAmount,
            metadata: {
              type: "meal_gift",
              giverId,
              locationId: selectedLocationId,
            },
          }),
        });

        if (!paymentResponse.ok) {
          throw new Error("Failed to create payment intent");
        }

        const paymentData = await paymentResponse.json();
        const stripe = await stripePromise;
        
        if (!stripe) {
          throw new Error("Stripe failed to load");
        }

        // Confirm payment
        const { error } = await stripe.confirmCardPayment(paymentData.clientSecret, {
          payment_method: {
            card: {
              // In production, use Elements for card input
              // For now, this is placeholder logic
            },
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        paymentIntent = paymentData.id;
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
        }),
      });

      if (!mealGiftResponse.ok) {
        throw new Error("Failed to create meal gift");
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
            description: "Meal for a Stranger gift",
          }),
        });
      }

      toast.success("Meal gift created! Your kindness will brighten someone's day.");
      router.push(`/member`); // Redirect to member dashboard
    } catch (error: any) {
      console.error("Failed to create meal gift:", error);
      toast.error(error.message || "Failed to create meal gift. Please try again.");
      setSubmitting(false);
    }
  }

  const amountDollar = (giftAmount / 100).toFixed(2);
  const creditBalance = userProfile?.creditBalanceCents || 0;
  const creditsToUse = Math.min(creditBalance, giftAmount);
  const stripeAmount = giftAmount - creditsToUse;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: "3rem", marginBottom: 8 }}>🎁</div>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: 8 }}>
          Meal for a Stranger
        </h1>
        <p style={{ color: "#666", fontSize: "1rem" }}>
          Gift a meal to the next solo diner at your chosen location. If they pay it forward, watch the kindness chain grow!
        </p>
      </div>

      {/* How it Works */}
      <div style={{ background: "#f9fafb", padding: 24, borderRadius: 12, marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: 16 }}>
          How it Works
        </h2>
        <ol style={{ marginLeft: 20, color: "#666" }}>
          <li style={{ marginBottom: 8 }}>Choose a location and gift amount ($15.99 - $35.00)</li>
          <li style={{ marginBottom: 8 }}>The next solo diner at that location gets notified of your gift</li>
          <li style={{ marginBottom: 8 }}>They can accept it or pay it forward to the next person</li>
          <li style={{ marginBottom: 8 }}>When someone accepts, you earn a $5 reward!</li>
          <li>If unclaimed by end of day, you get a full refund as credits</li>
        </ol>
      </div>

      {/* Location Selection */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
          Location
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
          Gift Amount: ${amountDollar}
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
          <span>$15.99</span>
          <span>$35.00</span>
        </div>
      </div>

      {/* Message (Optional) */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
          Message (Optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a message of kindness..."
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

      {/* Payment Summary */}
      <div style={{ background: "#fef3e2", padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <span>Gift Amount:</span>
          <span style={{ fontWeight: "600" }}>${amountDollar}</span>
        </div>
        {creditsToUse > 0 && (
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", color: "#22c55e" }}>
            <span>Credits Applied:</span>
            <span style={{ fontWeight: "600" }}>-${(creditsToUse / 100).toFixed(2)}</span>
          </div>
        )}
        {stripeAmount > 0 && (
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span>Card Payment:</span>
            <span style={{ fontWeight: "600" }}>${(stripeAmount / 100).toFixed(2)}</span>
          </div>
        )}
        <div style={{ borderTop: "1px solid #f9a825", paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>Potential Reward:</span>
          <span style={{ color: "#22c55e" }}>+$5.00</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !userLoaded || !user}
        style={{
          width: "100%",
          padding: 16,
          background: submitting ? "#ccc" : "#7C7A67",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: "1.1rem",
          fontWeight: "600",
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Processing..." : `Gift ${amountDollar} Meal`}
      </button>

      {!userLoaded || !user ? (
        <p style={{ textAlign: "center", marginTop: 16, color: "#666", fontSize: "0.875rem" }}>
          Please sign in to gift a meal
        </p>
      ) : null}
    </div>
  );
}
