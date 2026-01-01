"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Language options without flags - just names
const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文" },
];

interface LanguageSelectorProps {
  variant?: "full" | "compact" | "prominent";
  onSelect?: () => void;
}

export function LanguageSelector({ variant = "full", onSelect }: LanguageSelectorProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tCommon = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const currentLanguage = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  // Animated highlight cycling for prominent variant
  useEffect(() => {
    if (variant !== "prominent") return;

    const interval = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % LANGUAGES.length);
    }, 2000); // Cycle every 2 seconds

    return () => clearInterval(interval);
  }, [variant]);

  function handleSelectLanguage(code: string) {
    // Replace the locale segment in the pathname
    const segments = pathname.split("/");
    segments[1] = code; // Replace locale segment
    const newPath = segments.join("/");

    // Preserve query parameters
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${newPath}?${queryString}` : newPath;

    router.push(fullPath);
    setIsOpen(false);
    onSelect?.();
  }

  if (variant === "compact") {
    return (
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "rgba(255, 255, 255, 0.95)",
            border: "2px solid rgba(124, 122, 103, 0.3)",
            borderRadius: 12,
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
            color: "#3d3c35",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          {currentLanguage.nativeName}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99,
              }}
              onClick={() => setIsOpen(false)}
            />
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: 0,
                background: "white",
                borderRadius: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                overflow: "hidden",
                zIndex: 100,
                minWidth: 180,
              }}
            >
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleSelectLanguage(lang.code)}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    background: lang.code === locale ? "rgba(124, 122, 103, 0.1)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "1rem",
                    color: "#3d3c35",
                    fontWeight: lang.code === locale ? 600 : 400,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{lang.nativeName}</span>
                  {lang.code === locale && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C7A67" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Prominent variant - larger, top-center with animated cycling highlight
  if (variant === "prominent") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Globe icon with subtle animation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#7C7A67",
            fontSize: "0.9rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          {tCommon("selectLanguage")}
        </div>

        {/* Language buttons in a row */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 6,
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: 16,
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          }}
        >
          {LANGUAGES.map((lang, index) => {
            const isSelected = lang.code === locale;
            const isHighlighted = index === highlightIndex && !isSelected;

            return (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                style={{
                  padding: "13px 22px",
                  background: isSelected
                    ? "#7C7A67"
                    : isHighlighted
                    ? "rgba(124, 122, 103, 0.15)"
                    : "transparent",
                  border: `2px solid ${
                    isSelected
                      ? "#7C7A67"
                      : isHighlighted
                      ? "#7C7A67"
                      : "rgba(124, 122, 103, 0.2)"
                  }`,
                  borderRadius: 11,
                  cursor: "pointer",
                  fontSize: "1rem",
                  color: isSelected ? "white" : "#3d3c35",
                  fontWeight: isSelected ? 700 : 500,
                  transition: "all 0.3s ease",
                  transform: isHighlighted ? "scale(1.05)" : "scale(1)",
                  minWidth: 96,
                }}
              >
                {lang.nativeName}
              </button>
            );
          })}
        </div>

        {/* CSS for pulse animation */}
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }
        `}</style>
      </div>
    );
  }

  // Full variant - shows all languages as buttons
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          color: "#7C7A67",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {tCommon("selectLanguage")}
      </div>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleSelectLanguage(lang.code)}
          style={{
            padding: "12px 16px",
            background: lang.code === locale ? "#7C7A67" : "transparent",
            border: `2px solid ${lang.code === locale ? "#7C7A67" : "rgba(124, 122, 103, 0.3)"}`,
            borderRadius: 10,
            cursor: "pointer",
            fontSize: "1rem",
            color: lang.code === locale ? "white" : "#3d3c35",
            fontWeight: lang.code === locale ? 600 : 400,
            transition: "all 0.15s ease",
            textAlign: "left",
          }}
        >
          {lang.nativeName}
        </button>
      ))}
    </div>
  );
}
