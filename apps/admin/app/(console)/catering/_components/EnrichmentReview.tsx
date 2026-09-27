"use client";

import { useState, useEffect, useTransition } from "react";
import type { EnrichmentSuggestion } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface EnrichmentReviewProps {
  eventId: string;
  onPublished?: () => void;
}

export default function EnrichmentReview({ eventId, onPublished }: EnrichmentReviewProps) {
  const [enrichment, setEnrichment] = useState<EnrichmentSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  // Editable fields
  const [eventName, setEventName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [companyDescription, setCompanyDescription] = useState("");

  const fetchEnrichment = async () => {
    try {
      const res = await fetch(`${BASE}/admin/catering/events/${eventId}/enrichment`);
      if (!res.ok) return;
      const data: EnrichmentSuggestion = await res.json();
      setEnrichment(data);
      setEventName(data.suggestedEventName || "");
      setLogoUrl(data.logoUrl || "");
      setBrandColors(data.brandColors?.length ? data.brandColors : ["#4f46e5"]);
      setCompanyDescription(data.companyDescription || "");
    } catch (err) {
      console.error("Failed to fetch enrichment:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrichment();
  }, [eventId]);

  // Poll while ENRICHING
  useEffect(() => {
    if (enrichment?.status !== "ENRICHING") return;
    const interval = setInterval(() => {
      fetchEnrichment();
    }, 3000);
    return () => clearInterval(interval);
  }, [enrichment?.status]);

  const handleAddColor = () => {
    setBrandColors((prev) => [...prev, "#000000"]);
  };

  const handleRemoveColor = (idx: number) => {
    setBrandColors((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleColorChange = (idx: number, value: string) => {
    setBrandColors((prev) => prev.map((c, i) => (i === idx ? value : c)));
  };

  const handlePublish = () => {
    startTransition(async () => {
      const res = await fetch(`${BASE}/admin/catering/events/${eventId}/enrichment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: eventName || undefined,
          logoUrl: logoUrl || undefined,
          brandColors: brandColors.filter(Boolean),
          companyDescription: companyDescription || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save enrichment");
        return;
      }
      await fetchEnrichment();
      onPublished?.();
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 16, color: "#6b7280", fontSize: "0.9rem" }}>
        Loading enrichment data...
      </div>
    );
  }

  if (!enrichment) {
    return (
      <div style={{ padding: 16, color: "#6b7280", fontSize: "0.9rem" }}>
        No enrichment data available.
      </div>
    );
  }

  if (enrichment.status === "ENRICHING") {
    return (
      <div
        style={{
          padding: 20,
          backgroundColor: "#fef3c7",
          borderRadius: 8,
          border: "1px solid #f59e0b",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
          AI Enrichment In Progress...
        </div>
        <div style={{ fontSize: "0.85rem", color: "#78350f" }}>
          Analyzing website and generating suggestions. This usually takes 15-30 seconds.
        </div>
        <div style={{ marginTop: 12 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#f59e0b",
              marginRight: 6,
              animation: "pulse 1.5s infinite",
            }}
          />
          <span style={{ fontSize: "0.8rem", color: "#92400e" }}>Auto-refreshing...</span>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  if (enrichment.status === "LIVE") {
    return (
      <div
        style={{
          padding: 16,
          backgroundColor: "#d1fae5",
          borderRadius: 8,
          border: "1px solid #10b981",
          fontSize: "0.9rem",
          color: "#065f46",
        }}
      >
        Enrichment accepted and published. Event is LIVE.
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ marginTop: 0, marginBottom: 4, color: "#374151" }}>AI Suggestions — Review &amp; Edit</h4>
        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>
          Review the AI-generated content below. Edit anything that needs adjustment, then click Save &amp; Publish to go LIVE.
        </p>
      </div>

      {/* Logo */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, color: "#374151", marginBottom: 8 }}
        >
          Logo URL
        </label>
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Company logo preview"
            style={{
              height: 60,
              maxWidth: 200,
              objectFit: "contain",
              borderRadius: 4,
              border: "1px solid #e5e7eb",
              padding: 4,
              backgroundColor: "white",
              marginBottom: 8,
              display: "block",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <input
          placeholder="https://example.com/logo.png"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 8,
            borderRadius: 4,
            border: "1px solid #d1d5db",
            fontSize: "0.85rem",
          }}
        />
      </div>

      {/* Brand Colors */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, color: "#374151", marginBottom: 8 }}
        >
          Brand Colors
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {brandColors.map((color, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(idx, e.target.value)}
                style={{ width: 40, height: 36, border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", padding: 2 }}
              />
              <span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#6b7280" }}>{color}</span>
              <button
                type="button"
                onClick={() => handleRemoveColor(idx)}
                style={{
                  padding: "2px 6px",
                  fontSize: "0.7rem",
                  border: "1px solid #fca5a5",
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddColor}
            style={{
              padding: "6px 10px",
              fontSize: "0.8rem",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              cursor: "pointer",
              backgroundColor: "white",
            }}
          >
            + Add Color
          </button>
        </div>
      </div>

      {/* Event Name */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, color: "#374151", marginBottom: 4 }}
        >
          Event Name (shown to attendees)
        </label>
        <input
          placeholder="e.g., Acme Corp Team Lunch 2026"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 8,
            borderRadius: 4,
            border: "1px solid #d1d5db",
          }}
        />
      </div>

      {/* Company Description */}
      <div style={{ marginBottom: 20 }}>
        <label
          style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, color: "#374151", marginBottom: 4 }}
        >
          Company Description
        </label>
        <textarea
          placeholder="Brief description shown on the attendee landing page..."
          value={companyDescription}
          onChange={(e) => setCompanyDescription(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 8,
            borderRadius: 4,
            border: "1px solid #d1d5db",
            resize: "vertical",
          }}
        />
      </div>

      <button
        onClick={handlePublish}
        disabled={pending}
        style={{
          padding: "10px 24px",
          backgroundColor: "#059669",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: pending ? "not-allowed" : "pointer",
          fontWeight: 600,
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Saving..." : "Save & Publish (Go LIVE)"}
      </button>
    </div>
  );
}
