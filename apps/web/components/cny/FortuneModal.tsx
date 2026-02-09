"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

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
      // Check if this is the lucky phrase section
      if (title.toLowerCase().includes("lucky phrase")) {
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
        body: JSON.stringify({ name, phone, birthdate }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate fortune");
      }

      const data: FortuneResponse = await response.json();
      setFortune(data);
      setState("success");
      setIsTyping(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }, [name, phone, birthdate]);

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
          aria-label="Close"
        >
          &times;
        </button>

        {/* Loading State */}
        {state === "loading" && (
          <div className="fortune-loading">
            <img
              src="/cny/horse.svg"
              alt="Loading..."
              className="fortune-horse-loading"
            />
            <p className="fortune-loading-text">
              Consulting the stars for {firstName}...
            </p>
            <p className="fortune-loading-subtext">
              The Year of the Horse awaits
            </p>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="fortune-error">
            <p className="fortune-error-text">
              The fortune spirits are resting...
            </p>
            <p className="fortune-error-message">{error}</p>
            <button onClick={fetchFortune} className="fortune-retry-button">
              Try Again
            </button>
          </div>
        )}

        {/* Success State */}
        {state === "success" && fortune && (
          <div className="fortune-content">
            <h2 id="fortune-title" className="fortune-title">
              Your 2026 Fortune
            </h2>

            {fortune.zodiac && (
              <div className="fortune-zodiac-badge">
                {fortune.element} {fortune.zodiac}
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
                      {fortune.element} {fortune.zodiac}
                    </span>
                  )}
                </div>
                <div className="fortune-card-phrase">{luckyPhrase.chinese}</div>
                <div className="fortune-card-phrase-meaning">
                  {luckyPhrase.pinyin} - {luckyPhrase.meaning}
                </div>
                <div className="fortune-card-year">
                  Year of the Horse 2026
                </div>
              </div>
            )}

            {/* Close button appears after typing */}
            {!isTyping && (
              <button onClick={onClose} className="fortune-close-button">
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
