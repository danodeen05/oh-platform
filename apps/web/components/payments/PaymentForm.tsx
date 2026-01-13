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
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [selectedSavedMethod, setSelectedSavedMethod] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const [expressCheckoutReady, setExpressCheckoutReady] = useState(false);

  // Notify parent of processing state changes
  useEffect(() => {
    onProcessingChange?.(processing);
  }, [processing, onProcessingChange]);

  // Format amount for display
  const formattedAmount = `$${(amountCents / 100).toFixed(2)}`;
  const buttonText = submitButtonText || `Pay ${formattedAmount}`;

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
          throw new Error('Selected payment method not found');
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
          throw new Error(error.message || 'Payment failed');
        }

        if (paymentIntent?.status === 'succeeded') {
          onSuccess(paymentIntent.id);
          return;
        }

        if (paymentIntent?.status === 'requires_action') {
          // 3D Secure or other action required - Stripe will handle redirect
          return;
        }

        throw new Error('Unexpected payment status');
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
        throw new Error(error.message || 'Payment failed');
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent.id);
        return;
      }

      if (paymentIntent?.status === 'requires_action') {
        // 3D Secure or other action required - Stripe will handle redirect
        return;
      }

      throw new Error('Unexpected payment status');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
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
          throw new Error(error.message || 'Payment failed');
        }

        if (paymentIntent?.status === 'succeeded') {
          onSuccess(paymentIntent.id);
          return;
        }

        if (paymentIntent?.status === 'requires_action') {
          // Handle 3D Secure
          return;
        }

        throw new Error('Unexpected payment status');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        onError(message);
      } finally {
        setProcessing(false);
      }
    },
    [stripe, elements, returnUrl, onSuccess, onError]
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
    <form onSubmit={handleSubmit}>
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
              <div className="flex-1 h-px bg-gray-200" />
              <span className="px-4 text-sm text-gray-500">Or pay with card</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}
        </div>
      )}

      {/* Saved Payment Methods */}
      {savedPaymentMethods.length > 0 && (
        <div className="mb-6">
          <p className="font-medium text-gray-900 mb-3">Saved Cards</p>
          <div className="space-y-2">
            {savedPaymentMethods.map((method) => (
              <label
                key={method.id}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedSavedMethod === method.id
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
                    {getBrandDisplay(method.brand)} ending in {method.last4}
                  </span>
                  {method.expiryMonth && method.expiryYear && (
                    <span className="text-gray-500 ml-2">
                      {String(method.expiryMonth).padStart(2, '0')}/{String(method.expiryYear).slice(-2)}
                    </span>
                  )}
                  {method.isDefault && (
                    <span className="ml-2 text-xs text-[#7C7A67] font-medium">Default</span>
                  )}
                </span>
              </label>
            ))}

            {/* Option to use new card */}
            <label
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedSavedMethod === null
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
              <span className="ml-3 font-medium">Use a new card</span>
            </label>
          </div>
        </div>
      )}

      {/* New Card Form (hidden if using saved method) */}
      {selectedSavedMethod === null && (
        <>
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
          {showSaveCard && (
            <label className="flex items-center mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={saveCard}
                onChange={(e) => setSaveCard(e.target.checked)}
                className="w-4 h-4 text-[#7C7A67] rounded focus:ring-[#7C7A67] border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-600">
                Save this card for future purchases
              </span>
            </label>
          )}
        </>
      )}

      {/* Submit Button */}
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
        {processing ? "Processing..." : buttonText}
      </button>
    </form>
  );
}

export default PaymentForm;
