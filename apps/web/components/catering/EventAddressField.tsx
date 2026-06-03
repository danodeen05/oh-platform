"use client";

import { useEffect, useState } from "react";

export interface ValidatedAddress {
  address: string; // single-line address
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
 * Event-address entry for the catering booking flow. The guest enters
 * street/city/state/zip; the combined address is reported up via onChange.
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

  useEffect(() => {
    if (street.trim() && city.trim()) {
      const raw = [street.trim(), city.trim(), stateVal.trim(), zip.trim()].filter(Boolean).join(", ");
      onChange({ address: raw, validated: false });
    } else {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, city, stateVal, zip]);

  return (
    <div>
      <label style={labelStyle}>
        Event Address <span style={{ fontWeight: 400, opacity: 0.5, fontSize: "0.78rem" }}>Where should we cater?</span>
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" style={inputStyle} />
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={{ ...inputStyle, flex: 2 }} />
          <input value={stateVal} onChange={(e) => setStateVal(e.target.value)} placeholder="State" style={{ ...inputStyle, flex: 1 }} />
          <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" inputMode="numeric" style={{ ...inputStyle, flex: 1 }} />
        </div>
      </div>
    </div>
  );
}
