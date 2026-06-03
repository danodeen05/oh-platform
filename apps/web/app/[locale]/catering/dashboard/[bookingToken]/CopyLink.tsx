"use client";

import { useState } from "react";

/**
 * Click-to-copy attendee link for the client dashboard.
 * Shows the URL; tapping anywhere on the row copies it and confirms.
 */
export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--brand-border)",
        borderRadius: "10px",
        fontFamily: "'Raleway', sans-serif",
      }}
    >
      <span
        style={{
          color: "var(--brand-primary)",
          opacity: 0.85,
          fontSize: "0.82rem",
          wordBreak: "break-all",
          textAlign: "center",
        }}
      >
        {url}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy attendee link"
        style={{
          background: "transparent",
          border: "none",
          padding: "2px 8px",
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 700,
          fontSize: "0.78rem",
          letterSpacing: "0.5px",
          cursor: "pointer",
          color: copied ? "#22c55e" : "var(--brand-primary)",
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
