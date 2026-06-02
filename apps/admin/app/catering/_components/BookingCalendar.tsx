"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CateringSlot } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface CalendarSlotInfo {
  date: string;
  slot: CateringSlot;
  booked: boolean;
  clientCompany?: string;
  eventId?: string;
}

interface CalendarDay {
  date: string; // YYYY-MM-DD
  slots: CalendarSlotInfo[];
}

interface BookingCalendarProps {
  onCreateWithPrefill?: (date: string, slot: CateringSlot) => void;
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(date.toISOString().slice(0, 10));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookingCalendar({ onCreateWithPrefill }: BookingCalendarProps) {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [calendarData, setCalendarData] = useState<Record<string, CalendarSlotInfo[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
      try {
        const res = await fetch(`${BASE}/admin/catering/calendar?from=${from}&to=${to}`);
        if (!res.ok) return;
        const data = await res.json();
        // Build a map from date -> slots
        const map: Record<string, CalendarSlotInfo[]> = {};
        if (Array.isArray(data)) {
          for (const entry of data) {
            const d = entry.date as string;
            if (!map[d]) map[d] = [];
            map[d].push({
              date: d,
              slot: entry.slot,
              booked: entry.status === "BOOKED",
              clientCompany: entry.event?.clientCompany,
              eventId: entry.event?.id,
            });
          }
        }
        setCalendarData(map);
      } catch (err) {
        console.error("Failed to fetch calendar:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const days = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const blanks = Array(firstDow).fill(null);

  const handleSlotClick = (date: string, slotInfo: CalendarSlotInfo | null, slot: CateringSlot) => {
    if (slotInfo?.booked && slotInfo.eventId) {
      router.push(`/catering/${slotInfo.eventId}`);
    } else {
      onCreateWithPrefill?.(date, slot);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <button
          onClick={prevMonth}
          style={{
            padding: "6px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            cursor: "pointer",
            backgroundColor: "white",
          }}
        >
          &larr;
        </button>
        <h3 style={{ margin: 0, fontWeight: 600 }}>
          {MONTHS[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          style={{
            padding: "6px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            cursor: "pointer",
            backgroundColor: "white",
          }}
        >
          &rarr;
        </button>
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: "0.9rem" }}>
          Loading calendar...
        </div>
      )}

      {!loading && (
        <div style={{ padding: 12 }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {DAYS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#9ca3af",
                  padding: "4px 0",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {blanks.map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((date) => {
              const daySlots = calendarData[date] || [];
              const lunchInfo = daySlots.find((s) => s.slot === "LUNCH") ?? null;
              const dinnerInfo = daySlots.find((s) => s.slot === "DINNER") ?? null;
              const dayNum = parseInt(date.slice(8), 10);
              const isToday = date === today.toISOString().slice(0, 10);

              return (
                <div
                  key={date}
                  style={{
                    border: isToday ? "2px solid #4f46e5" : "1px solid #f3f4f6",
                    borderRadius: 6,
                    padding: 4,
                    minHeight: 80,
                    backgroundColor: isToday ? "#f5f3ff" : "white",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? "#4f46e5" : "#374151",
                      marginBottom: 4,
                    }}
                  >
                    {dayNum}
                  </div>
                  {/* Lunch chip */}
                  <div
                    onClick={() => handleSlotClick(date, lunchInfo, "LUNCH")}
                    style={{
                      marginBottom: 2,
                      padding: "2px 4px",
                      borderRadius: 3,
                      fontSize: "0.65rem",
                      cursor: "pointer",
                      backgroundColor: lunchInfo?.booked ? "#d1fae5" : "#f3f4f6",
                      color: lunchInfo?.booked ? "#065f46" : "#9ca3af",
                      border: lunchInfo?.booked ? "1px solid #10b981" : "1px dashed #d1d5db",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={lunchInfo?.booked ? `Lunch: ${lunchInfo.clientCompany}` : "Click to book Lunch"}
                  >
                    L {lunchInfo?.booked ? lunchInfo.clientCompany : "+"}
                  </div>
                  {/* Dinner chip */}
                  <div
                    onClick={() => handleSlotClick(date, dinnerInfo, "DINNER")}
                    style={{
                      padding: "2px 4px",
                      borderRadius: 3,
                      fontSize: "0.65rem",
                      cursor: "pointer",
                      backgroundColor: dinnerInfo?.booked ? "#dbeafe" : "#f3f4f6",
                      color: dinnerInfo?.booked ? "#1e40af" : "#9ca3af",
                      border: dinnerInfo?.booked ? "1px solid #3b82f6" : "1px dashed #d1d5db",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={dinnerInfo?.booked ? `Dinner: ${dinnerInfo.clientCompany}` : "Click to book Dinner"}
                  >
                    D {dinnerInfo?.booked ? dinnerInfo.clientCompany : "+"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: "0.75rem", color: "#6b7280" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, backgroundColor: "#d1fae5", border: "1px solid #10b981", borderRadius: 2 }} />
              Lunch booked
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, backgroundColor: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 2 }} />
              Dinner booked
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, backgroundColor: "#f3f4f6", border: "1px dashed #d1d5db", borderRadius: 2 }} />
              Available (click to create)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
