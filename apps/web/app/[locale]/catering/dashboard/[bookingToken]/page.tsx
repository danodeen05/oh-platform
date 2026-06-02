import { fetchDashboard } from "@/lib/catering/api";
import QRCode from "qrcode";
import Image from "next/image";

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
        "--brand-primary": "#C7A878",
        "--brand-bg": "#0D0D0B",
        minHeight: "100vh",
        background: "var(--brand-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      } as React.CSSProperties}>
        <p style={{ color: "#C7A878", fontFamily: "'Raleway', sans-serif" }}>Dashboard not found.</p>
      </div>
    );
  }

  const { event, rsvps, shareUrl } = data;

  // Generate QR code as data URL (server-side)
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 200, margin: 2 });
  } catch {
    // QR generation failed — leave empty, show text link only
  }

  const eventDate = new Date(event.eventDate).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  return (
    <div style={{
      "--brand-primary": "#C7A878",
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

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: "10px", padding: "8px 14px" }}>
            <Image src="/Oh_Logo_Large.png" alt="Oh! Beef Noodle Soup" width={100} height={40} style={{ objectFit: "contain" }} />
          </div>
          {event.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: "10px", padding: "8px 14px" }}>
              <img src={event.logoUrl} alt={event.clientCompany} style={{ maxHeight: "40px", maxWidth: "120px", objectFit: "contain" }} />
            </div>
          )}
        </div>

        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 5vw, 1.8rem)", fontWeight: 700, color: "var(--brand-primary)" }}>
            {event.eventName}
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--brand-primary)", opacity: 0.55, fontSize: "0.88rem" }}>
            {eventDate} · {event.slot.charAt(0) + event.slot.slice(1).toLowerCase()} · {event.clientCompany}
          </p>
        </div>

        {/* Share section */}
        <div style={{ background: "var(--brand-surface)", border: "1px solid var(--brand-border)", borderRadius: "16px", padding: "24px" }}>
          <p style={{ margin: "0 0 14px", fontSize: "0.72rem", color: "var(--brand-primary)", opacity: 0.55, textTransform: "uppercase", letterSpacing: "1px" }}>
            Share with attendees
          </p>

          {qrDataUrl && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <div style={{ background: "white", padding: "10px", borderRadius: "10px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Attendee QR Code" width={180} height={180} />
              </div>
            </div>
          )}

          <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "var(--brand-primary)", opacity: 0.7, wordBreak: "break-all" }}>
            {shareUrl}
          </p>
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
                <div key={rsvp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--brand-border)" }}>
                  <p style={{ margin: 0, color: "var(--brand-primary)", fontWeight: 600, fontSize: "0.9rem" }}>
                    {rsvp.name}
                  </p>
                  <p style={{ margin: 0, color: "var(--brand-primary)", opacity: 0.4, fontSize: "0.78rem" }}>
                    {new Date(rsvp.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
