"use client";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

// SVG icons for social platforms - dark olive (#7C7A67) fill
const SocialIcons = {
  Instagram: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  X: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  Facebook: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  TikTok: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
  Yelp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M20.16 12.594l-4.995 1.433c-.96.276-1.74-.8-1.176-1.63l2.905-4.308a1.072 1.072 0 0 1 1.596-.206 9.194 9.194 0 0 1 2.364 3.252 1.073 1.073 0 0 1-.686 1.459zm-5.025 3.152l4.942 1.606a1.072 1.072 0 0 1 .636 1.48 9.188 9.188 0 0 1-2.51 3.136 1.07 1.07 0 0 1-1.59-.25l-2.797-4.39c-.56-.837.196-1.882 1.32-1.582zm-3.348.063c-.088 1-.263 2.882-.32 3.51a1.073 1.073 0 0 1-1.15 1.018 9.186 9.186 0 0 1-3.93-1.168 1.07 1.07 0 0 1-.304-1.6l3.086-4.03c.6-.78 1.706-.378 1.695.59-.006.498-.05 1.18-.077 1.68zM8.76 9.89l-4.63-2.485a1.07 1.07 0 0 1-.436-1.535 9.188 9.188 0 0 1 3.035-2.862 1.073 1.073 0 0 1 1.576.38l2.24 4.73c.416.88-.49 1.823-1.33 1.452l-.455-.212zm.04 4.64L5.33 15.24a1.073 1.073 0 0 1-1.53-.336 9.188 9.188 0 0 1-.93-3.925 1.072 1.072 0 0 1 1.088-1.11l5.25.11c1 .02 1.36 1.186.56 1.78l-.97.68z"/>
    </svg>
  ),
  TripAdvisor: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M12.006 4.295c-2.67 0-5.338.784-7.645 2.353H0l1.963 2.135a5.997 5.997 0 0 0 4.04 10.432 5.976 5.976 0 0 0 4.075-1.6L12 19.5l1.922-1.886a5.976 5.976 0 0 0 4.075 1.6 5.997 5.997 0 0 0 4.04-10.432L24 6.647h-4.35a13.573 13.573 0 0 0-7.644-2.352zM12 6.807c1.822 0 3.596.46 5.166 1.336a6.01 6.01 0 0 0-2.162 1.667 6.01 6.01 0 0 0-2.162-1.667A11.397 11.397 0 0 1 12 6.807zm-6.003 2.77a3.828 3.828 0 1 1 0 7.656 3.828 3.828 0 0 1 0-7.656zm12.006 0a3.828 3.828 0 1 1 0 7.656 3.828 3.828 0 0 1 0-7.656zM6.003 11.498a2.09 2.09 0 1 0 0 4.18 2.09 2.09 0 0 0 0-4.18zm11.994 0a2.09 2.09 0 1 0 0 4.18 2.09 2.09 0 0 0 0-4.18z"/>
    </svg>
  ),
  YouTube: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  LinkedIn: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  Email: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#7C7A67">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>
  ),
};

export default function Footer() {
  const t = useTranslations("footer");
  const locale = useLocale();

  const footerLinks = [
    { href: `/${locale}/accessibility`, labelKey: "links.accessibility" },
    { href: `/${locale}/careers`, labelKey: "links.careers" },
    { href: `/${locale}/contact`, labelKey: "links.contact" },
    { href: `/${locale}/press`, labelKey: "links.press" },
    { href: `/${locale}/privacy`, labelKey: "links.privacy" },
  ];

  const socialLinks = [
    { href: "https://instagram.com", icon: SocialIcons.Instagram, label: "Instagram" },
    { href: "https://twitter.com", icon: SocialIcons.X, label: "X (Twitter)" },
    { href: "https://facebook.com", icon: SocialIcons.Facebook, label: "Facebook" },
    { href: "https://tiktok.com", icon: SocialIcons.TikTok, label: "TikTok" },
    { href: "https://yelp.com", icon: SocialIcons.Yelp, label: "Yelp" },
    { href: "https://tripadvisor.com", icon: SocialIcons.TripAdvisor, label: "TripAdvisor" },
    { href: "https://youtube.com", icon: SocialIcons.YouTube, label: "YouTube" },
    { href: "https://linkedin.com", icon: SocialIcons.LinkedIn, label: "LinkedIn" },
    { href: "mailto:info@ohbeef.com", icon: SocialIcons.Email, label: "Email" },
  ];

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
            gap: "12px",
            justifyContent: "center",
            marginBottom: "48px",
            flexWrap: "wrap",
          }}
        >
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target={social.href.startsWith("mailto") ? undefined : "_blank"}
              rel={social.href.startsWith("mailto") ? undefined : "noopener noreferrer"}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#E5E5E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#C7A878";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#E5E5E5";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              aria-label={social.label}
            >
              {social.icon}
            </a>
          ))}
        </div>

        {/* Footer Links */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "32px",
            alignItems: "center",
          }}
        >
          {footerLinks.map((link, index) => (
            <span key={link.href} style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <Link
                href={link.href}
                style={{
                  color: "#999",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                  transition: "color 0.3s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#C7A878")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
              >
                {t(link.labelKey)}
              </Link>
              {index < footerLinks.length - 1 && (
                <span style={{ color: "#555" }}>•</span>
              )}
            </span>
          ))}
        </div>

        {/* Language Selector and Copyright */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          <LanguageSwitcher size="small" />
          <div
            style={{
              color: "#7C7A67",
              fontSize: "0.8rem",
              letterSpacing: "0.5px",
            }}
          >
            {t("copyright", { year: new Date().getFullYear() })}
          </div>
        </div>
      </div>
    </footer>
  );
}
