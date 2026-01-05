'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Kiosk color system
const COLORS = {
  primary: "#7C7A67",
  primaryLight: "rgba(124, 122, 103, 0.15)",
  surface: "#FFFFFF",
  surfaceElevated: "#FAFAFA",
  surfaceDark: "#1a1a1a",
  text: "#1a1a1a",
  textMuted: "#999999",
  textOnPrimary: "#FFFFFF",
  success: "#22c55e",
  successLight: "rgba(34, 197, 94, 0.1)",
  error: "#ef4444",
  errorLight: "rgba(239, 68, 68, 0.1)",
  warning: "#f59e0b",
};

type PaymentStatus =
  | 'idle'
  | 'initializing'
  | 'waiting_for_card'
  | 'processing'
  | 'success'
  | 'failed'
  | 'canceled';

interface PaymentScreenProps {
  orderId: string;
  amountCents: number;
  locationId?: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
  onError?: (error: string) => void;
}

/**
 * PaymentScreen component for Stripe Terminal S700 integration
 * Handles the full payment flow: create intent -> process on terminal -> poll for completion
 */
export function PaymentScreen({
  orderId,
  amountCents,
  locationId,
  onSuccess,
  onCancel,
  onError,
}: PaymentScreenProps) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const initiatedRef = useRef(false);

  // Format amount for display
  const formattedAmount = (amountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  // Poll for payment status
  const pollPaymentStatus = useCallback(async (intentId: string, maxAttempts = 60): Promise<{ status: string }> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`/api/kiosk/payments/${intentId}/status`);
        const data = await res.json();

        // Check if payment succeeded
        if (data.status === 'succeeded') {
          return data;
        }

        // Check if reader action failed (faster than waiting for PI status update)
        if (data.readerActionStatus === 'failed') {
          throw new Error(data.readerActionError || 'Card was declined');
        }

        // Check PaymentIntent status for cancellation
        if (data.status === 'canceled') {
          throw new Error('Payment was canceled');
        }

        // If reader has no action and PI still requires payment, it was declined
        if (data.readerActionStatus === null && data.status === 'requires_payment_method' && i > 2) {
          throw new Error('Card was declined - please try again');
        }

        // Wait 500ms before next poll (faster polling)
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        if (i === maxAttempts - 1) throw err;
        if (err instanceof Error && err.message.includes('declined')) throw err;
        if (err instanceof Error && err.message.includes('canceled')) throw err;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw new Error('Payment timeout - please try again');
  }, []);

  // Initiate payment flow
  const initiatePayment = useCallback(async (isRetry = false) => {
    // Prevent double-initiation (React StrictMode or unstable deps)
    if (!isRetry && initiatedRef.current) return;
    initiatedRef.current = true;

    try {
      setStatus('initializing');
      setError(null);

      // Step 1: Create PaymentIntent
      const intentRes = await fetch('/api/kiosk/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amountCents, locationId }),
      });

      if (!intentRes.ok) {
        const errorData = await intentRes.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      const { paymentIntentId: intentId } = await intentRes.json();
      setPaymentIntentId(intentId);

      // Step 2: Send to S700 reader
      setStatus('waiting_for_card');
      const processRes = await fetch('/api/kiosk/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: intentId }),
      });

      if (!processRes.ok) {
        const errorData = await processRes.json();
        throw new Error(errorData.error || 'Failed to connect to card reader');
      }

      // Step 3: Poll for completion
      setStatus('processing');
      const result = await pollPaymentStatus(intentId);

      if (result.status === 'succeeded') {
        setStatus('success');
        // Brief delay to show success state
        setTimeout(() => {
          onSuccess(intentId);
        }, 1500);
      } else {
        throw new Error('Payment was not completed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setStatus('failed');
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [orderId, amountCents, locationId, onSuccess, onError, pollPaymentStatus]);

  // Start payment on mount, cancel on unmount
  useEffect(() => {
    initiatePayment();

    // Cleanup: cancel reader action when component unmounts
    return () => {
      // Cancel reader action directly (fire-and-forget)
      fetch('/api/kiosk/payments/cancel-reader', { method: 'POST' }).catch(() => {});
    };
  }, [initiatePayment]);

  // Handle cancel
  const handleCancel = async () => {
    if (paymentIntentId) {
      try {
        await fetch(`/api/kiosk/payments/${paymentIntentId}/cancel`, {
          method: 'POST',
        });
      } catch (e) {
        console.warn('Failed to cancel payment:', e);
      }
    }
    setStatus('canceled');
    onCancel();
  };

  return (
    <div
      className="kiosk-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.surface,
        padding: 48,
      }}
    >
      {/* Amount display */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <p style={{ color: COLORS.textMuted, fontSize: '1.25rem', marginBottom: 8 }}>
          Total Amount
        </p>
        <p style={{ fontSize: '4rem', fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
          {formattedAmount}
        </p>
      </div>

      {/* Status card */}
      <div
        style={{
          background: COLORS.surfaceElevated,
          borderRadius: 28,
          padding: 56,
          textAlign: 'center',
          maxWidth: 500,
          minWidth: 400,
          border: `2px solid ${COLORS.primary}`,
        }}
      >
        {/* Initializing */}
        {status === 'initializing' && (
          <>
            <div style={{ fontSize: '5rem', marginBottom: 24 }} className="kiosk-pulse">
              ...
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>
              Preparing Payment
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: '1.125rem' }}>
              Please wait...
            </p>
          </>
        )}

        {/* Waiting for card */}
        {status === 'waiting_for_card' && (
          <>
            <div style={{ fontSize: '5rem', marginBottom: 24 }}>
              💳
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>
              Tap, Insert, or Swipe
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: '1.125rem', marginBottom: 24 }}>
              Use the card reader below
            </p>
            <div style={{ fontSize: '3rem' }} className="kiosk-bounce">
              ↓
            </div>
          </>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <>
            <div style={{ fontSize: '5rem', marginBottom: 24 }} className="kiosk-pulse">
              ⏳
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>
              Processing Payment
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: '1.125rem' }}>
              Please wait, do not remove your card...
            </p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                background: COLORS.successLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: COLORS.success, marginBottom: 12 }}>
              Payment Successful!
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: '1.125rem' }}>
              Redirecting...
            </p>
          </>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                background: COLORS.errorLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke={COLORS.error} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: COLORS.error, marginBottom: 12 }}>
              Payment Failed
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: '1.125rem', marginBottom: 24 }}>
              {error || 'Please try again'}
            </p>
            <button
              onClick={() => initiatePayment(true)}
              className="kiosk-btn kiosk-btn-primary"
              style={{ marginBottom: 12 }}
            >
              Try Again
            </button>
          </>
        )}
      </div>

      {/* Cancel button - show when waiting or failed */}
      {(status === 'waiting_for_card' || status === 'failed' || status === 'initializing') && (
        <button
          onClick={handleCancel}
          className="kiosk-btn kiosk-btn-ghost"
          style={{ marginTop: 32 }}
        >
          Cancel and Go Back
        </button>
      )}
    </div>
  );
}

export default PaymentScreen;
