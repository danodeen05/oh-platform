"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ContactPage() {
  const t = useTranslations("contact");
  const tCommon = useTranslations("common");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "general",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(t("form.success"));
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
          {t("title")}
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
          {t("description")}
        </p>
      </section>

      <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "60px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "48px" }}>
          {/* Contact Form */}
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
              {t("form.title")}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>
                  {t("form.name")}
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
                  {t("form.email")}
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
                  {t("form.subject")}
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
                  <option value="general">{t("form.subjects.general")}</option>
                  <option value="order">{t("form.subjects.order")}</option>
                  <option value="feedback">{t("form.subjects.feedback")}</option>
                  <option value="corporate">{t("form.subjects.corporate")}</option>
                  <option value="press">{t("form.subjects.press")}</option>
                  <option value="careers">{t("form.subjects.careers")}</option>
                </select>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>
                  {t("form.message")}
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
                {t("sendMessage")}
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
              {t("other.title")}
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
                  <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", margin: 0 }}>{t("other.email.title")}</h3>
                </div>
                <p style={{ color: "#7C7A67", fontWeight: "500", margin: 0 }}>
                  {t("other.email.value")}
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
                  <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", margin: 0 }}>{t("other.location.title")}</h3>
                </div>
                <p style={{ color: "#666", margin: 0, lineHeight: "1.6" }}>
                  {t("other.location.opening")}<br />
                  {t("other.location.city")}
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
                  <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", margin: 0 }}>{t("other.responseTime.title")}</h3>
                </div>
                <p style={{ color: "#666", margin: 0 }}>
                  {t("other.responseTime.value")}
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
                {t("social.title")}
              </h3>
              <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "16px" }}>
                {t("social.description")}
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
          {t("faq.title")}
        </h2>
        <p style={{ color: "#666", marginBottom: "24px" }}>
          {t("faq.description")}
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
          {tCommon("viewFaq")}
        </Link>
      </section>
    </div>
  );
}
