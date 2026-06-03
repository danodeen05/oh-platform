"use client";

import { useState, useEffect, Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchCateringEvent,
  checkAttendeeOrder,
  placeOrder,
  deleteOrder,
  type CateringEvent,
  type OrderItem,
} from "@/lib/catering/api";
import { getRememberedAttendee } from "@/lib/catering/remember";
import { trackCateringOrderPlaced } from "@/lib/catering/analytics";
import ThemedBackground from "@/components/catering/ThemedBackground";
import CoBrandHeader from "@/components/catering/CoBrandHeader";
import ChappyGreeting from "./ChappyGreeting";
import OrderWizard from "@/components/catering/OrderWizard";
import Link from "next/link";

interface PageProps {
  params: Promise<{ locale: string; eventSlug: string }>;
}

function OrderContent({ locale, eventSlug }: { locale: string; eventSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [event, setEvent] = useState<CateringEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  // Existing order
  const [existingOrder, setExistingOrder] = useState<{
    orderId: string;
    qrCode: string;
    canEdit: boolean;
    items: Array<{ menuItem: { name: string }; selectedValue?: string | null }>;
  } | null>(null);

  // Identity from URL params or remember cookie
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  useEffect(() => {
    const urlName = searchParams.get("name") || "";
    const urlPhone = searchParams.get("phone") || "";

    if (urlName && urlPhone) {
      setGuestName(urlName);
      setGuestPhone(urlPhone);
    } else {
      // Fallback to remember cookie
      const remembered = getRememberedAttendee();
      if (remembered && remembered.eventSlug === eventSlug) {
        setGuestName(remembered.name);
        setGuestPhone(remembered.phone);
      }
    }
  }, [searchParams, eventSlug]);

  useEffect(() => {
    if (!guestPhone) return;

    async function init() {
      setIsLoading(true);
      try {
        const [ev, check] = await Promise.all([
          fetchCateringEvent(eventSlug),
          checkAttendeeOrder(eventSlug, guestPhone),
        ]);
        setEvent(ev);
        if (check.exists && check.orderId) {
          setExistingOrder({
            orderId: check.orderId,
            qrCode: check.orderQrCode || "",
            canEdit: check.canEdit ?? false,
            items: (check.items || []) as Array<{ menuItem: { name: string }; selectedValue?: string | null }>,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [eventSlug, guestPhone]);

  // If no identity params yet — wait for them
  useEffect(() => {
    if (!guestPhone && !isLoading) {
      // Trigger load even without phone to get event details
      fetchCateringEvent(eventSlug)
        .then(setEvent)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [eventSlug, guestPhone, isLoading]);

  const handleSubmit = async (items: OrderItem[]) => {
    if (!guestName || !guestPhone) {
      setError("Missing identity. Please return to the RSVP page.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const result = await placeOrder(eventSlug, {
        items,
        guestName: guestName.trim(),
        guestPhone: guestPhone.replace(/\D/g, ""),
      });
      trackCateringOrderPlaced(eventSlug);
      router.push(`/${locale}/catering/e/${eventSlug}/order/confirmation?qrCode=${result.orderQrCode}&orderNumber=${result.kitchenOrderNumber}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to place order. Please try again.";
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingOrder) return;
    if (!confirm("Are you sure you want to delete your current order? You'll be able to place a new one.")) return;
    setIsDeleting(true);
    try {
      await deleteOrder(eventSlug, existingOrder.orderId);
      setExistingOrder(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not delete order.";
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const isPastEventDate = event ? new Date(event.eventDate) < new Date() : false;

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p style={{ color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 24px 80px",
        gap: "24px",
      }}
    >
      {event && (
        <CoBrandHeader
          clientLogoUrl={event.logoUrl}
          clientCompany={event.clientCompany}
          eventName={event.eventName}
          showOhLogo={false}
        />
      )}

      {/* Chappy's personalized greeting (name + zodiac if shared at RSVP) */}
      {guestPhone && <ChappyGreeting eventSlug={eventSlug} phone={guestPhone} />}

      {/* Existing order state */}
      {existingOrder && (
        <div style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--brand-surface)",
          border: "1px solid var(--brand-border)",
          borderRadius: "16px",
          padding: "20px",
        }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.75rem", color: "var(--brand-primary)", opacity: 0.55, fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "1px" }}>
            Your Order
          </p>
          {existingOrder.items.map((item, i) => (
            <p key={i} style={{ margin: "6px 0", display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
              <span>{item.menuItem.name}</span>
              {item.selectedValue && <span style={{ fontWeight: 600, opacity: 0.75 }}>{item.selectedValue}</span>}
            </p>
          ))}

          <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
            <Link
              href={`/${locale}/catering/e/${eventSlug}/status?qrCode=${existingOrder.qrCode}`}
              style={{
                flex: 1,
                display: "block",
                padding: "12px",
                background: "var(--brand-primary)",
                color: "var(--brand-on-primary)",
                borderRadius: "50px",
                textDecoration: "none",
                textAlign: "center",
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 700,
                fontSize: "0.9rem",
                letterSpacing: "1px",
              }}
            >
              Order Status
            </Link>
            {existingOrder.canEdit && !isPastEventDate && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  padding: "12px 16px",
                  background: "transparent",
                  border: "1px solid var(--brand-border)",
                  borderRadius: "50px",
                  color: "var(--brand-primary)",
                  opacity: 0.65,
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: "0.82rem",
                  cursor: isDeleting ? "default" : "pointer",
                }}
              >
                {isDeleting ? "Deleting..." : "Edit"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Wizard — only show if no existing order */}
      {!existingOrder && event && (
        <OrderWizard
          event={event}
          guestName={guestName}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}

      {/* No identity found */}
      {!guestName && !isLoading && (
        <div style={{ textAlign: "center", maxWidth: "320px" }}>
          <p style={{ color: "var(--brand-primary)", opacity: 0.6, fontFamily: "'Raleway', sans-serif", marginBottom: "16px" }}>
            Please RSVP first so we know who to make your bowl for.
          </p>
          <Link
            href={`/${locale}/catering/e/${eventSlug}/rsvp`}
            style={{
              display: "inline-block",
              padding: "13px 32px",
              background: "var(--brand-primary)",
              color: "var(--brand-on-primary)",
              borderRadius: "50px",
              textDecoration: "none",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 700,
              letterSpacing: "1px",
            }}
          >
            Go to RSVP
          </Link>
        </div>
      )}
    </div>
  );
}

export default function OrderPage({ params }: PageProps) {
  const { locale, eventSlug } = use(params);
  return (
    <>
      <ThemedBackground />
      <Suspense
        fallback={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
            <p style={{ color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>Loading...</p>
          </div>
        }
      >
        <OrderContent locale={locale} eventSlug={eventSlug} />
      </Suspense>
    </>
  );
}
