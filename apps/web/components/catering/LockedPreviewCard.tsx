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
        padding: "20px",
        overflow: "hidden",
      }}
    >
      {/* Blurred placeholder content */}
      <div style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none", opacity: 0.4 }}>
        <div
          style={{
            height: "12px",
            background: "var(--brand-primary)",
            borderRadius: "6px",
            marginBottom: "10px",
            width: "70%",
          }}
        />
        <div
          style={{
            height: "10px",
            background: "var(--brand-primary)",
            borderRadius: "6px",
            marginBottom: "8px",
            width: "90%",
          }}
        />
        <div
          style={{
            height: "10px",
            background: "var(--brand-primary)",
            borderRadius: "6px",
            width: "55%",
          }}
        />
      </div>

      {/* Lock overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "16px",
          textAlign: "center",
        }}
      >
        {icon && <span style={{ fontSize: "1.8rem" }}>{icon}</span>}
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
