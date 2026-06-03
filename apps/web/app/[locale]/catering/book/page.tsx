"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import ThemedBackground from "@/components/catering/ThemedBackground";
import BookingCalendar from "@/components/catering/BookingCalendar";
import SlotPicker from "@/components/catering/SlotPicker";
import { fetchCateringAvailability, type AvailabilitySlot } from "@/lib/catering/api";
import { trackCateringBookingStart } from "@/lib/catering/analytics";
import Image from "next/image";
import { useEffect } from "react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function BookPage({ params }: PageProps) {
  const { locale } = use(params);
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<"LUNCH" | "DINNER" | null>(null);
  const [bowls, setBowls] = useState(10);
  const [daySlots, setDaySlots] = useState<AvailabilitySlot[]>([]);

  // Track booking start on mount
  useEffect(() => {
    trackCateringBookingStart();
  }, []);

  const handleSlotSelect = async (date: string, slot: "LUNCH" | "DINNER") => {
    setSelectedDate(date);
    setSelectedSlot(slot);

    // Load all slots for the selected date for the SlotPicker
    try {
      const slots = await fetchCateringAvailability(date, date);
      setDaySlots(slots.filter(s => s.date === date));
    } catch {
      setDaySlots([]);
    }
  };

  const handleSlotChange = (slot: "LUNCH" | "DINNER") => {
    setSelectedSlot(slot);
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedSlot) return;
    const qs = new URLSearchParams({ date: selectedDate, slot: selectedSlot, bowls: String(bowls) });
    router.push(`/${locale}/catering/book/details?${qs.toString()}`);
  };

  const canContinue = selectedDate && selectedSlot;

  return (
    <>
      {/* Use default neutral theme for the booking flow */}
      <div style={{
        "--brand-primary": "#E0C38C",
        "--brand-secondary": "#8A7055",
        "--brand-bg": "#0D0D0B",
        "--brand-on-primary": "#1A1612",
        "--brand-surface": "rgba(199,168,120,0.08)",
        "--brand-border": "rgba(199,168,120,0.2)",
      } as React.CSSProperties}>
        <ThemedBackground />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "40px 24px 80px",
            gap: "32px",
          }}
        >
          {/* Oh! Logo — white mark on transparent, gently floating */}
          <div style={{ animation: "ohLogoFloat 3.5s ease-in-out infinite" }}>
            <Image src="/Oh_Logo_Mark_Light.png" alt="Oh! Beef Noodle Soup" width={96} height={96} priority style={{ objectFit: "contain" }} />
          </div>

          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 6vw, 2rem)", fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
              Book Catering
            </h1>
            <p style={{ margin: "10px 0 0", color: "var(--brand-primary)", opacity: 0.85, fontFamily: "'Raleway', sans-serif", fontSize: "0.9rem", maxWidth: "380px" }}>
              Our 30-year family recipe, brought to your event. Rich, aromatic broth simmered for 48 hours, made fresh and served with care. Minimum 10 bowls.
            </p>
          </div>

          {/* Calendar */}
          <BookingCalendar
            onSlotSelect={handleSlotSelect}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
          />

          {/* Slot picker — only shown when a date is selected */}
          {selectedDate && (
            <SlotPicker
              date={selectedDate}
              daySlots={daySlots}
              selectedSlot={selectedSlot}
              bowls={bowls}
              onSlotChange={handleSlotChange}
              onBowlsChange={setBowls}
            />
          )}

          <button
            onClick={handleContinue}
            disabled={!canContinue}
            style={{
              padding: "16px 48px",
              background: canContinue ? "var(--brand-primary)" : "var(--brand-border)",
              color: canContinue ? "var(--brand-on-primary)" : "var(--brand-primary)",
              border: "none",
              borderRadius: "50px",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "1.5px",
              cursor: canContinue ? "pointer" : "default",
              opacity: canContinue ? 1 : 0.5,
              transition: "all 0.2s ease",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </>
  );
}
