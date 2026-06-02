"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ThemedBackground from "@/components/catering/ThemedBackground";

interface PageProps {
  params: Promise<{ locale: string; eventSlug: string }>;
}

function ConfirmationContent({ locale, eventSlug }: { locale: string; eventSlug: string }) {
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qrCode") || "";
  const orderNumber = searchParams.get("orderNumber") || "";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        gap: "28px",
        textAlign: "center",
      }}
    >
      <div style={{
        fontSize: "3rem",
        animation: "bounceIn 0.6s ease",
      }}>
        ✓
      </div>

      <div>
        <h1 style={{
          margin: 0,
          fontSize: "clamp(1.4rem, 5vw, 1.8rem)",
          fontWeight: 700,
          color: "var(--brand-primary)",
          fontFamily: "'Raleway', sans-serif",
        }}>
          Order Placed!
        </h1>
        {orderNumber && (
          <p style={{
            margin: "8px 0 0",
            fontSize: "0.85rem",
            color: "var(--brand-primary)",
            opacity: 0.55,
            fontFamily: "'Raleway', sans-serif",
          }}>
            Order #{orderNumber}
          </p>
        )}
      </div>

      <p style={{
        maxWidth: "320px",
        fontSize: "0.95rem",
        color: "var(--brand-primary)",
        opacity: 0.7,
        fontFamily: "'Raleway', sans-serif",
        lineHeight: 1.6,
        margin: 0,
      }}>
        We'll make your bowl fresh at the event. Track your order status below.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "300px" }}>
        {qrCode && (
          <Link
            href={`/${locale}/catering/e/${eventSlug}/status?qrCode=${qrCode}`}
            style={{
              display: "block",
              padding: "15px",
              background: "var(--brand-primary)",
              color: "var(--brand-on-primary)",
              borderRadius: "50px",
              textDecoration: "none",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              letterSpacing: "1.5px",
            }}
          >
            Track My Order
          </Link>
        )}
        <Link
          href={`/${locale}/catering/e/${eventSlug}`}
          style={{
            display: "block",
            padding: "12px",
            background: "transparent",
            border: "1px solid var(--brand-border)",
            borderRadius: "50px",
            textDecoration: "none",
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
            fontSize: "0.85rem",
            opacity: 0.6,
          }}
        >
          Back to Event
        </Link>
      </div>

      <style>{`
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.5); }
          60% { transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function OrderConfirmationPage({ params }: PageProps) {
  const { locale, eventSlug } = use(params);
  return (
    <>
      <ThemedBackground />
      <Suspense fallback={<div />}>
        <ConfirmationContent locale={locale} eventSlug={eventSlug} />
      </Suspense>
    </>
  );
}
