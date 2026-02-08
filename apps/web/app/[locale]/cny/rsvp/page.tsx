"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyUdlLe3sVsJcs5XSh4LvZcmBJA3IyUi0qNHkZVc4GdY7n6nFXcoQhFpZIK2_dOFLU2dg/exec";

// Format phone number as (xxx) xxx-xxxx
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

// Format birthdate as MM/DD/YYYY
const formatBirthdate = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export default function CNYRsvp() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit to Google Apps Script
      if (APPS_SCRIPT_URL) {
        const params = new URLSearchParams({
          name: name.trim(),
          phone: phone.trim(),
          birthdate: birthdate,
          timestamp: new Date().toISOString(),
        });

        const url = `${APPS_SCRIPT_URL}?${params.toString()}`;
        console.log("Submitting RSVP to:", url);

        // Try multiple methods for reliability

        // Method 1: fetch with no-cors (fire and forget)
        fetch(url, { method: "GET", mode: "no-cors" })
          .then(() => console.log("Fetch completed"))
          .catch((err) => console.error("Fetch error:", err));

        // Method 2: Image beacon (backup)
        const img = new Image();
        img.onload = () => console.log("Image beacon loaded");
        img.onerror = () => console.log("Image beacon error (expected for non-image response)");
        img.src = url;

        // Method 3: Script tag injection (another backup)
        const script = document.createElement("script");
        script.src = url;
        script.onload = () => {
          console.log("Script loaded");
          document.head.removeChild(script);
        };
        script.onerror = () => {
          console.log("Script error (expected)");
          document.head.removeChild(script);
        };
        document.head.appendChild(script);
      }

      // Wait a moment for requests to fire, then transition
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsTransitioning(true);
      setTimeout(() => {
        router.push("/en/cny/thanks");
      }, 400);
    } catch (err) {
      console.error("RSVP submission error:", err);
      setIsTransitioning(true);
      setTimeout(() => {
        router.push("/en/cny/thanks");
      }, 400);
    }
  };

  return (
    <div
      className={`cny-page cny-page-3`}
      style={{
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? "translateY(-30px)" : "translateY(0)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      {/* RSVP Form */}
      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "10%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          padding: "0 24px",
        }}
      >
        <h1
          className="cny-heading"
          style={{
            fontSize: "clamp(2.5rem, 12vw, 4rem)",
            marginBottom: "8px",
            color: "#D7B66E",
          }}
        >
          RSVP!
        </h1>

        <form className="cny-form" onSubmit={handleSubmit}>
          <div className="cny-input-group">
            <label className="cny-label" htmlFor="name" style={{ color: "#D7B66E", fontSize: "1.1rem", fontWeight: 700 }}>
              Name
            </label>
            <input
              id="name"
              type="text"
              className="cny-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="cny-input-group">
            <label className="cny-label" htmlFor="phone" style={{ color: "#D7B66E", fontSize: "1.1rem", fontWeight: 700 }}>
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              className="cny-input"
              placeholder="(xxx) xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />
            <span
              className="cny-helper"
              style={{ textAlign: "left", marginTop: "4px", color: "#D7B66E" }}
            >
              So we can text you any updates
            </span>
          </div>

          <div className="cny-input-group">
            <label className="cny-label" htmlFor="birthdate" style={{ color: "#D7B66E", fontSize: "1.1rem", fontWeight: 700 }}>
              Birthdate
            </label>
            <input
              id="birthdate"
              type="text"
              className="cny-input"
              placeholder="MM/DD/YYYY"
              value={birthdate}
              onChange={(e) => setBirthdate(formatBirthdate(e.target.value))}
              inputMode="numeric"
            />
            <span
              className="cny-helper"
              style={{ textAlign: "left", marginTop: "4px", color: "#D7B66E" }}
            >
              Reveal your Chinese zodiac & what 2026 has in store!
            </span>
          </div>

          {error && (
            <p
              style={{
                color: "#ef4444",
                fontSize: "0.9rem",
                textAlign: "center",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <p
            style={{
              marginTop: "12px",
              padding: "20px 24px",
              background: "rgba(215, 182, 110, 0.3)",
              borderRadius: "12px",
              color: "#D7B66E",
              fontSize: "1.1rem",
              lineHeight: 1.6,
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            Bringing others? Each guest needs their own RSVP. Feel free to fill
            one out for them.
          </p>

          <button
            type="submit"
            className="cny-button"
            disabled={isSubmitting}
            style={{
              marginTop: "16px",
              width: "100%",
              fontSize: "1.4rem",
              padding: "24px 60px",
              letterSpacing: "3px",
              background: "linear-gradient(90deg, #D7B66E 0%, #E8C87D 25%, #D7B66E 50%, #C9A55E 75%, #D7B66E 100%)",
              color: "#910C1E",
            }}
          >
            {isSubmitting ? "Submitting..." : "RSVP Now!"}
          </button>
        </form>

        <img
          src="/cny/horse.svg"
          alt="Year of the Horse"
          style={{
            marginTop: "12px",
            width: "clamp(300px, 80vw, 500px)",
            maxWidth: "90vw",
            height: "auto",
          }}
        />
      </div>
    </div>
  );
}
