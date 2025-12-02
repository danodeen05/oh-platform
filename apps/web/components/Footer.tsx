"use client";
import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        background: "#f9f9f9",
        borderTop: "1px solid #e5e5e5",
        padding: "64px 24px 32px",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        {/* Social Media Icons */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            justifyContent: "center",
            marginBottom: "48px",
            flexWrap: "wrap",
          }}
        >
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="Instagram"
          >
            📷
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="X (Twitter)"
          >
            𝕏
          </a>
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="Facebook"
          >
            f
          </a>
          <a
            href="https://tiktok.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="TikTok"
          >
            ♪
          </a>
          <a
            href="https://yelp.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="Yelp"
          >
            ⭐
          </a>
          <a
            href="https://tripadvisor.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="TripAdvisor"
          >
            🦉
          </a>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="YouTube"
          >
            ▶
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="LinkedIn"
          >
            in
          </a>
          <a
            href="mailto:info@ohbeef.com"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a4a",
              textDecoration: "none",
              transition: "all 0.3s ease",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d0d0d0";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            aria-label="Email"
          >
            ✉
          </a>
        </div>

        {/* Footer Links */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "32px",
          }}
        >
          <Link
            href="/accessibility"
            style={{
              color: "#666",
              textDecoration: "none",
              fontSize: "0.9rem",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >
            Accessibility
          </Link>
          <span style={{ color: "#ccc" }}>•</span>
          <Link
            href="/careers"
            style={{
              color: "#666",
              textDecoration: "none",
              fontSize: "0.9rem",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >
            Careers
          </Link>
          <span style={{ color: "#ccc" }}>•</span>
          <Link
            href="/contact"
            style={{
              color: "#666",
              textDecoration: "none",
              fontSize: "0.9rem",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >
            Contact
          </Link>
          <span style={{ color: "#ccc" }}>•</span>
          <Link
            href="/press"
            style={{
              color: "#666",
              textDecoration: "none",
              fontSize: "0.9rem",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >
            Press
          </Link>
          <span style={{ color: "#ccc" }}>•</span>
          <Link
            href="/privacy"
            style={{
              color: "#666",
              textDecoration: "none",
              fontSize: "0.9rem",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >
            Privacy Policy
          </Link>
        </div>

        {/* Copyright */}
        <div
          style={{
            textAlign: "center",
            color: "#999",
            fontSize: "0.85rem",
          }}
        >
          © {new Date().getFullYear()} Oh. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
