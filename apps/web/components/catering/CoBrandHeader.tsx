"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface CoBrandHeaderProps {
  clientLogoUrl: string | null;
  clientCompany: string;
  eventName?: string;
  /** If true, render the Oh! logo at reduced size alongside the client logo */
  showOhLogo?: boolean;
}

/**
 * Co-branded header: client logo × Oh! Beef Noodle Soup lockup.
 * Fades/slides in on mount for a premium feel.
 * Uses CSS vars set by e/[eventSlug]/layout.tsx — never hardcoded colors.
 */
export default function CoBrandHeader({
  clientLogoUrl,
  clientCompany,
  eventName,
  showOhLogo = true,
}: CoBrandHeaderProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-12px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      {/* Logo lockup */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* Client logo */}
        {clientLogoUrl ? (
          <div
            style={{
              background: "rgba(255,255,255,0.95)",
              borderRadius: "12px",
              padding: "10px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              maxHeight: "64px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={clientLogoUrl}
              alt={clientCompany}
              style={{ maxHeight: "44px", maxWidth: "140px", objectFit: "contain" }}
            />
          </div>
        ) : (
          <div
            style={{
              background: "var(--brand-primary)",
              borderRadius: "12px",
              padding: "10px 20px",
              color: "var(--brand-on-primary)",
              fontWeight: 700,
              fontSize: "1.1rem",
              letterSpacing: "0.5px",
              fontFamily: "'Raleway', sans-serif",
              boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            }}
          >
            {clientCompany}
          </div>
        )}

        {/* Partnership separator — "company × Oh!" */}
        {showOhLogo && (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              color: "var(--brand-primary)",
              opacity: 0.5,
              fontSize: "1.6rem",
              fontWeight: 300,
              lineHeight: 1,
            }}
          >
            ×
          </span>
        )}

        {/* Oh! logo — white mark on transparent (no white box), gently floating */}
        {showOhLogo && (
          <div style={{ animation: "ohLogoFloat 3.5s ease-in-out infinite", display: "flex", alignItems: "center" }}>
            <Image
              src="/Oh_Logo_Mark_Light.png"
              alt="Oh! Beef Noodle Soup"
              width={64}
              height={64}
              style={{ objectFit: "contain" }}
            />
          </div>
        )}
      </div>

      {/* Event name (optional) */}
      {eventName && (
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
            letterSpacing: "2px",
            textTransform: "uppercase",
            opacity: 0.8,
          }}
        >
          {eventName}
        </p>
      )}
    </div>
  );
}
