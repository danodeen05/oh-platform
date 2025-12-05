"use client";

export default function Footer() {
  return (
    <footer
      style={{
        background: "#222222",
        borderTop: "1px solid rgba(124, 122, 103, 0.15)",
        padding: "64px 24px 32px",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
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
          {[
            { href: "https://instagram.com", icon: "📷", label: "Instagram" },
            { href: "https://twitter.com", icon: "𝕏", label: "X (Twitter)" },
            { href: "https://facebook.com", icon: "f", label: "Facebook" },
            { href: "https://tiktok.com", icon: "♪", label: "TikTok" },
            { href: "https://yelp.com", icon: "⭐", label: "Yelp" },
            { href: "https://tripadvisor.com", icon: "🦉", label: "TripAdvisor" },
            { href: "https://youtube.com", icon: "▶", label: "YouTube" },
            { href: "https://linkedin.com", icon: "in", label: "LinkedIn" },
            { href: "mailto:info@ohbeef.com", icon: "✉", label: "Email" },
          ].map((social) => (
            <a
              key={social.label}
              href={social.href}
              target={social.href.startsWith("mailto") ? undefined : "_blank"}
              rel={social.href.startsWith("mailto") ? undefined : "noopener noreferrer"}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(124, 122, 103, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#E5E5E5",
                textDecoration: "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                fontSize: "1.2rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#7C7A67";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(124, 122, 103, 0.2)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              aria-label={social.label}
            >
              {social.icon}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div
          style={{
            textAlign: "center",
            color: "#7C7A67",
            fontSize: "0.85rem",
            letterSpacing: "0.5px",
          }}
        >
          © {new Date().getFullYear()} Oh! Beef Noodle Soup. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
