"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "general",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    alert("Thank you for your message! We'll get back to you soon.");
  };

  return (
    <div style={{ background: "#E5E5E5", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        style={{
          background: "linear-gradient(180deg, #222222 0%, #333333 100%)",
          color: "#E5E5E5",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 3.5rem)",
            fontWeight: "300",
            marginBottom: "16px",
            letterSpacing: "2px",
            color: "#E5E5E5",
          }}
        >
          Contact Us
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: "1.8",
            opacity: 0.9,
            fontWeight: "300",
          }}
        >
          We&apos;d love to hear from you. Whether you have a question, feedback, or just want to say hi—we&apos;re here.
        </p>
      </section>

      <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "60px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "48px" }}>
          {/* Contact Form */}
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
              Send Us a Message
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>
                  Your Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>
                  Subject
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    outline: "none",
                    background: "white",
                  }}
                >
                  <option value="general">General Inquiry</option>
                  <option value="order">Order Support</option>
                  <option value="feedback">Feedback</option>
                  <option value="corporate">Corporate / Bulk Orders</option>
                  <option value="press">Press Inquiry</option>
                  <option value="careers">Career Opportunities</option>
                </select>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background 0.3s",
                }}
              >
                Send Message
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
              Other Ways to Reach Us
            </h2>

            <div style={{ marginBottom: "32px" }}>
              <div
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "12px",
                  marginBottom: "16px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "1.5rem" }}>📧</span>
                  <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", margin: 0 }}>Email</h3>
                </div>
                <p style={{ color: "#7C7A67", fontWeight: "500", margin: 0 }}>
                  hello@ohbeefnoodlesoup.com
                </p>
              </div>

              <div
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "12px",
                  marginBottom: "16px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "1.5rem" }}>📍</span>
                  <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", margin: 0 }}>Location</h3>
                </div>
                <p style={{ color: "#666", margin: 0, lineHeight: "1.6" }}>
                  Opening Spring 2025<br />
                  San Francisco, CA
                </p>
              </div>

              <div
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "1.5rem" }}>⏰</span>
                  <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", margin: 0 }}>Response Time</h3>
                </div>
                <p style={{ color: "#666", margin: 0 }}>
                  We typically respond within 24 hours
                </p>
              </div>
            </div>

            <div
              style={{
                background: "rgba(199, 168, 120, 0.15)",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid rgba(199, 168, 120, 0.3)",
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
                Follow Us
              </h3>
              <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "16px" }}>
                Stay connected for updates, behind-the-scenes, and exclusive offers.
              </p>
              <div style={{ display: "flex", gap: "12px" }}>
                {["Instagram", "X", "TikTok"].map((platform) => (
                  <a
                    key={platform}
                    href="#"
                    style={{
                      padding: "10px 16px",
                      background: "#7C7A67",
                      color: "white",
                      borderRadius: "8px",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      fontWeight: "500",
                    }}
                  >
                    {platform}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Link */}
      <section style={{ background: "white", padding: "60px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: "400", color: "#222222", marginBottom: "12px" }}>
          Have a quick question?
        </h2>
        <p style={{ color: "#666", marginBottom: "24px" }}>
          Check out our frequently asked questions for instant answers.
        </p>
        <Link
          href="/gift-cards#faq"
          style={{
            display: "inline-block",
            padding: "14px 32px",
            background: "transparent",
            color: "#7C7A67",
            border: "2px solid #7C7A67",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "500",
          }}
        >
          View FAQ
        </Link>
      </section>
    </div>
  );
}
