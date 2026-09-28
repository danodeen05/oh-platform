'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';

export interface SavedPaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  type: string;
  last4: string | null;
  brand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
}

/**
 * Visible strings (Task D5): the new order flow passes translated ones; the
 * legacy callers leave them out and keep the English defaults.
 */
export interface PaymentFormLabels {
  submit: string;
  processing: string;
  orPayWithCard: string;
  savedCards: string;
  useNewCard: string;
  cardEnding: (brand: string, last4: string) => string;
  defaultBadge: string;
  saveCard: string;
  failed: string;
}

export interface PaymentFormProps {
  amountCents: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onProcessingChange?: (processing: boolean) => void;
  showExpressCheckout?: boolean;
  showSaveCard?: boolean;
  savedPaymentMethods?: SavedPaymentMethod[];
  returnUrl: string;
  submitButtonText?: string;
  disabled?: boolean;
  labels?: Partial<PaymentFormLabels>;
  /**
   * Controlled "Save this card" (Task D5). When `onSaveCardChange` is given,
   * the checkbox shows above the card fields (so it's decided before the card
   * is typed) and the caller re-creates the PaymentIntent with
   * `savePaymentMethod` (the API sets setup_future_usage on it).
   */
  saveCard?: boolean;
  onSaveCardChange?: (save: boolean) => void;
  /** Lets a button elsewhere on the page submit this form (`<button form={formId}>`). */
  formId?: string;
  /** Hide the built-in submit button (the page renders its own with `form={formId}`). */
  hideSubmit?: boolean;
  /** Colors for the saved-card list and checkbox: "night" for the dark site. */
  tone?: 'light' | 'night';
}

/**
 * Reusable payment form component with:
 * - Express Checkout (Apple Pay, Google Pay, Link)
 * - Saved payment methods selection
 * - New card input with optional save
 * - Processing states and error handling
 *
 * Must be wrapped in StripeProvider with clientSecret
 */
