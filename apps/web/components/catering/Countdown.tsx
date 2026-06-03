"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/catering/format";

interface CountdownProps {
  targetDate: Date;
  label?: string;
}

/**
 * Animated days/hrs/min/sec countdown.
 * Colors driven by CSS vars — no hardcoded theme.
 */
export default function Countdown({ targetDate, label }: CountdownProps) {
  const [parts, setParts] = useState(() => formatCountdown(targetDate));
  // The live countdown is time-dependent, so the server's value and the client's
  // first render differ by a second. Render a stable placeholder until mounted to
  // avoid a hydration mismatch, then swap in the live values.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const tick = () => setParts(formatCountdown(targetDate));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (mounted && parts.total <= 0) return null;

  const units = [
    { value: parts.days, label: "days" },
    { value: parts.hours, label: "hrs" },
    { value: parts.minutes, label: "min" },
    { value: parts.seconds, label: "sec" },
  ];

  return (
    <div style={{ textAlign: "center" }}>
      {label && (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "0.75rem",
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
            opacity: 0.7,
          }}
        >
          {label}
        </p>
      )}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        {units.map((u) => (
          <div
            key={u.label}
            style={{
              background: "var(--brand-surface)",
              border: "1px solid var(--brand-border)",
              borderRadius: "12px",
              padding: "12px 16px",
              minWidth: "56px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "clamp(1.4rem, 5vw, 2rem)",
                fontWeight: 700,
                color: "var(--brand-primary)",
                fontFamily: "'Raleway', sans-serif",
                lineHeight: 1,
              }}
            >
              {mounted ? String(u.value).padStart(2, "0") : "--"}
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                color: "var(--brand-primary)",
                opacity: 0.6,
                fontFamily: "'Raleway', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginTop: "4px",
              }}
            >
              {u.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
