"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { locales, localeNames, type Locale } from "@/i18n/config";

type LanguageSwitcherProps = {
  size?: "small" | "normal";
};

export default function LanguageSwitcher({ size = "normal" }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSmall = size === "small";

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
          gap: isSmall ? "4px" : "6px",
          padding: isSmall ? "4px 8px" : "8px 12px",
          background: "transparent",
          border: isSmall ? "1px solid rgba(124, 122, 103, 0.4)" : "1px solid rgba(124, 122, 103, 0.3)",
          borderRadius: isSmall ? "4px" : "6px",
          color: isSmall ? "#999" : "#4a4a4a",
          fontSize: isSmall ? "0.7rem" : "0.85rem",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#7C7A67";
          e.currentTarget.style.background = isSmall ? "rgba(124, 122, 103, 0.1)" : "rgba(124, 122, 103, 0.05)";
          e.currentTarget.style.color = isSmall ? "#C7A878" : "#4a4a4a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = isSmall ? "rgba(124, 122, 103, 0.4)" : "rgba(124, 122, 103, 0.3)";
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = isSmall ? "#999" : "#4a4a4a";
        }}
        aria-label="Select language"
      >
        <span style={{ fontSize: isSmall ? "0.75rem" : "1rem", marginRight: isSmall ? "2px" : "4px" }}>文A</span>
        <span>{localeNames[locale as Locale]}</span>
        <span style={{ fontSize: isSmall ? "0.55rem" : "0.7rem", marginLeft: isSmall ? "2px" : "4px" }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: isSmall ? "100%" : undefined,
            top: isSmall ? undefined : "100%",
            right: 0,
            marginTop: isSmall ? undefined : "4px",
            marginBottom: isSmall ? "4px" : undefined,
            background: isSmall ? "#333" : "white",
            border: isSmall ? "1px solid rgba(124, 122, 103, 0.3)" : "1px solid rgba(124, 122, 103, 0.2)",
            borderRadius: isSmall ? "6px" : "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            overflow: "hidden",
            zIndex: 100,
            minWidth: isSmall ? "120px" : "140px",
          }}
        >
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              style={{
                display: "block",
                width: "100%",
                padding: isSmall ? "8px 12px" : "10px 16px",
                textAlign: "left",
                background: loc === locale ? (isSmall ? "rgba(124, 122, 103, 0.2)" : "rgba(124, 122, 103, 0.1)") : "transparent",
                border: "none",
                borderBottom: isSmall ? "1px solid rgba(124, 122, 103, 0.2)" : "1px solid rgba(124, 122, 103, 0.1)",
                color: loc === locale ? "#C7A878" : (isSmall ? "#ccc" : "#4a4a4a"),
                fontSize: isSmall ? "0.8rem" : "0.9rem",
                cursor: "pointer",
                fontWeight: loc === locale ? "500" : "400",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (loc !== locale) {
                  e.currentTarget.style.background = isSmall ? "rgba(124, 122, 103, 0.15)" : "rgba(124, 122, 103, 0.05)";
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