export function PaymentForm({
  amountCents,
  onSuccess,
  onError,
  onProcessingChange,
  showExpressCheckout = true,
  showSaveCard = false,
  savedPaymentMethods = [],
  returnUrl,
  submitButtonText,
  disabled = false,
  labels,
  saveCard: saveCardProp,
  onSaveCardChange,
  formId,
  hideSubmit = false,
  tone = 'light',
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [selectedSavedMethod, setSelectedSavedMethod] = useState<string | null>(null);
  const [saveCardState, setSaveCardState] = useState(false);
  const controlledSave = typeof onSaveCardChange === 'function';
  const saveCard = controlledSave ? Boolean(saveCardProp) : saveCardState;
  const setSaveCard = controlledSave ? onSaveCardChange : setSaveCardState;
  const night = tone === 'night';
  const [expressCheckoutReady, setExpressCheckoutReady] = useState(false);

  // Notify parent of processing state changes
  useEffect(() => {
    onProcessingChange?.(processing);
  }, [processing, onProcessingChange]);

  // Format amount for display
  const formattedAmount = `$${(amountCents / 100).toFixed(2)}`;
  const buttonText = labels?.submit || submitButtonText || `Pay ${formattedAmount}`;
  const failedText = labels?.failed || 'Payment failed';

  // Handle standard form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || processing || disabled) return;

    setProcessing(true);

    try {
      // If using a saved payment method, confirm with that
      if (selectedSavedMethod) {
        const savedMethod = savedPaymentMethods.find(m => m.id === selectedSavedMethod);
        if (!savedMethod) {
          throw new Error(failedText);
        }

        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: returnUrl,
            payment_method: savedMethod.stripePaymentMethodId,
          },
          redirect: 'if_required',
        });

        if (error) {
          throw new Error(error.message || failedText);
        }

        if (paymentIntent?.status === 'succeeded') {
          onSuccess(paymentIntent.id);
          return;
        }

        if (paymentIntent?.status === 'requires_action') {
          // 3D Secure or other action required - Stripe will handle redirect
          return;
        }

        throw new Error(failedText);
      }

      // Standard payment with new card
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message || failedText);
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent.id);
        return;
      }

      if (paymentIntent?.status === 'requires_action') {
        // 3D Secure or other action required - Stripe will handle redirect
        return;
      }

      throw new Error(failedText);
    } catch (err) {
      const message = err instanceof Error ? err.message : failedText;
      onError(message);
    } finally {
      setProcessing(false);
    }
  };

  // Handle Express Checkout confirmation
  const handleExpressCheckoutConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) return;

      setProcessing(true);

      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: returnUrl,
          },
          redirect: 'if_required',
        });

        if (error) {
          throw new Error(error.message || failedText);
        }

        if (paymentIntent?.status === 'succeeded') {
          onSuccess(paymentIntent.id);
          return;
        }

        if (paymentIntent?.status === 'requires_action') {
          // Handle 3D Secure
          return;
        }

        throw new Error(failedText);
      } catch (err) {
        const message = err instanceof Error ? err.message : failedText;
        onError(message);
      } finally {
        setProcessing(false);
      }
    },
    [stripe, elements, returnUrl, onSuccess, onError, failedText]
  );

  // Get brand display name
  const getBrandDisplay = (brand: string | null) => {
    if (!brand) return 'Card';
    const brands: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
      diners: 'Diners Club',
      jcb: 'JCB',
      unionpay: 'UnionPay',
    };
    return brands[brand.toLowerCase()] || brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  return (
    <form id={formId} onSubmit={handleSubmit}>
      {/* Express Checkout (Apple Pay, Google Pay, Link) */}
      {showExpressCheckout && (
        <div className="mb-6">
          <ExpressCheckoutElement
            onConfirm={handleExpressCheckoutConfirm}
            onReady={() => setExpressCheckoutReady(true)}
            options={{
              buttonType: {
                applePay: 'plain',
                googlePay: 'plain',
              },
              layout: {
                maxColumns: 3,
                maxRows: 1,
              },
            }}
          />

          {expressCheckoutReady && (
            <div className="flex items-center my-6">
              <div className={night ? 'flex-1 h-px bg-oh-stone' : 'flex-1 h-px bg-gray-200'} />
              <span className={night ? 'px-4 text-sm text-oh-mute' : 'px-4 text-sm text-gray-500'}>{labels?.orPayWithCard || 'Or pay with card'}</span>
              <div className={night ? 'flex-1 h-px bg-oh-stone' : 'flex-1 h-px bg-gray-200'} />
            </div>
          )}
        </div>
      )}

      {/* Saved Payment Methods */}
      {savedPaymentMethods.length > 0 && (
        <div className="mb-6">
          <p className={night ? 'm-0 mb-3 font-semibold text-oh-cream' : 'font-medium text-gray-900 mb-3'}>{labels?.savedCards || 'Saved Cards'}</p>
          <div className="space-y-2">
            {savedPaymentMethods.map((method) => (
              <label
                key={method.id}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  night
                    ? selectedSavedMethod === method.id
                      ? 'min-h-12 rounded-2xl border-oh-ember-light bg-oh-stone/60 text-oh-cream'
                      : 'min-h-12 rounded-2xl border-oh-stone text-oh-cream hover:border-oh-mute'
                    : selectedSavedMethod === method.id
                      ? 'border-[#7C7A67] bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="savedPaymentMethod"
                  value={method.id}
                  checked={selectedSavedMethod === method.id}
                  onChange={() => setSelectedSavedMethod(method.id)}
                  className="w-4 h-4 text-[#7C7A67] focus:ring-[#7C7A67]"
                />
                <span className="ml-3 flex-1">
                  <span className="font-medium">
                    {labels?.cardEnding ? labels.cardEnding(getBrandDisplay(method.brand), method.last4 || '') : `${getBrandDisplay(method.brand)} ending in ${method.last4}`}
                  </span>
                  {method.expiryMonth && method.expiryYear && (
                    <span className={night ? 'text-oh-mute ml-2' : 'text-gray-500 ml-2'}>
                      {String(method.expiryMonth).padStart(2, '0')}/{String(method.expiryYear).slice(-2)}
                    </span>
                  )}
                  {method.isDefault && (
                    <span className={night ? 'ml-2 text-xs text-oh-gold font-medium' : 'ml-2 text-xs text-[#7C7A67] font-medium'}>{labels?.defaultBadge || 'Default'}</span>
                  )}
                </span>
              </label>
            ))}

            {/* Option to use new card */}
            <label
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                night
                  ? selectedSavedMethod === null
                    ? 'min-h-12 rounded-2xl border-oh-ember-light bg-oh-stone/60 text-oh-cream'
                    : 'min-h-12 rounded-2xl border-oh-stone text-oh-cream hover:border-oh-mute'
                  : selectedSavedMethod === null
                    ? 'border-[#7C7A67] bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="savedPaymentMethod"
                value=""
                checked={selectedSavedMethod === null}
                onChange={() => setSelectedSavedMethod(null)}
                className="w-4 h-4 text-[#7C7A67] focus:ring-[#7C7A67]"
              />
              <span className="ml-3 font-medium">{labels?.useNewCard || 'Use a new card'}</span>
            </label>
          </div>
        </div>
      )}

      {/* New Card Form (hidden if using saved method) */}
      {selectedSavedMethod === null && (
        <>
          {showSaveCard && controlledSave && (
            <label className={night ? 'mb-4 flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-oh-cream' : 'mb-4 flex cursor-pointer items-center gap-3 text-sm text-gray-600'}>
              <input
                type="checkbox"
                data-save-card
                checked={saveCard}
                onChange={(e) => setSaveCard(e.target.checked)}
                className={night ? 'h-5 w-5 shrink-0 accent-oh-ember-light' : 'h-4 w-4 accent-[#7C7A67]'}
              />
              <span>{labels?.saveCard || 'Save this card for future purchases'}</span>
            </label>
          )}
          <PaymentElement
            options={{
              layout: 'tabs',
              defaultValues: {
                billingDetails: {
                  address: {
                    country: 'US',
                  },
                },
              },
            }}
          />

          {/* Save card for future purchases */}
          {showSaveCard && !controlledSave && (
            <label style={{ display: 'flex', alignItems: 'center', marginTop: 16, cursor: 'pointer', gap: 12 }}>
              <input
                type="checkbox"
                checked={saveCard}
                onChange={(e) => setSaveCard(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#7C7A67' }}
              />
              <span style={{ fontSize: 14, color: '#4b5563' }}>
                {labels?.saveCard || 'Save this card for future purchases'}
              </span>
            </label>
          )}
        </>
      )}

      {/* Submit Button */}
      {!hideSubmit && (
      <button
        type="submit"
        disabled={!stripe || processing || disabled}
        style={{
          width: '100%',
          marginTop: '24px',
          padding: '16px 24px',
          borderRadius: '12px',
          fontSize: '18px',
          fontWeight: 'bold',
          border: 'none',
          cursor: !stripe || processing || disabled ? 'not-allowed' : 'pointer',
          backgroundColor: !stripe || processing || disabled ? '#d1d5db' : '#7C7A67',
          color: !stripe || processing || disabled ? '#6b7280' : 'white',
          transition: 'all 0.2s',
        }}
      >
        {processing ? labels?.processing || "Processing..." : buttonText}
      </button>
      )}
    </form>
  );
}

export default PaymentForm;
