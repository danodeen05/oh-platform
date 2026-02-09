"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { getChineseZodiac } from "@/lib/cny/zodiac";

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
      // Calculate zodiac from birthdate if provided
      const zodiac = birthdate ? getChineseZodiac(birthdate).animal : "";

      // Submit to Google Apps Script (with zodiac for PowerPoint tracking)
      if (APPS_SCRIPT_URL) {
        const sheetParams = new URLSearchParams({
          name: name.trim(),
          phone: phone.trim(),
          birthdate: birthdate,
          zodiac: zodiac,
          timestamp: new Date().toISOString(),
        });

        const url = `${APPS_SCRIPT_URL}?${sheetParams.toString()}`;
        console.log("Submitting RSVP to:", url);

        // Use fetch with no-cors (fire and forget)
        await fetch(url, { method: "GET", mode: "no-cors" });
        console.log("RSVP submitted");
      }

      // Build query params for thanks page (for fortune modal)
      const thanksParams = new URLSearchParams({
        name: name.trim(),
        phone: phone.trim(),
        birthdate: birthdate,
      });

      setIsTransitioning(true);
      setTimeout(() => {
        router.push(`/en/cny/thanks?${thanksParams.toString()}`);
      }, 400);
    } catch (err) {
      console.error("RSVP submission error:", err);
      // Still redirect to thanks page even on error
      const thanksParams = new URLSearchParams({
        name: name.trim(),
        phone: phone.trim(),
        birthdate: birthdate,
      });
      setIsTransitioning(true);
      setTimeout(() => {
        router.push(`/en/cny/thanks?${thanksParams.toString()}`);
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
          top: "4%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          padding: "0 24px",
        }}
      >
        <h1
          className="cny-heading"
          style={{
            fontSize: "clamp(1.8rem, 8vw, 2.5rem)",
            marginBottom: "4px",
            color: "#D7B66E",
          }}
        >
          RSVP!
        </h1>

        <form className="cny-form" onSubmit={handleSubmit} style={{ gap: "10px" }}>
          <div className="cny-input-group">
            <label className="cny-label" htmlFor="name" style={{ color: "#D7B66E", fontSize: "0.9rem", fontWeight: 700 }}>
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
              style={{ padding: "10px 14px", fontSize: "0.95rem" }}
            />
          </div>

          <div className="cny-input-group">
            <label className="cny-label" htmlFor="phone" style={{ color: "#D7B66E", fontSize: "0.9rem", fontWeight: 700 }}>
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              className="cny-input"
              placeholder="(xxx) xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              style={{ padding: "10px 14px", fontSize: "0.95rem" }}
            />
            <span
              className="cny-helper"
              style={{ textAlign: "left", marginTop: "2px", color: "#D7B66E", fontSize: "0.75rem" }}
            >
              So we can text you any updates
            </span>
          </div>

          <div className="cny-input-group">
            <label className="cny-label" htmlFor="birthdate" style={{ color: "#D7B66E", fontSize: "0.9rem", fontWeight: 700 }}>
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
              style={{ padding: "10px 14px", fontSize: "0.95rem" }}
            />
            <span
              className="cny-helper"
              style={{ textAlign: "left", marginTop: "2px", color: "#D7B66E", fontSize: "0.75rem" }}
            >
              Reveal your Chinese zodiac & what 2026 has in store!
            </span>
          </div>

          {error && (
            <p
              style={{
                color: "#ef4444",
                fontSize: "0.85rem",
                textAlign: "center",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <p
            style={{
              marginTop: "6px",
              padding: "12px 16px",
              background: "rgba(215, 182, 110, 0.3)",
              borderRadius: "10px",
              color: "#D7B66E",
              fontSize: "0.85rem",
              lineHeight: 1.5,
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
              marginTop: "10px",
              width: "100%",
              fontSize: "1rem",
              padding: "14px 36px",
              letterSpacing: "2px",
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
            marginTop: "0px",
            width: "clamp(200px, 60vw, 350px)",
            maxWidth: "80vw",
            height: "auto",
          }}
        />
      </div>
    </div>
  );
}
