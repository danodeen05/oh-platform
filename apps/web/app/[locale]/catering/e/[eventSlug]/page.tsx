import Link from "next/link";
import { fetchCateringEvent } from "@/lib/catering/api";
import CoBrandHeader from "@/components/catering/CoBrandHeader";
import ThemedBackground from "@/components/catering/ThemedBackground";
import Countdown from "@/components/catering/Countdown";
import { CateringViewTracker } from "./CateringViewTracker";

interface PageProps {
  params: Promise<{ locale: string; eventSlug: string }>;
}

export default async function EventLandingPage({ params }: PageProps) {
  const { locale, eventSlug } = await params;

  let event;
  try {
    event = await fetchCateringEvent(eventSlug);
  } catch {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p style={{ color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
          Event not found.
        </p>
      </div>
    );
  }

  const eventDate = new Date(event.eventDate);
  const isPast = eventDate < new Date();

  return (
    <>
      <ThemedBackground />
      <CateringViewTracker eventSlug={eventSlug} />

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
          textAlign: "center",
          gap: "32px",
        }}
      >
        {/* Co-branded header */}
        <CoBrandHeader
          clientLogoUrl={event.logoUrl}
          clientCompany={event.clientCompany}
          eventName={event.eventName}
        />

        {/* Event title */}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: "clamp(1.6rem, 6vw, 2.4rem)",
            fontWeight: 700,
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
            lineHeight: 1.2,
            maxWidth: "480px",
          }}>
            {event.eventName}
          </h1>
          <p style={{
            margin: "12px 0 0",
            fontSize: "1rem",
            color: "var(--brand-primary)",
            opacity: 0.65,
            fontFamily: "'Raleway', sans-serif",
          }}>
            {eventDate.toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric", year: "numeric"
            })}
            {" · "}
            {event.slot.charAt(0) + event.slot.slice(1).toLowerCase()}
          </p>
        </div>

        {/* Countdown */}
        {!isPast && (
          <Countdown targetDate={eventDate} label="Event starts in" />
        )}

        {/* Company description teaser */}
        {event.companyDescription && (
          <p style={{
            maxWidth: "440px",
            fontSize: "0.9rem",
            color: "var(--brand-primary)",
            opacity: 0.6,
            fontFamily: "'Raleway', sans-serif",
            lineHeight: 1.6,
            margin: 0,
          }}>
            {event.companyDescription}
          </p>
        )}

        {/* CTA cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "320px" }}>
          <Link
            href={`/${locale}/catering/e/${eventSlug}/rsvp`}
            style={{
              display: "block",
              padding: "16px 24px",
              background: "var(--brand-primary)",
              color: "var(--brand-on-primary)",
              borderRadius: "50px",
              textDecoration: "none",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              transition: "transform 0.2s ease",
            }}
          >
            RSVP
          </Link>

          <Link
            href={`/${locale}/catering/e/${eventSlug}/survey`}
            style={{
              display: "block",
              padding: "12px 24px",
              background: "transparent",
              color: "var(--brand-primary)",
              border: "1px solid var(--brand-border)",
              borderRadius: "50px",
              textDecoration: "none",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              fontSize: "0.85rem",
              letterSpacing: "1px",
              opacity: 0.7,
            }}
          >
            Share Feedback
          </Link>
        </div>

        {/* Oh! branding footer */}
        <p style={{
          fontSize: "0.72rem",
          color: "var(--brand-primary)",
          opacity: 0.3,
          fontFamily: "'Raleway', sans-serif",
          letterSpacing: "1px",
          margin: 0,
        }}>
          Powered by Oh! Beef Noodle Soup
        </p>
      </div>
    </>
  );
}
