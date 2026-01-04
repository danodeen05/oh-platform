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
  /** Scale factor for keyboard size (default 1.0, use 1.15 for 15% larger) */
  scale?: number;
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
  scale = 1,
}: VirtualKeyboardProps) {
  // Scale helper for sizing
  const s = (px: number) => Math.round(px * scale);
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
    <div style={{ width: '100%', maxWidth: s(900) }}>
      {/* Input display - only shown if showInput is true */}
      {showInput && (
        <div
          style={{
            background: COLORS.surface,
            border: `${s(3)}px solid ${COLORS.primary}`,
            borderRadius: s(16),
            padding: `${s(20)}px ${s(24)}px`,
            marginBottom: s(24),
            minHeight: s(72),
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
          borderRadius: s(20),
          padding: s(16),
          display: 'flex',
          flexDirection: 'column',
          gap: s(10),
        }}
      >
        {/* Number row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: s(8) }}>
          {KEYBOARD_ROWS[0].map((key) => (
            <KeyButton key={key} onClick={() => handleKeyPress(key)} scale={scale}>
              {key}
            </KeyButton>
          ))}
        </div>

        {/* QWERTY row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: s(8) }}>
          {KEYBOARD_ROWS[1].map((key) => (
            <KeyButton key={key} onClick={() => handleKeyPress(key)} scale={scale}>
              {key}
            </KeyButton>
          ))}
        </div>

        {/* ASDF row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: s(8) }}>
          {KEYBOARD_ROWS[2].map((key) => (
            <KeyButton key={key} onClick={() => handleKeyPress(key)} scale={scale}>
              {key}
            </KeyButton>
          ))}
        </div>

        {/* ZXCV row with shift */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: s(8) }}>
          {KEYBOARD_ROWS[3].map((key) => (
            <KeyButton key={key} onClick={() => handleKeyPress(key)} scale={scale}>
              {key}
            </KeyButton>
          ))}
          <KeyButton onClick={handleBackspace} width={s(80)} scale={scale}>
            <svg width={s(24)} height={s(24)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </KeyButton>
        </div>

        {/* Bottom row - space bar and actions */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: s(8), marginTop: s(4) }}>
          <KeyButton onClick={handleClear} width={s(100)} scale={scale}>
            Clear
          </KeyButton>
          <KeyButton onClick={handleSpace} width={s(400)} scale={scale}>
            Space
          </KeyButton>
          {onSubmit && (
            <KeyButton
              onClick={onSubmit}
              width={s(120)}
              scale={scale}
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
  width,
  primary = false,
  active = false,
  disabled = false,
  scale = 1,
}: {
  children: React.ReactNode;
  onClick: () => void;
  width?: number;
  primary?: boolean;
  active?: boolean;
  disabled?: boolean;
  scale?: number;
}) {
  const s = (px: number) => Math.round(px * scale);
  const buttonWidth = width ?? s(64);
  const buttonHeight = s(64);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: buttonWidth,
        height: buttonHeight,
        borderRadius: s(12),
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
