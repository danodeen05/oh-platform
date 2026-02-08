"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

// Replace with your Google Apps Script deployment URL
const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_CNY_RSVP_URL || "";

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
        await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            birthdate: birthdate,
            timestamp: new Date().toISOString(),
          }),
        });
      }

      // Transition to thank you page
      setIsTransitioning(true);
      setTimeout(() => {
        router.push("/en/cny/thanks");
      }, 400);
    } catch (err) {
      console.error("RSVP submission error:", err);
      // Still redirect even if there's an error (no-cors mode doesn't give us response)
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
          className="cny-heading cny-heading-red"
          style={{
            fontSize: "clamp(2rem, 9vw, 3rem)",
            marginBottom: "8px",
          }}
        >
          RSVP!
        </h1>

        <form className="cny-form" onSubmit={handleSubmit}>
          <div className="cny-input-group">
            <label className="cny-label" htmlFor="name">
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
            <label className="cny-label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              className="cny-input"
              placeholder="(xxx) xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <span
              className="cny-helper"
              style={{ textAlign: "left", marginTop: "4px" }}
            >
              So we can text you any updates
            </span>
          </div>

          <div className="cny-input-group">
            <label className="cny-label" htmlFor="birthdate">
              Birthdate
            </label>
            <input
              id="birthdate"
              type="date"
              className="cny-input"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
            />
            <span
              className="cny-helper"
              style={{ textAlign: "left", marginTop: "4px" }}
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
            className="cny-helper"
            style={{
              marginTop: "8px",
              padding: "12px",
              background: "rgba(145, 12, 30, 0.08)",
              borderRadius: "8px",
            }}
          >
            Bringing others? Each guest needs their own RSVP. Feel free to fill
            one out for them.
          </p>

          <button
            type="submit"
            className="cny-button cny-button-red"
            disabled={isSubmitting}
            style={{
              marginTop: "8px",
              width: "100%",
            }}
          >
            {isSubmitting ? "Submitting..." : "RSVP Now!"}
          </button>
        </form>
      </div>
    </div>
  );
}
