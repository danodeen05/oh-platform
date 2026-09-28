'use client';

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { ReactNode, useMemo } from 'react';

// Singleton promise for Stripe instance
let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export interface StripeProviderProps {
  children: ReactNode;
  clientSecret?: string;
  appearance?: {
    theme?: 'stripe' | 'night' | 'flat';
    variables?: Record<string, string>;
    rules?: Record<string, Record<string, string>>;
  };
}

/**
 * Shared Stripe Elements provider
 * Wraps children with Stripe context for payment forms
 *
 * Usage without clientSecret (for setup):
 * <StripeProvider>
 *   <CardElement />
 * </StripeProvider>
 *
 * Usage with clientSecret (for PaymentIntent):
 * <StripeProvider clientSecret={clientSecret}>
 *   <PaymentElement />
 * </StripeProvider>
 */
export function StripeProvider({ children, clientSecret, appearance }: StripeProviderProps) {
  const stripePromiseValue = useMemo(() => getStripe(), []);

  // Default appearance matching the site's aesthetic
  const defaultAppearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#7C7A67', // Oh! brand olive color
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#ef4444',
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      '.Input:focus': {
        border: '1px solid #7C7A67',
        boxShadow: '0 0 0 1px #7C7A67',
      },
      '.Label': {
        fontWeight: '500',
        fontSize: '14px',
      },
      '.Tab': {
        border: '1px solid #e5e7eb',
      },
      '.Tab--selected': {
        borderColor: '#7C7A67',
        backgroundColor: '#f9fafb',
      },
    },
  };

  const finalAppearance = appearance ? { ...defaultAppearance, ...appearance } : defaultAppearance;

  if (clientSecret) {
    return (
      <Elements
        stripe={stripePromiseValue}
        options={{
          clientSecret,
          appearance: finalAppearance,
          loader: 'auto',
        }}
      >
        {children}
      </Elements>
    );
  }

  return (
    <Elements
      stripe={stripePromiseValue}
      options={{
        appearance: finalAppearance,
      }}
    >
      {children}
    </Elements>
  );
}

export default StripeProvider;
