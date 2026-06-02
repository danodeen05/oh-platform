"use client";

import { useState, useEffect, FormEvent, use } from "react";
import { useRouter } from "next/navigation";
import { rsvpToEvent, fetchCateringEvent, type CateringEvent } from "@/lib/catering/api";
import { formatPhone, formatBirthdate } from "@/lib/catering/format";
import { setRememberedAttendee } from "@/lib/catering/remember";
import { trackCateringRsvp } from "@/lib/catering/analytics";
import ThemedBackground from "@/components/catering/ThemedBackground";
import CoBrandHeader from "@/components/catering/CoBrandHeader";

interface PageProps {
  params: Promise<{ locale: string; eventSlug: string }>;
}

export default function RsvpPage({ params }: PageProps) {
  const { locale, eventSlug } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<CateringEvent | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCateringEvent(eventSlug)
      .then(setEvent)
      .catch(() => setError("Event not found"));
  }, [eventSlug]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const digits = phone.replace(/\D/g, "");

    if (!trimmedName) { setError("Please enter your name"); return; }
    if (digits.length < 10) { setError("Please enter a valid 10-digit phone number"); return; }

    setIsSubmitting(true);
    try {
      await rsvpToEvent(eventSlug, {
        name: trimmedName,
        phone: digits,
        dob: dob || undefined,
      });

      setRememberedAttendee({ name: trimmedName, phone: digits, eventSlug });
      trackCateringRsvp(eventSlug);

      const qs = new URLSearchParams({ name: trimmedName, phone: digits });
      router.push(`/${locale}/catering/e/${eventSlug}/order?${qs.toString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "RSVP failed. Please try again.";
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ThemedBackground />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 24px 60px",
          gap: "28px",
        }}
      >
        {/* Header */}
        {event && (
          <CoBrandHeader
            clientLogoUrl={event.logoUrl}
            clientCompany={event.clientCompany}
            eventName={event.eventName}
            showOhLogo={false}
          />
        )}

        <div style={{ textAlign: "center" }}>
          <h1 style={{
            margin: 0,
            fontSize: "clamp(1.6rem, 7vw, 2.2rem)",
            fontWeight: 700,
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
          }}>
            RSVP
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: "0.9rem", color: "var(--brand-primary)", opacity: 0.6, fontFamily: "'Raleway', sans-serif" }}>
            Reserve your bowl — we'll make it fresh for you
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            width: "100%",
            maxWidth: "380px",
          }}
        >
          {/* Name */}
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              required
              style={inputStyle}
            />
          </div>

          {/* Phone */}
          <div>
            <label style={labelStyle}>Cell Phone *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(xxx) xxx-xxxx"
              required
              style={inputStyle}
            />
            <p style={helperStyle}>
              For order updates via text.{" "}
              <span style={{ opacity: 0.65 }}>
                By entering your number you consent to receive SMS messages from Oh! Beef Noodle Soup about this event. Reply STOP to opt out.
              </span>
            </p>
          </div>

          {/* Date of Birth — clearly optional */}
          <div>
            <label style={labelStyle}>
              Date of Birth{" "}
              <span style={{ fontWeight: 400, opacity: 0.55, fontSize: "0.78rem" }}>Optional</span>
            </label>
            <input
              type="text"
              value={dob}
              onChange={e => setDob(formatBirthdate(e.target.value))}
              placeholder="MM/DD/YYYY"
              inputMode="numeric"
              style={inputStyle}
            />
            <p style={helperStyle}>
              Optional — used only for your digital fortune cookie & zodiac insights. Never shared.
            </p>
          </div>

          {error && (
            <p style={{ margin: 0, color: "#ef4444", fontSize: "0.85rem", fontFamily: "'Raleway', sans-serif" }}>
              {error}
            </p>
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
            {isSubmitting ? "Submitting..." : "RSVP & Choose My Bowl"}
          </button>

          <p style={{ margin: 0, textAlign: "center", fontSize: "0.78rem", color: "var(--brand-primary)", opacity: 0.45, fontFamily: "'Raleway', sans-serif", lineHeight: 1.5 }}>
            Each attendee needs their own RSVP. Feel free to fill one out for others.
          </p>
        </form>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "var(--brand-primary)",
  fontFamily: "'Raleway', sans-serif",
  marginBottom: "6px",
  letterSpacing: "0.3px",
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

const helperStyle: React.CSSProperties = {
  margin: "5px 0 0",
  fontSize: "0.75rem",
  color: "var(--brand-primary)",
  opacity: 0.55,
  fontFamily: "'Raleway', sans-serif",
  lineHeight: 1.45,
};
