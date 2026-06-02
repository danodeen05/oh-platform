"use client";

import { useState, useEffect } from "react";
import { fetchCateringAvailability, type AvailabilitySlot } from "@/lib/catering/api";

interface BookingCalendarProps {
  onSlotSelect: (date: string, slot: "LUNCH" | "DINNER") => void;
  selectedDate: string | null;
  selectedSlot: "LUNCH" | "DINNER" | null;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function padDate(n: number) { return String(n).padStart(2, "0"); }
function toYMD(d: Date) {
  return `${d.getFullYear()}-${padDate(d.getMonth() + 1)}-${padDate(d.getDate())}`;
}

/**
 * Month-grid calendar showing catering availability.
 * OPEN slots are clickable; BOOKED/past dates are greyed out.
 * Driven by CSS vars — no hardcoded theme colors.
 */
export default function BookingCalendar({
  onSlotSelect,
  selectedDate,
  selectedSlot,
}: BookingCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const from = toYMD(firstDay);
    const to = toYMD(lastDay);

    setLoading(true);
    fetchCateringAvailability(from, to)
      .then(setSlots)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, month]);

  const slotMap: Record<string, AvailabilitySlot[]> = {};
  for (const s of slots) {
    if (!slotMap[s.date]) slotMap[s.date] = [];
    slotMap[s.date].push(s);
  }

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const isPast = (dayNum: number) => {
    const d = new Date(year, month, dayNum);
    d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  };

  return (
    <div style={{ width: "100%", maxWidth: "420px" }}>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <button
          onClick={prevMonth}
          style={{
            background: "var(--brand-surface)",
            border: "1px solid var(--brand-border)",
            borderRadius: "8px",
            padding: "8px 14px",
            color: "var(--brand-primary)",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          ‹
        </button>
        <h2 style={{ margin: 0, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", fontSize: "1.1rem", fontWeight: 700 }}>
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          style={{
            background: "var(--brand-surface)",
            border: "1px solid var(--brand-border)",
            borderRadius: "8px",
            padding: "8px 14px",
            color: "var(--brand-primary)",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "8px" }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--brand-primary)", opacity: 0.5, fontFamily: "'Raleway', sans-serif", letterSpacing: "1px", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {/* Empty cells for offset */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = `${year}-${padDate(month + 1)}-${padDate(day)}`;
          const daySlots = slotMap[dateStr] || [];
          const hasOpen = daySlots.some(s => s.status === "OPEN");
          const past = isPast(day);
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={day}
              onClick={() => {
                if (!hasOpen || past) return;
                // Select first open slot or keep current if already on this date
                const openSlot = daySlots.find(s => s.status === "OPEN");
                if (openSlot) onSlotSelect(dateStr, openSlot.slot);
              }}
              disabled={!hasOpen || past}
              style={{
                padding: "8px 4px",
                borderRadius: "8px",
                border: isSelected ? "2px solid var(--brand-primary)" : "1px solid var(--brand-border)",
                background: isSelected
                  ? "var(--brand-primary)"
                  : hasOpen && !past
                  ? "var(--brand-surface)"
                  : "transparent",
                color: isSelected
                  ? "var(--brand-on-primary)"
                  : past || !hasOpen
                  ? "var(--brand-primary)"
                  : "var(--brand-primary)",
                opacity: past || (!hasOpen && daySlots.length === 0) ? 0.25 : 1,
                cursor: hasOpen && !past ? "pointer" : "default",
                fontFamily: "'Raleway', sans-serif",
                fontSize: "0.85rem",
                fontWeight: isSelected ? 700 : 500,
                transition: "all 0.15s ease",
                position: "relative",
              }}
            >
              {day}
              {/* Availability dots */}
              {!past && daySlots.length > 0 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "2px", marginTop: "3px" }}>
                  {daySlots.map(s => (
                    <div
                      key={s.slot}
                      style={{
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        background: s.status === "OPEN"
                          ? isSelected ? "var(--brand-on-primary)" : "var(--brand-primary)"
                          : "rgba(128,128,128,0.4)",
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <p style={{ textAlign: "center", marginTop: "12px", color: "var(--brand-primary)", opacity: 0.5, fontSize: "0.8rem", fontFamily: "'Raleway', sans-serif" }}>
          Loading availability...
        </p>
      )}

      <p style={{ textAlign: "center", marginTop: "12px", color: "var(--brand-primary)", opacity: 0.45, fontSize: "0.72rem", fontFamily: "'Raleway', sans-serif" }}>
        Dots indicate available slots (Lunch / Dinner)
      </p>
    </div>
  );
}
