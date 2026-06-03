"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Proactive, status-aware Chappy on the attendee order status page. Pulls a
 * fresh, order-aware line whenever the order status changes (e.g. a "first bite"
 * reaction once it's SERVING), and offers to open the floating Chappy chat.
 */
export default function ChappyStatusCompanion({ qrCode, status }: { qrCode: string; status: string }) {
  const [quip, setQuip] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!qrCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE}/catering/orders/${encodeURIComponent(qrCode)}/chappy-quip`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.quip) setQuip(data.quip);
        }
      } catch {
        /* optional delight — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetch when the status changes so the message tracks the order.
  }, [qrCode, status]);

  useEffect(() => {
    if (quip) {
      const t = setTimeout(() => setVisible(true), 40);
      return () => clearTimeout(t);
    }
  }, [quip]);

  const openChat = () => {
    const btn = document.querySelector('[aria-label="Chat with Chappy"]') as HTMLElement | null;
    btn?.click();
  };

  if (!quip) return null;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "360px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        opacity: visible ? 1 : 0,
        animation: visible ? "chappyPopIn 0.5s ease both" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          role="img"
          aria-label="Chappy Chopstix"
          style={{
            flexShrink: 0,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "#FBF7F0 url('/Chappy.png') no-repeat",
            backgroundSize: "340%",
            backgroundPosition: "51% 17%",
            border: "2px solid var(--brand-border)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
            animation: "chappyBob 2.8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "relative",
            background: "var(--brand-surface)",
            border: "1px solid var(--brand-border)",
            borderRadius: "14px",
            padding: "12px 16px",
            flex: 1,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "-6px",
              top: "18px",
              width: "12px",
              height: "12px",
              background: "var(--brand-surface)",
              borderLeft: "1px solid var(--brand-border)",
              borderBottom: "1px solid var(--brand-border)",
              transform: "rotate(45deg)",
            }}
          />
          <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
            {quip}
          </p>
        </div>
      </div>
      <button
        onClick={openChat}
        style={{
          alignSelf: "center",
          padding: "8px 18px",
          background: "transparent",
          border: "1px solid var(--brand-border)",
          borderRadius: "50px",
          color: "var(--brand-primary)",
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 600,
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        💬 Chat with Chappy
      </button>
    </div>
  );
}
