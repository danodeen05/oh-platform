"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface ValidatedAddress {
  address: string; // formatted/validated single-line address
  lat?: number;
  lng?: number;
  validated: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1.5px solid var(--brand-border, rgba(199,168,120,0.25))",
  background: "var(--brand-surface, rgba(199,168,120,0.06))",
  color: "var(--brand-primary, #E0C38C)",
  fontFamily: "'Raleway', sans-serif",
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--brand-primary)",
  fontFamily: "'Raleway', sans-serif",
  marginBottom: "6px",
};

/**
 * Validated event-address entry for the catering booking flow. The guest enters
 * street/city/state/zip and validates against the server's geocoder, which
 * returns a normalized address + coordinates. Reports the result up via onChange.
 */
export default function EventAddressField({
  onChange,
}: {
  onChange: (value: ValidatedAddress | null) => void;
}) {
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zip, setZip] = useState("");

  const [checking, setChecking] = useState(false);
  const [validated, setValidated] = useState<{ display: string; lat?: number; lng?: number } | null>(null);
  const [error, setError] = useState("");

  // Report the current address up: the validated result if present, otherwise
  // the raw typed address (validated:false), or null when empty.
  useEffect(() => {
    if (validated) {
      onChange({ address: validated.display, lat: validated.lat, lng: validated.lng, validated: true });
    } else if (street.trim() && city.trim()) {
      const raw = [street.trim(), city.trim(), stateVal.trim(), zip.trim()].filter(Boolean).join(", ");
      onChange({ address: raw, validated: false });
    } else {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, city, stateVal, zip, validated]);

  // Any edit invalidates a prior validation.
  const edited = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    if (validated) setValidated(null);
    if (error) setError("");
  };

  const validate = async () => {
    if (!street.trim() || !city.trim()) {
      setError("Street address and city are required.");
      return;
    }
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/locations/validate-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: street.trim(), city: city.trim(), state: stateVal.trim(), zipCode: zip.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        const display: string = data.displayName || [street, city, stateVal, zip].filter(Boolean).join(", ");
        setValidated({ display, lat: data.normalized?.lat, lng: data.normalized?.lng });
      } else {
        setValidated(null);
        setError(data.message || "We couldn't verify that address. Please check it and try again.");
      }
    } catch {
      setError("Address check failed. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <label style={labelStyle}>
        Event Address <span style={{ fontWeight: 400, opacity: 0.5, fontSize: "0.78rem" }}>Where should we cater?</span>
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={street} onChange={(e) => edited(setStreet)(e.target.value)} placeholder="Street address" style={inputStyle} />
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={city} onChange={(e) => edited(setCity)(e.target.value)} placeholder="City" style={{ ...inputStyle, flex: 2 }} />
          <input value={stateVal} onChange={(e) => edited(setStateVal)(e.target.value)} placeholder="State" style={{ ...inputStyle, flex: 1 }} />
          <input value={zip} onChange={(e) => edited(setZip)(e.target.value)} placeholder="ZIP" inputMode="numeric" style={{ ...inputStyle, flex: 1 }} />
        </div>
      </div>

      {validated ? (
        <p style={{ margin: "8px 0 0", fontSize: "0.82rem", color: "#22c55e", fontFamily: "'Raleway', sans-serif", display: "flex", gap: "6px", alignItems: "flex-start" }}>
          <span style={{ fontWeight: 700 }}>✓</span>
          <span style={{ opacity: 0.95 }}>{validated.display}</span>
        </p>
      ) : (
        <button
          type="button"
          onClick={validate}
          disabled={checking}
          style={{
            marginTop: "8px",
            padding: "9px 18px",
            background: "transparent",
            border: "1px solid var(--brand-border)",
            borderRadius: "50px",
            color: "var(--brand-primary)",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 600,
            fontSize: "0.82rem",
            cursor: checking ? "default" : "pointer",
            opacity: checking ? 0.6 : 1,
          }}
        >
          {checking ? "Validating…" : "Validate address"}
        </button>
      )}

      {error && (
        <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "#ef4444", fontFamily: "'Raleway', sans-serif" }}>{error}</p>
      )}
    </div>
  );
}
