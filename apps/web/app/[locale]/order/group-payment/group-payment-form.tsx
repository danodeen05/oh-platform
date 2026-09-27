"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useSiteApi } from "@/lib/site/api";
import { groupPaymentIntent, groupConfirmPayment, type OrderApiError } from "@/lib/site/orders";
import { StripeProvider, PaymentForm } from "@/components/payments";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Host pays for the whole group (Task A7).
 *
 * The API creates ONE PaymentIntent for the sum of the group's unpaid orders
 * (their server-quoted amountDueCents) and, after Stripe takes the card,
 * verifies it and marks every order PAID in one step. The page never sends
 * an amount or a payment status. Only the signed-in host can do this.
 */
export default function GroupPaymentForm({
  groupCode,
  seatingOption,
  locationId,
  hostOrderId,
  hostOrderNumber,
}: {
  groupCode: string;
  seatingOption: number | null;
  locationId: string;
  hostOrderId: string;
  hostOrderNumber: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useSiteApi();
  const { isLoaded, isSignedIn } = useUser();
  const t = useTranslations("groupOrder.hostPay");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [intent, setIntent] = useState<{ clientSecret: string | null; amountCents: number; orderCount: number } | null>(null);
  const started = useRef(false);

  const messageFor = useCallback(
    (err: OrderApiError, status: number) => {
      if (err.refunded) return t("refunded");
      if (status === 403) return t("notHost");
      switch (err.code) {
        case "NOTHING_TO_PAY":
          return t("nothingToPay");
        case "GROUP_CHANGED":
        case "QUOTE_CHANGED":
        case "CREDIT_SHORT":
        case "GIFT_CARD_SHORT":
        case "MEAL_GIFT_UNAVAILABLE":
        case "REWARD_UNAVAILABLE":
          return t("groupChanged");
        case "PAYMENT_NOT_VERIFIED":
        case "PAYMENT_REQUIRED":
          return t("notVerified");
        default:
          return t("failed");
      }
    },
    [t],
  );

  /** Pods for everyone, then the kitchen (host-only on the API). Payment is already recorded. */
  const finish = useCallback(
    async (orderCount: number) => {
      const option = seatingOption || 1;
      let seatIds: string[] = [];
      try {
        const seatsRes = await fetch(`${BASE}/locations/${locationId}/seats`, { headers: { "x-tenant-slug": "oh" } });
        if (seatsRes.ok) {
          const seats = await seatsRes.json();
          const free = seats.filter((s: { status: string }) => s.status === "AVAILABLE");
          if (free.length >= orderCount) {
            const start = option === 1 ? 0 : option === 2 ? Math.floor(free.length / 3) : Math.floor((free.length * 2) / 3);
            seatIds = free.slice(start, start + orderCount).map((s: { id: string }) => s.id);
          }
        }
        await api(`${BASE}/group-orders/${encodeURIComponent(groupCode)}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-slug": "oh" },
          body: JSON.stringify({ seatIds, seatingOption: option }),
        });
      } catch (e) {
        console.error("Group seating after payment failed:", e);
      }
      router.push(
        `/order/confirmation?orderId=${hostOrderId}&orderNumber=${hostOrderNumber}&groupCode=${groupCode}&orderCount=${orderCount}&paid=true`,
      );
    },
    [api, groupCode, hostOrderId, hostOrderNumber, locationId, router, seatingOption],
  );

  const confirm = useCallback(
    async (paymentIntentId: string | null) => {
      setProcessing(true);
      setError("");
      const res = await groupConfirmPayment(groupCode, paymentIntentId, { fetcher: api, baseUrl: BASE });
      if (!res.ok) {
        setError(messageFor(res.error, res.status));
        setProcessing(false);
        return;
      }
      await finish(res.data.orders?.length || intent?.orderCount || 1);
    },
    [api, finish, groupCode, intent?.orderCount, messageFor],
  );

  // Coming back from a 3D Secure redirect: confirm that PaymentIntent, don't start a new one.
  const returnedIntent = searchParams.get("payment_intent");
  const returnedStatus = searchParams.get("redirect_status");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || started.current) return;
    started.current = true;
    if (returnedIntent) {
      if (returnedStatus === "succeeded" || returnedStatus === "processing") confirm(returnedIntent);
      else setError(t("failed"));
      return;
    }
    (async () => {
      const res = await groupPaymentIntent(groupCode, { fetcher: api, baseUrl: BASE });
      if (!res.ok) {
        setError(messageFor(res.error, res.status));
        return;
      }
      // A revisit after the host already paid: the API settled that payment; never charge again.
      if (res.data.alreadyPaid) {
        setProcessing(true);
        await finish(res.data.orderIds?.length || 1);
        return;
      }
      setIntent({ clientSecret: res.data.clientSecret, amountCents: res.data.amountCents, orderCount: res.data.orderIds?.length || 1 });
    })();
  }, [isLoaded, isSignedIn, returnedIntent, returnedStatus, groupCode, api, confirm, finish, messageFor, t]);

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?groupCode=${encodeURIComponent(groupCode)}${seatingOption ? `&seatingOption=${seatingOption}` : ""}`
      : "";

  if (!isLoaded) {
    return <p style={{ textAlign: "center", padding: "40px 0", color: "#666" }}>{t("loading")}</p>;
  }

  if (!isSignedIn) {
    return (
      <div style={{ background: "rgba(124, 122, 103, 0.1)", border: "2px solid #7C7A67", borderRadius: 12, padding: 32, textAlign: "center" }}>
        <h3 style={{ marginBottom: 12 }}>{t("signInTitle")}</h3>
        <p style={{ color: "#666", marginBottom: 24 }}>{t("signInBody")}</p>
        <SignInButton mode="modal">
          <button
            style={{ minHeight: 44, padding: "16px 32px", background: "#7C7A67", color: "white", border: "none", borderRadius: 12, fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer" }}
          >
            {t("signIn")}
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div role="alert" style={{ background: "#fee2e2", border: "1px solid #ef4444", borderRadius: 8, padding: 12, marginBottom: 16, color: "#991b1b" }}>
          {error}
        </div>
      )}

      {processing && <p style={{ textAlign: "center", color: "#666" }}>{t("processing")}</p>}

      {!processing && !error && !intent && <p style={{ textAlign: "center", color: "#666" }}>{t("loading")}</p>}

      {!processing && intent && intent.amountCents > 0 && intent.clientSecret && (
        <div data-testid="group-payment-form">
          <p style={{ fontWeight: 600, marginBottom: 12 }}>{t("amountDue", { amount: `$${(intent.amountCents / 100).toFixed(2)}` })}</p>
          <StripeProvider key={intent.clientSecret} clientSecret={intent.clientSecret}>
            <PaymentForm
              amountCents={intent.amountCents}
              onSuccess={(id) => confirm(id)}
              onError={(message) => {
                setError(message);
                setProcessing(false);
              }}
              onProcessingChange={setProcessing}
              showExpressCheckout={true}
              showSaveCard={false}
              returnUrl={returnUrl}
              disabled={processing}
            />
          </StripeProvider>
        </div>
      )}

      {!processing && intent && intent.amountCents === 0 && (
        <button
          onClick={() => confirm(null)}
          style={{ width: "100%", minHeight: 44, padding: 16, background: "#7C7A67", color: "white", border: "none", borderRadius: 12, fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer" }}
        >
          {t("confirmFree")}
        </button>
      )}

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <a href={`/group/${groupCode}`} style={{ color: "#7C7A67", textDecoration: "none", fontSize: "0.9rem" }}>
          {t("returnToGroup")}
        </a>
      </div>
    </div>
  );
}
