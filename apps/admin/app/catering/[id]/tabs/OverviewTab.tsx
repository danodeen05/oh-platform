"use client";

// NEXT_PUBLIC_WEB_URL isn't defined in dev, so derive the web origin from the
// admin host: dev admin -> dev web, prod admin -> prod web. Otherwise share
// links (attendee/RSVP, dashboard, survey) point at production from dev.
function getWebOrigin() {
  if (process.env.NEXT_PUBLIC_WEB_URL) return process.env.NEXT_PUBLIC_WEB_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("devadmin") || host.includes("localhost")) {
      return "https://devwebapp.ohbeef.com";
    }
  }
  return "https://www.ohbeef.com";
}

import StatCard from "../../../analytics/components/StatCard";
import QRCode from "../../../_components/qr-code";
import EnrichmentReview from "../../_components/EnrichmentReview";
import LogoUpload from "../../_components/LogoUpload";
import type { CateringEvent } from "../../_components/types";

interface OverviewTabProps {
  event: CateringEvent;
  onRefresh: () => void;
}

export default function OverviewTab({ event, onRefresh }: OverviewTabProps) {
  const WEB_ORIGIN = getWebOrigin();
  const attendeeUrl = `${WEB_ORIGIN}/en/catering/e/${event.slug}`;
  const dashboardUrl = event.booking?.bookingToken
    ? `${WEB_ORIGIN}/en/catering/dashboard/${event.booking.bookingToken}`
    : null;

  const showEnrichment = event.status === "NEEDS_REVIEW" || event.status === "ENRICHING";

  return (
    <div>
      {/* Event Config Summary */}
      <div
        style={{
          backgroundColor: "#f9fafb",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          border: "1px solid #e5e7eb",
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Event Details</h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            fontSize: "0.9rem",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 2 }}>Client Company</div>
            <div style={{ fontWeight: 500 }}>{event.clientCompany}</div>
          </div>
          {event.clientWebsite && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 2 }}>Website</div>
              <a
                href={event.clientWebsite}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4f46e5", textDecoration: "none", wordBreak: "break-all" }}
              >
                {event.clientWebsite}
              </a>
            </div>
          )}
          {event.contactName && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 2 }}>Contact</div>
              <div>{event.contactName}</div>
              {event.contactEmail && (
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{event.contactEmail}</div>
              )}
              {event.contactPhone && (
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{event.contactPhone}</div>
              )}
            </div>
          )}
          {event.eventAddress && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 2 }}>Event Address</div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.eventAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4f46e5", textDecoration: "none" }}
              >
                {event.eventAddress}
              </a>
            </div>
          )}
          <div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 2 }}>Event Code</div>
            <code
              style={{
                fontFamily: "monospace",
                backgroundColor: "#e5e7eb",
                padding: "2px 6px",
                borderRadius: 3,
              }}
            >
              {event.eventCode}
            </code>
          </div>
          {event.notes && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 2 }}>Notes</div>
              <div style={{ fontSize: "0.85rem", color: "#374151", whiteSpace: "pre-wrap" }}>{event.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Logo upload — replaces the AI-scraped logo */}
      <div style={{ marginBottom: 20 }}>
        <LogoUpload eventId={event.id} currentLogoUrl={event.logoUrl} onSaved={onRefresh} />
      </div>

      {/* Booking / Payment StatCards */}
      {event.booking && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <StatCard
            title="Bowls Booked"
            value={event.booking.bowlsBooked}
            color="blue"
          />
          <StatCard
            title="Price Per Bowl"
            value={`$${(event.pricePerBowlCents / 100).toFixed(2)}`}
            color="default"
          />
          <StatCard
            title="Total Charged"
            value={`$${(event.booking.priceCents / 100).toFixed(2)}`}
            color="green"
          />
          <StatCard
            title="Amount Paid"
            value={`$${(event.booking.paidCents / 100).toFixed(2)}`}
            subtitle={event.booking.paymentStatus}
            color={event.booking.paidCents >= event.booking.priceCents ? "green" : "yellow"}
          />
          {event.booking.promoCode && (
            <StatCard title="Promo Code" value={event.booking.promoCode} color="default" />
          )}
        </div>
      )}

      {!event.booking && (
        <div
          style={{
            padding: 16,
            backgroundColor: "#fef3c7",
            borderRadius: 8,
            border: "1px solid #f59e0b",
            marginBottom: 20,
            fontSize: "0.9rem",
            color: "#92400e",
          }}
        >
          No booking confirmed yet. Minimum commitment: {event.minimumBowls} bowls @ $
          {(event.pricePerBowlCents / 100).toFixed(2)}/bowl = $
          {((event.minimumBowls * event.pricePerBowlCents) / 100).toFixed(2)}
        </div>
      )}

      {/* Enrichment Review */}
      {showEnrichment && (
        <div
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            border: "1px solid #e5e7eb",
          }}
        >
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>AI Brand Enrichment</h4>
          <EnrichmentReview eventId={event.id} onPublished={onRefresh} />
        </div>
      )}

      {/* QR Codes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: dashboardUrl ? "1fr 1fr" : "1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            padding: 20,
            border: "1px solid #e5e7eb",
            textAlign: "center",
          }}
        >
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Attendee Event Page</h4>
          <QRCode value={attendeeUrl} size={160} title="" showValue />
          <div style={{ marginTop: 12 }}>
            <a
              href={attendeeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "0.8rem", color: "#4f46e5", textDecoration: "none" }}
            >
              Open link
            </a>
          </div>
        </div>

        {dashboardUrl && (
          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: 8,
              padding: 20,
              border: "1px solid #e5e7eb",
              textAlign: "center",
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: 12 }}>Client Dashboard</h4>
            <QRCode value={dashboardUrl} size={160} title="" showValue />
            <div style={{ marginTop: 12 }}>
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.8rem", color: "#4f46e5", textDecoration: "none" }}
              >
                Open link
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
