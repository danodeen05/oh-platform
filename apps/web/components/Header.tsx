"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, UserButton } from "@clerk/nextjs";

// Custom icon for the Oh! Account menu item
const OhAccountIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
);

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/menu", label: "Menu" },
    { href: "/locations", label: "Locations" },
    { href: "/gift-cards", label: "Gift Cards" },
    { href: "/store", label: "Store" },
    { href: "/loyalty", label: "Loyalty" },
  ];

  return (
    <header
      style={{
        background: "rgba(229, 229, 229, 0.95)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(124, 122, 103, 0.15)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <nav
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo and Mobile Menu Button Container */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: "none",
              background: "transparent",
              border: "none",
              color: "#222222",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "8px",
            }}
            className="mobile-menu-btn"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>

          {/* Logo */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Image
              src="/Oh_Logo_Mark_Web.png"
              alt="Oh Logo"
              width={60}
              height={60}
              style={{ display: "block" }}
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div
          style={{
            display: "none",
            gap: "32px",
            alignItems: "center",
          }}
          className="desktop-nav"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: "#4a4a4a",
                textDecoration: "none",
                fontSize: "0.95rem",
                fontWeight: "500",
                letterSpacing: "0.5px",
                transition: "color 0.3s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#7C7A67")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4a4a4a")}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* User Button */}
        <SignedIn>
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link
                  label="My Oh! Account"
                  labelIcon={<OhAccountIcon />}
                  href="/member"
                />
              </UserButton.MenuItems>
            </UserButton>
          </div>
        </SignedIn>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            background: "#f5f5f5",
            borderTop: "1px solid rgba(124, 122, 103, 0.15)",
            padding: "24px",
          }}
          className="mobile-menu"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  color: "#222222",
                  textDecoration: "none",
                  fontSize: "1.1rem",
                  fontWeight: "500",
                  letterSpacing: "0.5px",
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(124, 122, 103, 0.15)",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 767px) {
          .mobile-menu-btn {
            display: block !important;
          }
        }
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
