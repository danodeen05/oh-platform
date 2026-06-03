"use client";

interface LockedPreviewCardProps {
  title: string;
  teaser: string;
  icon?: string;
}

/**
 * A blurred / locked teaser card shown in PHASE A of the status page
 * (before the order is being prepped). Signals upcoming delight without
 * revealing live data.
 */
export default function LockedPreviewCard({ title, teaser, icon }: LockedPreviewCardProps) {
  return (
    <div
      style={{
        position: "relative",
        background: "var(--brand-surface)",
        border: "1px solid var(--brand-border)",
        borderRadius: "16px",
        padding: "22px 20px",
        overflow: "hidden",
      }}
    >
      {/* Blurred placeholder bars — purely decorative background. Absolutely
          positioned so the real content below drives the card's height. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          padding: "20px",
          filter: "blur(6px)",
          userSelect: "none",
          pointerEvents: "none",
          opacity: 0.35,
        }}
      >
        <div style={{ height: "12px", background: "var(--brand-primary)", borderRadius: "6px", marginBottom: "10px", width: "70%" }} />
        <div style={{ height: "10px", background: "var(--brand-primary)", borderRadius: "6px", marginBottom: "8px", width: "90%" }} />
        <div style={{ height: "10px", background: "var(--brand-primary)", borderRadius: "6px", width: "55%" }} />
      </div>

      {/* Real content — in normal flow so the card always sizes to fit it */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          textAlign: "center",
        }}
      >
        {icon && <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>{icon}</span>}
        <p
          style={{
            margin: 0,
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
          }}
        >
          {title}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
            opacity: 0.65,
            lineHeight: 1.4,
          }}
        >
          {teaser}
        </p>
      </div>
    </div>
  );
}
