"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useTranslations, useLocale } from "next-intl";

// Custom icon for the Oh! Account menu item
const OhAccountIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
);

// Dropdown chevron icon
const ChevronDown = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{
      marginLeft: "4px",
      transition: "transform 0.2s ease",
      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
    }}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// Dropdown component for desktop nav
function NavDropdown({
  label,
  items,
  isOpen,
  onToggle,
  onClose
}: {
  label: string;
  items: { href: string; label: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={onToggle}
        style={{
          color: "#4a4a4a",
          background: "transparent",
          border: "none",
          fontSize: "0.95rem",
          fontWeight: "500",
          letterSpacing: "0.5px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          padding: 0,
          transition: "color 0.3s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#7C7A67")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#4a4a4a")}
      >
        {label}
        <ChevronDown isOpen={isOpen} />
      </button>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "12px",
            background: "white",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            minWidth: "160px",
            padding: "8px 0",
            zIndex: 100,
          }}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              style={{
                display: "block",
                padding: "10px 16px",
                color: "#4a4a4a",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: "500",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>(null);
  const t = useTranslations("navigation");
  const locale = useLocale();

  // Dropdown menu structure
  const aboutUsItems = [
    { href: `/${locale}/menu`, label: t("menu") },
    { href: `/${locale}/locations`, label: t("locations") },
  ];

  const shopItems = [
    { href: `/${locale}/store`, label: t("ohStore") },
    { href: `/${locale}/gift-cards`, label: t("giftCards") },
  ];

  const memberBenefitsItems = [
    { href: `/${locale}/loyalty`, label: t("loyalty") },
    { href: `/${locale}/referral`, label: t("referral") },
    { href: `/${locale}/member`, label: t("myAccount") },
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
            href={`/${locale}`}
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
          {/* About Us Dropdown */}
          <NavDropdown
            label={t("aboutUs")}
            items={aboutUsItems}
            isOpen={openDropdown === "aboutUs"}
            onToggle={() => setOpenDropdown(openDropdown === "aboutUs" ? null : "aboutUs")}
            onClose={() => setOpenDropdown(null)}
          />

          {/* Shop Dropdown */}
          <NavDropdown
            label={t("shop")}
            items={shopItems}
            isOpen={openDropdown === "shop"}
            onToggle={() => setOpenDropdown(openDropdown === "shop" ? null : "shop")}
            onClose={() => setOpenDropdown(null)}
          />

          {/* Member Benefits Dropdown - Only shown when signed in */}
          <SignedIn>
            <NavDropdown
              label={t("memberBenefits")}
              items={memberBenefitsItems}
              isOpen={openDropdown === "memberBenefits"}
              onToggle={() => setOpenDropdown(openDropdown === "memberBenefits" ? null : "memberBenefits")}
              onClose={() => setOpenDropdown(null)}
            />
          </SignedIn>
        </div>

        {/* Right side: Auth Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <SignedOut>
            <SignInButton mode="modal">
              <button
                style={{
                  background: "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#6a6857")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#7C7A67")}
              >
                {t("signIn")}
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: {
                      width: "40px",
                      height: "40px",
                    },
                  },
                }}
              >
                <UserButton.MenuItems>
                  <UserButton.Link
                    label={t("myAccount")}
                    labelIcon={<OhAccountIcon />}
                    href={`/${locale}/member`}
                  />
                </UserButton.MenuItems>
              </UserButton>
            </div>
          </SignedIn>
        </div>
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
              gap: "0",
            }}
          >
            {/* About Us Section */}
            <div style={{ borderBottom: "1px solid rgba(124, 122, 103, 0.15)" }}>
              <button
                onClick={() => setMobileExpandedSection(mobileExpandedSection === "aboutUs" ? null : "aboutUs")}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "transparent",
                  border: "none",
                  color: "#222222",
                  fontSize: "1.1rem",
                  fontWeight: "500",
                  letterSpacing: "0.5px",
                  padding: "12px 0",
                  cursor: "pointer",
                }}
              >
                {t("aboutUs")}
                <ChevronDown isOpen={mobileExpandedSection === "aboutUs"} />
              </button>
              {mobileExpandedSection === "aboutUs" && (
                <div style={{ paddingLeft: "16px", paddingBottom: "8px" }}>
                  {aboutUsItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: "block",
                        color: "#4a4a4a",
                        textDecoration: "none",
                        fontSize: "1rem",
                        padding: "8px 0",
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Shop Section */}
            <div style={{ borderBottom: "1px solid rgba(124, 122, 103, 0.15)" }}>
              <button
                onClick={() => setMobileExpandedSection(mobileExpandedSection === "shop" ? null : "shop")}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "transparent",
                  border: "none",
                  color: "#222222",
                  fontSize: "1.1rem",
                  fontWeight: "500",
                  letterSpacing: "0.5px",
                  padding: "12px 0",
                  cursor: "pointer",
                }}
              >
                {t("shop")}
                <ChevronDown isOpen={mobileExpandedSection === "shop"} />
              </button>
              {mobileExpandedSection === "shop" && (
                <div style={{ paddingLeft: "16px", paddingBottom: "8px" }}>
                  {shopItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: "block",
                        color: "#4a4a4a",
                        textDecoration: "none",
                        fontSize: "1rem",
                        padding: "8px 0",
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Member Benefits Section - Only for signed in users */}
            <SignedIn>
              <div style={{ borderBottom: "1px solid rgba(124, 122, 103, 0.15)" }}>
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === "memberBenefits" ? null : "memberBenefits")}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "transparent",
                    border: "none",
                    color: "#222222",
                    fontSize: "1.1rem",
                    fontWeight: "500",
                    letterSpacing: "0.5px",
                    padding: "12px 0",
                    cursor: "pointer",
                  }}
                >
                  {t("memberBenefits")}
                  <ChevronDown isOpen={mobileExpandedSection === "memberBenefits"} />
                </button>
                {mobileExpandedSection === "memberBenefits" && (
                  <div style={{ paddingLeft: "16px", paddingBottom: "8px" }}>
                    {memberBenefitsItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        style={{
                          display: "block",
                          color: "#4a4a4a",
                          textDecoration: "none",
                          fontSize: "1rem",
                          padding: "8px 0",
                        }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </SignedIn>

            {/* Sign In for mobile - only for signed out users */}
            <SignedOut>
              <div style={{ paddingTop: "16px" }}>
                <SignInButton mode="modal">
                  <button
                    style={{
                      width: "100%",
                      background: "#7C7A67",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      padding: "12px 20px",
                      fontSize: "1rem",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {t("signIn")}
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
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
