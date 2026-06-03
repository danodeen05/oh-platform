"use client";

import { useState, useEffect, Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { confirmBooking } from "@/lib/catering/api";
import { trackCateringPaymentSuccess } from "@/lib/catering/analytics";
import PromoCodeInput, { type AppliedPromo } from "@/components/PromoCodeInput";
import Image from "next/image";
import ThemedBackground from "@/components/catering/ThemedBackground";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface PaymentFormProps {
  locale: string;
  bookingId: string;
  clientSecret: string;
  amountCents: number;
  bowls: number;
  slot: string;
}

function PaymentForm({ locale, bookingId, clientSecret, amountCents, bowls, slot }: PaymentFormProps) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const discountCents = appliedPromo?.discountCents ?? 0;
  const finalAmountCents = Math.max(0, amountCents - discountCents);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError("");

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent?.status !== "succeeded") throw new Error("Payment was not completed");

      // Confirm with the backend
      const confirmation = await confirmBooking(bookingId, {
        paymentIntentId: paymentIntent.id,
        promoCodeId: appliedPromo?.id,
      });

      trackCateringPaymentSuccess(finalAmountCents);

      router.push(
        `/${locale}/catering/book/confirmation?eventSlug=${confirmation.eventSlug}&bookingToken=${confirmation.bookingToken}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed. Please try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "420px" }}>
      {/* Order summary */}
      <div style={{ background: "var(--brand-surface)", border: "1px solid var(--brand-border)", borderRadius: "12px", padding: "16px 20px" }}>
        <p style={{ margin: "0 0 6px", fontSize: "0.7rem", color: "var(--brand-primary)", opacity: 0.55, fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "1px" }}>
          Order Summary
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", fontSize: "0.9rem" }}>
            {bowls} bowls · {slot}
          </p>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
            ${(amountCents / 100).toFixed(2)}
          </p>
        </div>
        {discountCents > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
            <p style={{ margin: 0, color: "#22c55e", fontFamily: "'Raleway', sans-serif", fontSize: "0.88rem" }}>Promo discount</p>
            <p style={{ margin: 0, color: "#22c55e", fontWeight: 700, fontFamily: "'Raleway', sans-serif" }}>-${(discountCents / 100).toFixed(2)}</p>
          </div>
        )}
        <div style={{ borderTop: "1px solid var(--brand-border)", marginTop: "10px", paddingTop: "10px", display: "flex", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>Total</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
            ${(finalAmountCents / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Promo code */}
      <PromoCodeInput
        scope="CATERING"
        subtotalCents={amountCents}
        onApply={setAppliedPromo}
        onRemove={() => setAppliedPromo(null)}
        appliedPromo={appliedPromo}
        placeholder="Promo code (optional)"
        disabled={submitting}
        variant="brand"
      />

      {/* Card element */}
      <div>
        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", marginBottom: "8px" }}>
          Card Details
        </label>
        <div style={{
          padding: "13px 16px",
          border: "1.5px solid var(--brand-border)",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.95)",
        }}>
          <CardElement
            options={{
              style: {
                base: { fontSize: "16px", color: "#424770", "::placeholder": { color: "#aab7c4" } },
                invalid: { color: "#9e2146" },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <p style={{ margin: 0, color: "#ef4444", fontSize: "0.85rem", fontFamily: "'Raleway', sans-serif" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe}
        style={{
          padding: "16px",
          background: "var(--brand-primary)",
          color: "var(--brand-on-primary)",
          border: "none",
          borderRadius: "50px",
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 700,
          fontSize: "1rem",
          letterSpacing: "1px",
          cursor: submitting || !stripe ? "default" : "pointer",
          opacity: submitting || !stripe ? 0.7 : 1,
          transition: "all 0.2s ease",
        }}
      >
        {submitting ? "Processing..." : `Pay $${(finalAmountCents / 100).toFixed(2)}`}
      </button>

      <p style={{ margin: 0, textAlign: "center", fontSize: "0.72rem", color: "var(--brand-primary)", opacity: 0.35, fontFamily: "'Raleway', sans-serif" }}>
        Secured by Stripe · Your card is encrypted and never stored.
      </p>
    </form>
  );
}

function PaymentContent({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const slot = searchParams.get("slot") || "LUNCH";
  const bowls = parseInt(searchParams.get("bowls") || "10", 10);

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem("catering_booking_id");
    const secret = sessionStorage.getItem("catering_client_secret");
    const amt = sessionStorage.getItem("catering_amount_cents");
    setBookingId(id);
    setClientSecret(secret);
    setAmountCents(amt ? parseInt(amt, 10) : null);
  }, []);

  if (!bookingId || !clientSecret || !amountCents) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p style={{ color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
          Session expired.{" "}
          <a href={`/${locale}/catering/book`} style={{ color: "var(--brand-primary)" }}>Start over</a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px 80px", gap: "28px" }}>
      <div style={{ animation: "ohLogoFloat 3.5s ease-in-out infinite" }}>
        <Image src="/Oh_Logo_Mark_Light.png" alt="Oh! Beef Noodle Soup" width={96} height={96} priority style={{ objectFit: "contain" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 5vw, 1.7rem)", fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
          Secure Payment
        </h1>
      </div>

      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <PaymentForm
          locale={locale}
          bookingId={bookingId}
          clientSecret={clientSecret}
          amountCents={amountCents}
          bowls={bowls}
          slot={slot}
        />
      </Elements>
    </div>
  );
}

export default function PaymentPage({ params }: PageProps) {
  const { locale } = use(params);
  return (
    <div style={{
      "--brand-primary": "#E0C38C",
      "--brand-secondary": "#8A7055",
      "--brand-bg": "#0D0D0B",
      "--brand-on-primary": "#1A1612",
      "--brand-surface": "rgba(199,168,120,0.08)",
      "--brand-border": "rgba(199,168,120,0.2)",
    } as React.CSSProperties}>
      <ThemedBackground />
      <Suspense fallback={<div />}>
        <PaymentContent locale={locale} />
      </Suspense>
    </div>
  );
}
