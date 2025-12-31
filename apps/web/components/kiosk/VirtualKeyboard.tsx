'use client';

import { useCallback } from 'react';

// Kiosk color system
const COLORS = {
  primary: "#7C7A67",
  primaryLight: "rgba(124, 122, 103, 0.15)",
  surface: "#FFFFFF",
  surfaceElevated: "#F5F5F5",
  text: "#1a1a1a",
  textMuted: "#999999",
  textOnPrimary: "#FFFFFF",
  border: "#e5e5e5",
};

interface VirtualKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  placeholder?: string;
  /** Hide the built-in input display (when parent renders its own) */
  showInput?: boolean;
}

// QWERTY keyboard layout
const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

/**
 * Virtual keyboard component for kiosk touch input
 * QWERTY layout with space, backspace, and clear
 */
export function VirtualKeyboard({
  value,
  onChange,
  onSubmit,
  maxLength = 30,
  placeholder = "Enter text...",
  showInput = true,
}: VirtualKeyboardProps) {
  const handleKeyPress = useCallback((key: string) => {
    if (value.length >= maxLength) return;
    onChange(value + key.toUpperCase());
  }, [value, onChange, maxLength]);

  const handleBackspace = useCallback(() => {
    onChange(value.slice(0, -1));
  }, [value, onChange]);

  const handleSpace = useCallback(() => {
    if (value.length >= maxLength) return;
    onChange(value + ' ');
  }, [value, onChange, maxLength]);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div style={{ width: '100%', maxWidth: 900 }}>
      {/* Input display - only shown if showInput is true */}
      {showInput && (
        <div
          style={{
            background: COLORS.surface,
            border: `3px solid ${COLORS.primary}`,
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 24,
            minHeight: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: '2rem',
              fontWeight: 600,
              color: value ? COLORS.text : COLORS.textMuted,
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}
          >
            {value || placeholder}
          </span>
          {value && (
            <span
              style={{
                display: 'inline-block',
                width: 3,
                height: '1.5em',
                background: COLORS.primary,
                marginLeft: 2,
                animation: 'blink 1s infinite',
              }}
            />
          )}
        </div>
      )}

      {/* Keyboard */}
      <div
        style={{
          background: COLORS.surfaceElevated,
          borderRadius: 20,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Number row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {KEYBOARD_ROWS[0].map((key) => (
            <KeyButton key={key} onClick={() => handleKeyPress(key)}>
              {key}
            </KeyButton>
          ))}
        </div>

        {/* QWERTY row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {KEYBOARD_ROWS[1].map((key) => (
            <KeyButton key={key} onClick={() => handleKeyPress(key)}>
              {key}
            </KeyButton>
          ))}
        </div>

        {/* ASDF row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {KEYBOARD_ROWS[2].map((key) => (
            <KeyButton key={key} onClick={() => handleKeyPress(key)}>
              {key}
            </KeyButton>
          ))}
        </div>

        {/* ZXCV row with shift */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {KEYBOARD_ROWS[3].map((key) => (
            <KeyButton key={key} onClick={() => handleKeyPress(key)}>
              {key}
            </KeyButton>
          ))}
          <KeyButton onClick={handleBackspace} width={80}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </KeyButton>
        </div>

        {/* Bottom row - space bar and actions */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <KeyButton onClick={handleClear} width={100}>
            Clear
          </KeyButton>
          <KeyButton onClick={handleSpace} width={400}>
            Space
          </KeyButton>
          {onSubmit && (
            <KeyButton
              onClick={onSubmit}
              width={120}
              primary
              disabled={!value.trim()}
            >
              Continue
            </KeyButton>
          )}
        </div>
      </div>

      {/* Blinking cursor animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Individual key button component
function KeyButton({
  children,
  onClick,
  width = 64,
  primary = false,
  active = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  width?: number;
  primary?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width,
        height: 64,
        borderRadius: 12,
        border: 'none',
        background: disabled
          ? '#ccc'
          : primary
          ? COLORS.primary
          : active
          ? COLORS.primaryLight
          : COLORS.surface,
        color: disabled
          ? COLORS.textMuted
          : primary
          ? COLORS.textOnPrimary
          : COLORS.text,
        fontSize: '1.25rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.1s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: active ? `2px solid ${COLORS.primary}` : 'none',
      }}
    >
      {children}
    </button>
  );
}

export default VirtualKeyboard;
