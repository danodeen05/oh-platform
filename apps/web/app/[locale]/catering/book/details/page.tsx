"use client";

import { useState, FormEvent, Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBooking } from "@/lib/catering/api";
import { formatPhone } from "@/lib/catering/format";
import { trackCateringBookingSubmitted } from "@/lib/catering/analytics";
import Image from "next/image";
import ThemedBackground from "@/components/catering/ThemedBackground";

interface PageProps {
  params: Promise<{ locale: string }>;
}

function DetailsContent({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") || "";
  const slot = (searchParams.get("slot") || "LUNCH") as "LUNCH" | "DINNER";
  const bowls = parseInt(searchParams.get("bowls") || "10", 10);

  const [clientCompany, setClientCompany] = useState("");
  const [clientWebsite, setClientWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const digits = contactPhone.replace(/\D/g, "");
    if (!clientCompany.trim()) { setError("Company name is required"); return; }
    if (!contactName.trim()) { setError("Contact name is required"); return; }
    if (!contactEmail.trim() || !contactEmail.includes("@")) { setError("Valid email is required"); return; }
    if (digits.length < 10) { setError("Valid phone number is required"); return; }

    setIsSubmitting(true);
    try {
      const result = await createBooking({
        clientCompany: clientCompany.trim(),
        clientWebsite: clientWebsite.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: digits,
        eventDate: date,
        slot,
        bowls,
        notes: notes.trim(),
      });

      trackCateringBookingSubmitted(bowls);

      // Store booking info for payment page
      sessionStorage.setItem("catering_booking_id", result.bookingId);
      sessionStorage.setItem("catering_client_secret", result.clientSecret);
      sessionStorage.setItem("catering_amount_cents", String(result.amountCents));
      sessionStorage.setItem("catering_bowls", String(bowls));

      const qs = new URLSearchParams({ date, slot, bowls: String(bowls) });
      router.push(`/${locale}/catering/book/payment?${qs.toString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Booking failed. Please try again.";
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const formattedDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px 80px", gap: "28px" }}>
      {/* Oh! Logo — white mark on transparent, gently floating */}
      <div style={{ animation: "ohLogoFloat 3.5s ease-in-out infinite" }}>
        <Image src="/Oh_Logo_Mark_Light.png" alt="Oh! Beef Noodle Soup" width={96} height={96} priority style={{ objectFit: "contain" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 5vw, 1.7rem)", fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
          Event Details
        </h1>
        {formattedDate && (
          <p style={{ margin: "8px 0 0", color: "var(--brand-primary)", opacity: 0.85, fontFamily: "'Raleway', sans-serif", fontSize: "0.88rem" }}>
            {formattedDate} · {slot} · {bowls} bowls
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", maxWidth: "420px" }}>
        <div>
          <label style={labelStyle}>Company / Organization *</label>
          <input type="text" value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="Acme Corp" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Company Website <span style={{ fontWeight: 400, opacity: 0.5, fontSize: "0.78rem" }}>Optional</span></label>
          <input type="url" value={clientWebsite} onChange={e => setClientWebsite(e.target.value)} placeholder="https://yourcompany.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Contact Name *</label>
          <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Contact Email *</label>
          <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@company.com" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Contact Phone *</label>
          <input type="tel" value={contactPhone} onChange={e => setContactPhone(formatPhone(e.target.value))} placeholder="(xxx) xxx-xxxx" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>
            Additional Details <span style={{ fontWeight: 400, opacity: 0.5, fontSize: "0.78rem" }}>Optional</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Dietary restrictions, allergies, special requests, setup notes, etc."
            rows={4}
            maxLength={1000}
            style={{ ...inputStyle, minHeight: "96px", resize: "vertical", fontFamily: "'Raleway', sans-serif" }}
          />
        </div>

        {error && (
          <p style={{ margin: 0, color: "#ef4444", fontSize: "0.85rem", fontFamily: "'Raleway', sans-serif" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: "15px",
            background: "var(--brand-primary)",
            color: "var(--brand-on-primary)",
            border: "none",
            borderRadius: "50px",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 700,
            fontSize: "1rem",
            letterSpacing: "1px",
            cursor: isSubmitting ? "default" : "pointer",
            opacity: isSubmitting ? 0.7 : 1,
            marginTop: "8px",
            transition: "all 0.2s ease",
          }}
        >
          {isSubmitting ? "Processing..." : "Continue to Payment"}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "var(--brand-primary)",
  fontFamily: "'Raleway', sans-serif",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontSize: "0.95rem",
  borderRadius: "10px",
  border: "1.5px solid var(--brand-border, rgba(199,168,120,0.25))",
  background: "var(--brand-surface, rgba(199,168,120,0.06))",
  color: "var(--brand-primary, #C7A878)",
  fontFamily: "'Raleway', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

export default function DetailsPage({ params }: PageProps) {
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
        <DetailsContent locale={locale} />
      </Suspense>
    </div>
  );
}
