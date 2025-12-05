"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function CreateLocationForm({
  tenantOptions,
}: {
  tenantOptions: { id: string; brandName: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phone, setPhone] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [validationMessage, setValidationMessage] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Debounced address validation
  useEffect(() => {
    if (!address || !city) {
      setValidationStatus("idle");
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await fetch(`${BASE}/locations/validate-address`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, city, state, zipCode, country: "US" }),
        });

        if (!res.ok) {
          setValidationStatus("invalid");
          setValidationMessage("Could not validate address");
          return;
        }

        const data = await res.json();
        if (data.valid) {
          setValidationStatus("valid");
          setValidationMessage(data.message);
          setSuggestions(data.suggestions || []);
        } else {
          setValidationStatus("invalid");
          setValidationMessage(data.message);
          setSuggestions([]);
        }
      } catch (error) {
        setValidationStatus("idle");
        setValidationMessage("");
      } finally {
        setValidating(false);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timeoutId);
  }, [address, city, state, zipCode]);

  function applySuggestion(suggestion: any) {
    setAddress(suggestion.address);
    setCity(suggestion.city);
    setState(suggestion.state);
    setZipCode(suggestion.zipCode);
    setLat(suggestion.lat);
    setLng(suggestion.lng);
    setSuggestions([]);
  }

  async function geocodeAddress() {
    if (!address || !city) {
      alert("Please enter address and city first");
      return;
    }

    setGeocoding(true);
    try {
      const res = await fetch(`${BASE}/locations/geocode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address, city, state, zipCode, country: "US" }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to geocode address");
        return;
      }

      const data = await res.json();
      setLat(data.lat);
      setLng(data.lng);
      alert(`Coordinates found: ${data.lat}, ${data.lng}`);
    } catch (error) {
      alert("Failed to geocode address");
    } finally {
      setGeocoding(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${BASE}/locations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-slug": "oh"
      },
      body: JSON.stringify({
        name,
        address,
        city,
        state,
        zipCode,
        phone,
        lat: lat || 0,
        lng: lng || 0,
        tenantId
      }),
    });
    setName("");
    setAddress("");
    setCity("");
    setState("");
    setZipCode("");
    setPhone("");
    setLat(null);
    setLng(null);
    setTenantId("");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => start(() => onSubmit(e))}
      style={{ display: "grid", gap: 8, maxWidth: 420 }}
    >
      <input
        name="name"
        placeholder="Location Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        name="address"
        placeholder="Address"
        required
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        name="city"
        placeholder="City"
        required
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          name="state"
          placeholder="State"
          style={{ flex: 1 }}
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
        <input
          name="zipCode"
          placeholder="Zip Code"
          style={{ flex: 1 }}
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
        />
      </div>
      <input
        name="phone"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {/* Address validation status */}
      {validating && (
        <div style={{ fontSize: "0.875rem", color: "#667eea" }}>
          Validating address...
        </div>
      )}
      {validationStatus === "valid" && !validating && (
        <div style={{ fontSize: "0.875rem", color: "#10b981" }}>
          ✓ {validationMessage}
        </div>
      )}
      {validationStatus === "invalid" && !validating && (
        <div style={{ fontSize: "0.875rem", color: "#f59e0b" }}>
          ⚠ {validationMessage}
        </div>
      )}

      {/* Address suggestions */}
      {suggestions.length > 0 && (
        <div style={{
          border: "1px solid #e5e7eb",
          borderRadius: "4px",
          padding: "8px",
          backgroundColor: "#f9fafb"
        }}>
          <div style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "8px" }}>
            Did you mean:
          </div>
          {suggestions.slice(0, 3).map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applySuggestion(sug)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px",
                marginBottom: "4px",
                backgroundColor: "white",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.875rem"
              }}
            >
              {sug.displayName}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={geocodeAddress}
        disabled={geocoding || !address || !city}
        style={{
          padding: "8px 16px",
          backgroundColor: lat && lng ? "#10b981" : "#667eea",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: geocoding || !address || !city ? "not-allowed" : "pointer",
        }}
      >
        {geocoding ? "Geocoding..." : lat && lng ? "✓ Geocoded" : "Geocode Address"}
      </button>
      {lat && lng && (
        <div style={{ fontSize: "0.875rem", color: "#666" }}>
          Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
      )}
      <select
        name="tenantId"
        required
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
      >
        <option value="" disabled>
          Select tenant…
        </option>
        {tenantOptions.map((t) => (
          <option key={t.id} value={t.id}>
            {t.brandName}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending}>
        Create Location
      </button>
    </form>
  );
}
