"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, UserButton } from "@clerk/nextjs";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #e5e5e5",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <nav
        style={{
          maxWidth: "1400px",
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
              color: "#2a2a2a",
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
            }}
          >
            <Image
              src="/Oh Logo with elements.svg"
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
            marginRight: "80px",
          }}
          className="desktop-nav"
        >
          <Link
            href="/menu"
            style={{
              color: "#4a4a4a",
              textDecoration: "none",
              fontSize: "0.95rem",
              fontWeight: "400",
              letterSpacing: "0.5px",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#4a4a4a")}
          >
            Menu
          </Link>
          <Link
            href="/locations"
            style={{
              color: "#4a4a4a",
              textDecoration: "none",
              fontSize: "0.95rem",
              fontWeight: "400",
              letterSpacing: "0.5px",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#4a4a4a")}
          >
            Locations
          </Link>
          <Link
            href="/gift-cards"
            style={{
              color: "#4a4a4a",
              textDecoration: "none",
              fontSize: "0.95rem",
              fontWeight: "400",
              letterSpacing: "0.5px",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#4a4a4a")}
          >
            Digital Gift Cards
          </Link>
          <Link
            href="/store"
            style={{
              color: "#4a4a4a",
              textDecoration: "none",
              fontSize: "0.95rem",
              fontWeight: "400",
              letterSpacing: "0.5px",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#4a4a4a")}
          >
            Online Store
          </Link>
          <Link
            href="/loyalty"
            style={{
              color: "#4a4a4a",
              textDecoration: "none",
              fontSize: "0.95rem",
              fontWeight: "400",
              letterSpacing: "0.5px",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#4a4a4a")}
          >
            Loyalty Program
          </Link>
        </div>

        {/* User Button */}
        <SignedIn>
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <UserButton />
          </div>
        </SignedIn>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            background: "#f9f9f9",
            borderTop: "1px solid #e5e5e5",
            padding: "24px",
          }}
          className="mobile-menu"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <Link
              href="/menu"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: "#2a2a2a",
                textDecoration: "none",
                fontSize: "1.1rem",
                fontWeight: "400",
                letterSpacing: "0.5px",
                padding: "12px 0",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              Menu
            </Link>
            <Link
              href="/locations"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: "#2a2a2a",
                textDecoration: "none",
                fontSize: "1.1rem",
                fontWeight: "400",
                letterSpacing: "0.5px",
                padding: "12px 0",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              Locations
            </Link>
            <Link
              href="/gift-cards"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: "#2a2a2a",
                textDecoration: "none",
                fontSize: "1.1rem",
                fontWeight: "400",
                letterSpacing: "0.5px",
                padding: "12px 0",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              Digital Gift Cards
            </Link>
            <Link
              href="/store"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: "#2a2a2a",
                textDecoration: "none",
                fontSize: "1.1rem",
                fontWeight: "400",
                letterSpacing: "0.5px",
                padding: "12px 0",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              Online Store
            </Link>
            <Link
              href="/loyalty"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: "#2a2a2a",
                textDecoration: "none",
                fontSize: "1.1rem",
                fontWeight: "400",
                letterSpacing: "0.5px",
                padding: "12px 0",
              }}
            >
              Loyalty Program
            </Link>
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
