'use client';

import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export type PromoScope = 'MENU' | 'SHOP' | 'GIFT_CARD';

export interface AppliedPromo {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number;
  maxDiscountCents?: number;
  discountCents: number;
}

export interface PromoCodeInputProps {
  /** The checkout context for this promo code */
  scope: PromoScope;
  /** Order subtotal in cents (used for validation and discount calculation) */
  subtotalCents: number;
  /** User ID if authenticated */
  userId?: string;
  /** Guest ID if not authenticated */
  guestId?: string;
  /** Location ID for location-restricted promos */
  locationId?: string;
  /** Callback when a valid promo is applied */
  onApply: (promo: AppliedPromo) => void;
  /** Callback when promo is removed */
  onRemove: () => void;
  /** Currently applied promo code (for controlled state) */
  appliedPromo?: AppliedPromo | null;
  /** Shipping cost in cents (for FREE_SHIPPING display) */
  shippingCents?: number;
  /** Custom placeholder text */
  placeholder?: string;
  /** Disable the input */
  disabled?: boolean;
}

/**
 * Reusable promo code input component for checkout flows.
 * Handles validation, discount calculation, and state management.
 *
 * Usage:
 * ```tsx
 * <PromoCodeInput
 *   scope="SHOP"
 *   subtotalCents={5000}
 *   userId={user?.id}
 *   onApply={(promo) => setAppliedPromo(promo)}
 *   onRemove={() => setAppliedPromo(null)}
 *   appliedPromo={appliedPromo}
 * />
 * ```
 */
export function PromoCodeInput({
  scope,
  subtotalCents,
  userId,
  guestId,
  locationId,
  onApply,
  onRemove,
  appliedPromo,
  shippingCents = 0,
  placeholder = 'Enter promo code',
  disabled = false,
}: PromoCodeInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndApply = useCallback(async () => {
    if (!code.trim()) {
      setError('Please enter a promo code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/promo-codes/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          scope,
          userId,
          guestId,
          subtotalCents,
          locationId,
        }),
      });

      const data = await response.json();

      if (!data.valid) {
        setError(data.error || 'Invalid promo code');
        return;
      }

      // Calculate actual discount for FREE_SHIPPING
      let discountCents = data.discountCents;
      if (data.promoCode.discountType === 'FREE_SHIPPING') {
        discountCents = shippingCents;
      }

      onApply({
        id: data.promoCode.id,
        code: data.promoCode.code,
        discountType: data.promoCode.discountType,
        discountValue: data.promoCode.discountValue,
        maxDiscountCents: data.promoCode.maxDiscountCents,
        discountCents,
      });

      setCode('');
      setError(null);
    } catch (err) {
      console.error('Error validating promo code:', err);
      setError('Failed to validate promo code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [code, scope, userId, guestId, subtotalCents, locationId, shippingCents, onApply]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      validateAndApply();
    }
  };

  const handleRemove = () => {
    onRemove();
    setError(null);
  };

  const formatDiscount = (promo: AppliedPromo): string => {
    if (promo.discountType === 'FREE_SHIPPING') {
      return 'Free Shipping';
    }
    if (promo.discountType === 'PERCENTAGE') {
      const discount = `${promo.discountValue}% off`;
      if (promo.maxDiscountCents && promo.discountCents >= promo.maxDiscountCents) {
        return `${discount} (max $${(promo.maxDiscountCents / 100).toFixed(2)})`;
      }
      return discount;
    }
    return `$${(promo.discountCents / 100).toFixed(2)} off`;
  };

  // If a promo is already applied, show the applied state
  if (appliedPromo) {
    return (
      <div style={styles.container}>
        <div style={styles.appliedContainer}>
          <div style={styles.appliedInfo}>
            <div style={styles.appliedBadge}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span style={styles.appliedCode}>{appliedPromo.code}</span>
            </div>
            <div style={styles.discountText}>
              {formatDiscount(appliedPromo)}
              {appliedPromo.discountCents > 0 && appliedPromo.discountType !== 'FREE_SHIPPING' && (
                <span style={styles.savingsText}>
                  {' '}- You save ${(appliedPromo.discountCents / 100).toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            style={styles.removeButton}
            aria-label="Remove promo code"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.inputContainer}>
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          style={{
            ...styles.input,
            ...(error ? styles.inputError : {}),
          }}
          aria-label="Promo code"
          aria-invalid={!!error}
        />
        <button
          type="button"
          onClick={validateAndApply}
          disabled={disabled || loading || !code.trim()}
          style={{
            ...styles.applyButton,
            ...(disabled || loading || !code.trim() ? styles.applyButtonDisabled : {}),
          }}
        >
          {loading ? (
            <span style={styles.loadingSpinner} />
          ) : (
            'Apply'
          )}
        </button>
      </div>
      {error && (
        <div style={styles.errorText} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
  },
  inputContainer: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    fontFamily: 'inherit',
    letterSpacing: '0.5px',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  applyButton: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#5A5847',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, opacity 0.15s ease',
    minWidth: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorText: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#ef4444',
  },
  appliedContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
  },
  appliedInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  appliedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#166534',
  },
  appliedCode: {
    fontWeight: 600,
    fontSize: '14px',
    letterSpacing: '0.5px',
  },
  discountText: {
    fontSize: '13px',
    color: '#166534',
  },
  savingsText: {
    fontWeight: 500,
  },
  removeButton: {
    padding: '6px 12px',
    fontSize: '13px',
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  loadingSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #ffffff',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

// Add keyframes for loading spinner (injected via style tag)
if (typeof document !== 'undefined') {
  const styleId = 'promo-code-input-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

export default PromoCodeInput;
