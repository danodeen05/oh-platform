"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { locales, localeNames, type Locale } from "@/i18n/config";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    // Remove the current locale prefix and add the new one
    const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/";
    router.push(`/${newLocale}${pathWithoutLocale}`);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 12px",
          background: "transparent",
          border: "1px solid rgba(124, 122, 103, 0.3)",
          borderRadius: "6px",
          color: "#4a4a4a",
          fontSize: "0.85rem",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#7C7A67";
          e.currentTarget.style.background = "rgba(124, 122, 103, 0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(124, 122, 103, 0.3)";
          e.currentTarget.style.background = "transparent";
        }}
        aria-label="Select language"
      >
        <span style={{ fontSize: "1rem" }}>🌐</span>
        <span>{localeNames[locale as Locale]}</span>
        <span style={{ fontSize: "0.7rem", marginLeft: "2px" }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            background: "white",
            border: "1px solid rgba(124, 122, 103, 0.2)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            overflow: "hidden",
            zIndex: 100,
            minWidth: "140px",
          }}
        >
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 16px",
                textAlign: "left",
                background: loc === locale ? "rgba(124, 122, 103, 0.1)" : "transparent",
                border: "none",
                borderBottom: "1px solid rgba(124, 122, 103, 0.1)",
                color: loc === locale ? "#7C7A67" : "#4a4a4a",
                fontSize: "0.9rem",
                cursor: "pointer",
                fontWeight: loc === locale ? "500" : "400",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (loc !== locale) {
                  e.currentTarget.style.background = "rgba(124, 122, 103, 0.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (loc !== locale) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {localeNames[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
