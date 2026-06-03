import { fetchDashboard } from "@/lib/catering/api";
import QRCode from "qrcode";
import Image from "next/image";
import CopyLink from "./CopyLink";

const ZODIAC_EMOJI: Record<string, string> = {
  Rat: "🐀", Ox: "🐂", Tiger: "🐅", Rabbit: "🐇", Dragon: "🐉", Snake: "🐍",
  Horse: "🐴", Goat: "🐐", Monkey: "🐒", Rooster: "🐓", Dog: "🐕", Pig: "🐖",
};

interface PageProps {
  params: Promise<{ locale: string; bookingToken: string }>;
}

/**
 * Client dashboard — server-rendered, token in URL (no auth required).
 * Shows RSVP list, attendee share URL, and a server-generated QR code.
 */
export default async function DashboardPage({ params }: PageProps) {
  const { locale, bookingToken } = await params;

  let data;
  try {
    data = await fetchDashboard(bookingToken);
  } catch {
    return (
      <div style={{
        "--brand-primary": "#E0C38C",
        "--brand-bg": "#0D0D0B",
        minHeight: "100vh",
        background: "var(--brand-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      } as React.CSSProperties}>
        <p style={{ color: "#E0C38C", fontFamily: "'Raleway', sans-serif" }}>Dashboard not found.</p>
      </div>
    );
  }

  const { event, rsvps, shareUrl } = data;

  // Generate QR code as data URL (server-side). Level H tolerates the center
  // logo overlay without breaking scannability.
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 220, margin: 2, errorCorrectionLevel: "H" });
  } catch {
    // QR generation failed — leave empty, show text link only
  }

  const eventDate = new Date(event.eventDate).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  return (
    <div style={{
      "--brand-primary": "#E0C38C",
      "--brand-secondary": "#8A7055",
      "--brand-bg": "#0D0D0B",
      "--brand-on-primary": "#1A1612",
      "--brand-surface": "rgba(199,168,120,0.08)",
      "--brand-border": "rgba(199,168,120,0.2)",
      minHeight: "100vh",
      background: "var(--brand-bg)",
      fontFamily: "'Raleway', sans-serif",
      padding: "40px 24px 80px",
    } as React.CSSProperties}>
      <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>

        {/* Header — Oh! mark (white, floating) co-branded with the client logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", flexWrap: "wrap", marginBottom: "4px" }}>
          <div style={{ animation: "ohLogoFloat 3.5s ease-in-out infinite" }}>
            <Image src="/Oh_Logo_Mark_Light.png" alt="Oh! Beef Noodle Soup" width={84} height={84} priority style={{ objectFit: "contain" }} />
          </div>
          {event.logoUrl && (
            <>
              <span style={{ color: "var(--brand-primary)", opacity: 0.5, fontSize: "1.6rem", fontWeight: 300 }}>×</span>
              {/* Client logos vary (often dark-on-transparent), so keep a clean
                  light chip so any logo stays visible on the dark background. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div style={{ background: "#FBF7F0", borderRadius: "12px", padding: "12px 18px", display: "flex", alignItems: "center" }}>
                <img src={event.logoUrl} alt={event.clientCompany} style={{ maxHeight: "52px", maxWidth: "150px", objectFit: "contain" }} />
              </div>
            </>
          )}
        </div>

        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 5vw, 1.8rem)", fontWeight: 700, color: "var(--brand-primary)" }}>
            {event.eventName}
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--brand-primary)", opacity: 0.7, fontSize: "0.88rem" }}>
            {eventDate} · {event.slot.charAt(0) + event.slot.slice(1).toLowerCase()} · {event.clientCompany}
          </p>
          {event.companyDescription && (
            <p style={{ margin: "10px 0 0", color: "var(--brand-primary)", opacity: 0.6, fontSize: "0.85rem", lineHeight: 1.5, maxWidth: "520px" }}>
              {event.companyDescription}
            </p>
          )}
        </div>

        {/* Share section */}
        <div style={{ background: "var(--brand-surface)", border: "1px solid var(--brand-border)", borderRadius: "16px", padding: "24px" }}>
          <p style={{ margin: "0 0 14px", fontSize: "0.72rem", color: "var(--brand-primary)", opacity: 0.55, textTransform: "uppercase", letterSpacing: "1px" }}>
            Share with attendees
          </p>

          {qrDataUrl && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <div style={{ position: "relative", background: "white", padding: "10px", borderRadius: "10px", lineHeight: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Attendee QR Code" width={200} height={200} />
                {/* Oh! mark in the center, matching the rest of the site's QR codes */}
                <div style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "white",
                  borderRadius: "10px",
                  padding: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Image src="/Oh_Logo_Mark_Web.png" alt="" width={40} height={40} style={{ objectFit: "contain" }} />
                </div>
              </div>
            </div>
          )}

          <CopyLink url={shareUrl} />
        </div>

        {/* RSVP list */}
        <div style={{ background: "var(--brand-surface)", border: "1px solid var(--brand-border)", borderRadius: "16px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--brand-primary)", opacity: 0.55, textTransform: "uppercase", letterSpacing: "1px" }}>
              RSVPs
            </p>
            <span style={{ background: "var(--brand-primary)", color: "var(--brand-on-primary)", borderRadius: "50px", padding: "2px 12px", fontSize: "0.78rem", fontWeight: 700 }}>
              {rsvps.length}
            </span>
          </div>

          {rsvps.length === 0 ? (
            <p style={{ margin: 0, color: "var(--brand-primary)", opacity: 0.35, fontSize: "0.85rem" }}>
              No RSVPs yet. Share the link above with your guests.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {rsvps.map((rsvp) => (
                <div key={rsvp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid var(--brand-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    {/* Bold gold checkmark when this guest has placed their bowl order */}
                    <span
                      title={rsvp.ordered ? "Order placed" : "No order yet"}
                      style={{
                        flexShrink: 0,
                        width: "18px",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: "1rem",
                        color: rsvp.ordered ? "var(--brand-primary)" : "transparent",
                      }}
                    >
                      {rsvp.ordered ? "✓" : ""}
                    </span>
                    <span style={{ color: "var(--brand-primary)", fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {rsvp.name}
                      {rsvp.zodiac && (
                        <span style={{ fontWeight: 400, opacity: 0.6 }}>
                          {" · "}
                          {ZODIAC_EMOJI[rsvp.zodiac] ? `${ZODIAC_EMOJI[rsvp.zodiac]} ` : ""}
                          {rsvp.zodiac}
                        </span>
                      )}
                    </span>
                  </div>
                  <p style={{ margin: 0, flexShrink: 0, color: "var(--brand-primary)", opacity: 0.4, fontSize: "0.72rem", textAlign: "right" }}>
                    {new Date(rsvp.createdAt).toLocaleString("en-US", {
                      month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                      timeZone: "America/Denver",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ margin: 0, textAlign: "center", fontSize: "0.72rem", color: "var(--brand-primary)", opacity: 0.25 }}>
          Powered by Oh! Beef Noodle Soup · Refresh this page to see new RSVPs
        </p>
      </div>
    </div>
  );
}
