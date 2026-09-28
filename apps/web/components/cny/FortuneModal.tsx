"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

interface FortuneModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string;
  birthdate: string;
}

interface FortuneResponse {
  fortune: string;
  zodiac: string | null;
  element: string | null;
  luckyNumbers: number[];
  luckyColors: string[];
  compatibleWith: string[];
  luckyNumbersInPhone: number[];
}

type LoadingState = "loading" | "success" | "error";

// Parse the fortune text to extract sections and the lucky phrase
function parseFortune(text: string): {
  sections: { title: string; content: string }[];
  luckyPhrase: { chinese: string; pinyin: string; meaning: string } | null;
} {
  const sections: { title: string; content: string }[] = [];
  let luckyPhrase: { chinese: string; pinyin: string; meaning: string } | null =
    null;

  // Split by section headers (marked with **)
  const parts = text.split(/\*\*([^*]+)\*\*/);

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i]?.trim() || "";
    const content = parts[i + 1]?.trim() || "";

    if (title && content) {
      // The lucky phrase section: its header is translated, so find it by its shape (four characters, then pinyin in parentheses).
      if (/[一-龯]{4}\s*\([^)]+\)\s*[-–—]/.test(content)) {
        // Try to extract Chinese characters, pinyin, and meaning
        const phraseMatch = content.match(
          /([一-龯]{4})\s*\(([^)]+)\)\s*[-–—]\s*(.+?)(?:\n|$)/
        );
        if (phraseMatch) {
          luckyPhrase = {
            chinese: phraseMatch[1],
            pinyin: phraseMatch[2],
            meaning: phraseMatch[3].trim(),
          };
        }
      }
      sections.push({ title, content });
    }
  }

  return { sections, luckyPhrase };
}

export function FortuneModal({
  open,
  onClose,
  name,
  phone,
  birthdate,
}: FortuneModalProps) {
  const t = useTranslations("cny");
  const locale = useLocale();
  const [state, setState] = useState<LoadingState>("loading");
  const [fortune, setFortune] = useState<FortuneResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchFortune = useCallback(async () => {
    setState("loading");
    setError("");
    setDisplayedText("");
    setIsTyping(false);

    try {
      const response = await fetch("/api/cny/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, birthdate, locale }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "fortune");
      }

      const data: FortuneResponse = await response.json();
      setFortune(data);
      setState("success");
      setIsTyping(true);
    } catch {
      // The server's reason is English and technical; the page says it plainly.
      setError(t("fortune.error"));
      setState("error");
    }
  }, [name, phone, birthdate, locale, t]);

  // Fetch fortune when modal opens
  useEffect(() => {
    if (open && name) {
      fetchFortune();
    }
  }, [open, name, fetchFortune]);

  // Typewriter effect
  useEffect(() => {
    if (!isTyping || !fortune?.fortune) return;

    const text = fortune.fortune;
    let currentIndex = 0;

    const typeNextChar = () => {
      if (currentIndex < text.length) {
        const char = text[currentIndex];
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;

        // Variable delay based on character
        let delay = 20; // Base delay
        if (char === "." || char === "!" || char === "?") {
          delay = 80;
        } else if (char === ",") {
          delay = 40;
        } else if (char === "\n") {
          delay = 60;
        }

        setTimeout(typeNextChar, delay);
      } else {
        setIsTyping(false);
      }
    };

    // Start typing after a brief delay
    const startTimeout = setTimeout(typeNextChar, 300);
    return () => clearTimeout(startTimeout);
  }, [isTyping, fortune?.fortune]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Format displayed text with section headers
  const formatDisplayedText = (text: string) => {
    // Replace **Header** with styled spans
    return text.replace(
      /\*\*([^*]+)\*\*/g,
      '<h3 class="fortune-section-title">$1</h3>'
    );
  };

  if (!open || !mounted) return null;

  const firstName = name.split(" ")[0];
  // "Fire Horse" in the reader's words (the API names them in English).
  const badge = (element: string | null, animal: string) => {
    const e = element && t.has(`zodiac.elements.${element}`) ? t(`zodiac.elements.${element}`) : element ?? "";
    const a = t.has(`zodiac.animals.${animal}`) ? t(`zodiac.animals.${animal}`) : animal;
    return t("fortune.badge", { element: e, animal: a });
  };
  const { luckyPhrase } = fortune ? parseFortune(fortune.fortune) : { luckyPhrase: null };

  const content = (
    <div className="fortune-modal-backdrop" onClick={onClose}>
      <div
        className="fortune-modal-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fortune-title"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="fortune-modal-close"
          aria-label={t("fortune.close")}
        >
          &times;
        </button>

        {/* Loading State */}
        {state === "loading" && (
          <div className="fortune-loading">
            <img
              src="/cny/horse.svg"
              alt={t("loading")}
              className="fortune-horse-loading"
            />
            <p className="fortune-loading-text">
              {t("fortune.consulting", { name: firstName })}
            </p>
            <p className="fortune-loading-subtext">
              {t("fortune.awaits")}
            </p>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="fortune-error">
            <p className="fortune-error-text">
              {t("fortune.resting")}
            </p>
            <p className="fortune-error-message">{error}</p>
            <button onClick={fetchFortune} className="fortune-retry-button">
              {t("fortune.tryAgain")}
            </button>
          </div>
        )}

        {/* Success State */}
        {state === "success" && fortune && (
          <div className="fortune-content">
            <h2 id="fortune-title" className="fortune-title">
              {t("fortune.title")}
            </h2>

            {fortune.zodiac && (
              <div className="fortune-zodiac-badge">
                {badge(fortune.element, fortune.zodiac)}
              </div>
            )}

            <div
              className="fortune-text"
              dangerouslySetInnerHTML={{
                __html: formatDisplayedText(displayedText),
              }}
            />

            {/* Show cursor while typing */}
            {isTyping && <span className="fortune-typewriter-cursor" />}

            {/* Show shareable card after typing completes */}
            {!isTyping && luckyPhrase && (
              <div className="fortune-card">
                <div className="fortune-card-header">
                  <span className="fortune-card-name">{name}</span>
                  {fortune.zodiac && (
                    <span className="fortune-card-zodiac">
                      {badge(fortune.element, fortune.zodiac)}
                    </span>
                  )}
                </div>
                <div className="fortune-card-phrase">{luckyPhrase.chinese}</div>
                <div className="fortune-card-phrase-meaning">
                  {luckyPhrase.pinyin} - {luckyPhrase.meaning}
                </div>
                <div className="fortune-card-year">
                  {t("fortune.year")}
                </div>
              </div>
            )}

            {/* Close button appears after typing */}
            {!isTyping && (
              <button onClick={onClose} className="fortune-close-button">
                {t("fortune.close")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
