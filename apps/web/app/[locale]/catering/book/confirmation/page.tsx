"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { QRCodeCanvas } from "qrcode.react";
import ThemedBackground from "@/components/catering/ThemedBackground";
import Link from "next/link";

interface PageProps {
  params: Promise<{ locale: string }>;
}

function ConfirmationContent({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get("eventSlug") || "";
  const bookingToken = searchParams.get("bookingToken") || "";

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const attendeeUrl = origin && eventSlug ? `${origin}/${locale}/catering/e/${eventSlug}` : "";
  const dashboardUrl = origin && bookingToken ? `${origin}/${locale}/catering/dashboard/${bookingToken}` : "";

  return (
    <div style={{
      position: "relative",
      zIndex: 1,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "40px 24px 80px",
      gap: "28px",
      textAlign: "center",
    }}>
      <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: "12px", padding: "10px 18px" }}>
        <Image src="/Oh_Logo_Large.png" alt="Oh! Beef Noodle Soup" width={120} height={48} style={{ objectFit: "contain" }} />
      </div>

      <div>
        <h1 style={{ margin: 0, fontSize: "clamp(1.4rem, 5vw, 1.9rem)", fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
          Booking Confirmed!
        </h1>
        <p style={{ margin: "10px 0 0", color: "var(--brand-primary)", opacity: 0.6, fontFamily: "'Raleway', sans-serif", fontSize: "0.9rem", maxWidth: "360px" }}>
          You're all set. Share the attendee link with your guests — they'll RSVP and choose their bowls.
        </p>
      </div>

      {/* Attendee URL + QR */}
      {attendeeUrl && (
        <div style={{ width: "100%", maxWidth: "380px", background: "var(--brand-surface)", border: "1px solid var(--brand-border)", borderRadius: "16px", padding: "24px" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.72rem", color: "var(--brand-primary)", opacity: 0.55, fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "1px" }}>
            Attendee Link
          </p>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <div style={{ background: "white", padding: "12px", borderRadius: "10px" }}>
              <QRCodeCanvas
                value={attendeeUrl}
                size={160}
                level="M"
              />
            </div>
          </div>

          <p style={{ margin: "0 0 10px", fontSize: "0.82rem", color: "var(--brand-primary)", opacity: 0.8, fontFamily: "'Raleway', sans-serif", wordBreak: "break-all" }}>
            {attendeeUrl}
          </p>

          <button
            onClick={() => navigator.clipboard?.writeText(attendeeUrl)}
            style={{
              padding: "10px 24px",
              background: "var(--brand-primary)",
              color: "var(--brand-on-primary)",
              border: "none",
              borderRadius: "50px",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              letterSpacing: "0.5px",
            }}
          >
            Copy Link
          </button>
        </div>
      )}

      {/* Dashboard link */}
      {dashboardUrl && (
        <div style={{ width: "100%", maxWidth: "380px" }}>
          <Link
            href={dashboardUrl}
            style={{
              display: "block",
              padding: "14px",
              background: "transparent",
              border: "1px solid var(--brand-border)",
              borderRadius: "50px",
              color: "var(--brand-primary)",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            View Event Dashboard
          </Link>
        </div>
      )}

      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--brand-primary)", opacity: 0.35, fontFamily: "'Raleway', sans-serif" }}>
        A confirmation email has been sent to your contact address.
      </p>
    </div>
  );
}

export default function BookingConfirmationPage({ params }: PageProps) {
  const { locale } = use(params);
  return (
    <div style={{
      "--brand-primary": "#C7A878",
      "--brand-secondary": "#8A7055",
      "--brand-bg": "#0D0D0B",
      "--brand-on-primary": "#1A1612",
      "--brand-surface": "rgba(199,168,120,0.08)",
      "--brand-border": "rgba(199,168,120,0.2)",
    } as React.CSSProperties}>
      <ThemedBackground />
      <Suspense fallback={<div />}>
        <ConfirmationContent locale={locale} />
      </Suspense>
    </div>
  );
}
