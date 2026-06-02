"use client";

import { type AvailabilitySlot } from "@/lib/catering/api";
import { trackCateringSlotSelected } from "@/lib/catering/analytics";

const PRICE_CENTS: Record<"LUNCH" | "DINNER", number> = {
  LUNCH: 2499,
  DINNER: 2999,
};

interface SlotPickerProps {
  date: string;
  daySlots: AvailabilitySlot[];
  selectedSlot: "LUNCH" | "DINNER" | null;
  bowls: number;
  onSlotChange: (slot: "LUNCH" | "DINNER") => void;
  onBowlsChange: (n: number) => void;
}

const MIN_BOWLS = 10;
const MAX_BOWLS = 500;

/**
 * Slot picker — the ONLY place in the catering flow where pricing is shown.
 * Lunch $24.99/bowl · Dinner $29.99/bowl · min 10 bowls · bowl stepper · live subtotal.
 */
export default function SlotPicker({
  date,
  daySlots,
  selectedSlot,
  bowls,
  onSlotChange,
  onBowlsChange,
}: SlotPickerProps) {
  const priceCents = selectedSlot ? PRICE_CENTS[selectedSlot] : null;
  const subtotalCents = priceCents ? priceCents * bowls : null;

  const handleSlot = (slot: "LUNCH" | "DINNER") => {
    onSlotChange(slot);
    trackCateringSlotSelected(slot, date);
  };

  return (
    <div style={{ width: "100%", maxWidth: "420px" }}>
      {/* Date display */}
      <p style={{
        margin: "0 0 16px",
        fontSize: "0.9rem",
        color: "var(--brand-primary)",
        fontFamily: "'Raleway', sans-serif",
        fontWeight: 600,
        letterSpacing: "0.5px",
      }}>
        {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric"
        })}
      </p>

      {/* Slot buttons */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        {(["LUNCH", "DINNER"] as const).map((slot) => {
          const avail = daySlots.find(s => s.slot === slot);
          const open = avail?.status === "OPEN";
          const selected = selectedSlot === slot;
          return (
            <button
              key={slot}
              onClick={() => open && handleSlot(slot)}
              disabled={!open}
              style={{
                flex: 1,
                padding: "14px 12px",
                borderRadius: "12px",
                border: selected
                  ? "2px solid var(--brand-primary)"
                  : "1px solid var(--brand-border)",
                background: selected ? "var(--brand-primary)" : "var(--brand-surface)",
                color: selected ? "var(--brand-on-primary)" : "var(--brand-primary)",
                opacity: open ? 1 : 0.35,
                cursor: open ? "pointer" : "not-allowed",
                fontFamily: "'Raleway', sans-serif",
                transition: "all 0.2s ease",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "1px" }}>
                {slot}
              </div>
              <div style={{ fontSize: "0.75rem", marginTop: "4px", opacity: 0.8 }}>
                ${(PRICE_CENTS[slot] / 100).toFixed(2)}/bowl
              </div>
              {!open && (
                <div style={{ fontSize: "0.65rem", marginTop: "4px", opacity: 0.6 }}>
                  Unavailable
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bowl stepper */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{
          display: "block",
          fontSize: "0.85rem",
          color: "var(--brand-primary)",
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 600,
          letterSpacing: "0.5px",
          marginBottom: "12px",
        }}>
          Number of Bowls <span style={{ opacity: 0.55, fontWeight: 400 }}>(min {MIN_BOWLS})</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => onBowlsChange(Math.max(MIN_BOWLS, bowls - 1))}
            style={{
              width: "40px", height: "40px",
              borderRadius: "8px",
              border: "1px solid var(--brand-border)",
              background: "var(--brand-surface)",
              color: "var(--brand-primary)",
              fontSize: "1.2rem",
              cursor: bowls > MIN_BOWLS ? "pointer" : "default",
              opacity: bowls <= MIN_BOWLS ? 0.35 : 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            −
          </button>
          <span style={{
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
            minWidth: "60px",
            textAlign: "center",
          }}>
            {bowls}
          </span>
          <button
            onClick={() => onBowlsChange(Math.min(MAX_BOWLS, bowls + 1))}
            style={{
              width: "40px", height: "40px",
              borderRadius: "8px",
              border: "1px solid var(--brand-border)",
              background: "var(--brand-surface)",
              color: "var(--brand-primary)",
              fontSize: "1.2rem",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Subtotal */}
      {subtotalCents !== null && (
        <div style={{
          background: "var(--brand-surface)",
          border: "1px solid var(--brand-border)",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--brand-primary)", opacity: 0.6, fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "1px" }}>
              Estimated Total
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--brand-primary)", opacity: 0.5, fontFamily: "'Raleway', sans-serif" }}>
              {bowls} bowls × ${((priceCents ?? 0) / 100).toFixed(2)}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
            ${(subtotalCents / 100).toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
