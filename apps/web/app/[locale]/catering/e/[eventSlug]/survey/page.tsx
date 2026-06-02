"use client";

import { useState, FormEvent, Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { submitSurvey } from "@/lib/catering/api";
import ThemedBackground from "@/components/catering/ThemedBackground";

interface PageProps {
  params: Promise<{ locale: string; eventSlug: string }>;
}

const AREA_LABELS: Array<{ key: "food" | "speed" | "experience" | "recommend"; label: string }> = [
  { key: "food", label: "Food Quality" },
  { key: "speed", label: "Speed of Service" },
  { key: "experience", label: "Overall Experience" },
  { key: "recommend", label: "Would Recommend" },
];

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.5rem",
            padding: "2px",
            color: n <= value ? "var(--brand-primary)" : "var(--brand-border)",
            transition: "color 0.15s ease",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function SurveyContent({ locale, eventSlug }: { locale: string; eventSlug: string }) {
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qrCode") || undefined;

  const [overall, setOverall] = useState(0);
  const [areas, setAreas] = useState({ food: 0, speed: 0, experience: 0, recommend: 0 });
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (overall === 0) { setError("Please rate your overall experience"); return; }
    setIsSubmitting(true);
    setError("");
    try {
      await submitSurvey(eventSlug, {
        qrCode,
        overallScore: overall,
        areaScores: areas,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setError(msg);
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        gap: "20px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "3rem" }}>★</div>
        <h1 style={{ margin: 0, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", fontSize: "1.6rem", fontWeight: 700 }}>
          Thank You!
        </h1>
        <p style={{ maxWidth: "280px", color: "var(--brand-primary)", opacity: 0.65, fontFamily: "'Raleway', sans-serif", fontSize: "0.95rem", lineHeight: 1.6, margin: 0 }}>
          Your feedback helps us make every event better. We appreciate you taking the time.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      position: "relative",
      zIndex: 1,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "40px 24px 80px",
      gap: "24px",
    }}>
      <h1 style={{ margin: 0, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", fontSize: "clamp(1.4rem, 6vw, 1.8rem)", fontWeight: 700 }}>
        How was your experience?
      </h1>
      <p style={{ margin: 0, color: "var(--brand-primary)", opacity: 0.55, fontFamily: "'Raleway', sans-serif", fontSize: "0.88rem" }}>
        Takes about 1 minute
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "380px" }}>
        {/* Overall */}
        <div>
          <label style={labelStyle}>Overall Rating *</label>
          <StarRating value={overall} onChange={setOverall} />
        </div>

        {/* Area ratings */}
        {AREA_LABELS.map(({ key, label }) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            <StarRating value={areas[key]} onChange={n => setAreas(prev => ({ ...prev, [key]: n }))} />
          </div>
        ))}

        {/* Comment */}
        <div>
          <label style={labelStyle}>
            Comments{" "}
            <span style={{ fontWeight: 400, opacity: 0.5, fontSize: "0.78rem" }}>Optional</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tell us anything..."
            maxLength={500}
            rows={3}
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: "0.9rem",
              borderRadius: "10px",
              border: "1.5px solid var(--brand-border)",
              background: "var(--brand-surface)",
              color: "var(--brand-primary)",
              fontFamily: "'Raleway', sans-serif",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <p style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--brand-primary)", opacity: 0.4, margin: "4px 0 0", fontFamily: "'Raleway', sans-serif" }}>
            {comment.length}/500
          </p>
        </div>

        {error && (
          <p style={{ margin: 0, color: "#ef4444", fontSize: "0.85rem", fontFamily: "'Raleway', sans-serif" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: "15px",
            background: "var(--brand-primary)",
            color: "var(--brand-on-primary)",
            border: "none",
            borderRadius: "50px",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 700,
            fontSize: "1rem",
            letterSpacing: "1px",
            cursor: isSubmitting ? "default" : "pointer",
            opacity: isSubmitting ? 0.7 : 1,
            transition: "all 0.2s ease",
          }}
        >
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "var(--brand-primary)",
  fontFamily: "'Raleway', sans-serif",
  marginBottom: "8px",
};

export default function SurveyPage({ params }: PageProps) {
  const { locale, eventSlug } = use(params);
  return (
    <>
      <ThemedBackground />
      <Suspense fallback={<div />}>
        <SurveyContent locale={locale} eventSlug={eventSlug} />
      </Suspense>
    </>
  );
}
