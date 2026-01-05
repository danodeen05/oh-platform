import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-01-27.acacia',
  });
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events for payment confirmation
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    console.error('Stripe webhook: Missing signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Stripe webhook: STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe webhook signature verification failed:', message);
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment canceled: ${paymentIntent.id}`);
        // Optional: Update order status if needed
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handler error:', error);
    // Return 200 to acknowledge receipt (Stripe will retry on 4xx/5xx)
    // Log the error but don't fail the webhook
    return NextResponse.json({ received: true, error: 'Handler error logged' });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  console.log(`Payment succeeded: ${paymentIntent.id}`, metadata);

  // Handle food order payment
  if (metadata.orderId && metadata.source !== 'shop' && metadata.source !== 'gift_card') {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${metadata.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'PAID',
          stripePaymentId: paymentIntent.id,
          status: 'PAID',
        }),
      });

      if (!response.ok) {
        console.error(`Failed to update order ${metadata.orderId}:`, await response.text());
      } else {
        console.log(`Order ${metadata.orderId} marked as PAID via webhook`);
      }
    } catch (error) {
      console.error(`Error updating order ${metadata.orderId}:`, error);
    }
  }

  // Handle shop order payment
  if (metadata.shopOrderId) {
    try {
      const response = await fetch(`${API_BASE_URL}/shop/orders/${metadata.shopOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'PAID',
          stripePaymentId: paymentIntent.id,
        }),
      });

      if (!response.ok) {
        console.error(`Failed to update shop order ${metadata.shopOrderId}:`, await response.text());
      } else {
        console.log(`Shop order ${metadata.shopOrderId} marked as PAID via webhook`);
      }
    } catch (error) {
      console.error(`Error updating shop order ${metadata.shopOrderId}:`, error);
    }
  }

  // Handle gift card purchase
  if (metadata.source === 'gift_card' && metadata.giftCardId) {
    try {
      const response = await fetch(`${API_BASE_URL}/gift-cards/${metadata.giftCardId}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripePaymentId: paymentIntent.id,
        }),
      });

      if (!response.ok) {
        console.error(`Failed to confirm gift card ${metadata.giftCardId}:`, await response.text());
      } else {
        console.log(`Gift card ${metadata.giftCardId} payment confirmed via webhook`);
      }
    } catch (error) {
      console.error(`Error confirming gift card ${metadata.giftCardId}:`, error);
    }
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  const errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
  console.log(`Payment failed: ${paymentIntent.id}`, errorMessage, metadata);

  // Handle food order payment failure
  if (metadata.orderId && metadata.source !== 'shop' && metadata.source !== 'gift_card') {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${metadata.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'FAILED',
        }),
      });

      if (!response.ok) {
        console.error(`Failed to update order ${metadata.orderId} as failed:`, await response.text());
      }
    } catch (error) {
      console.error(`Error updating order ${metadata.orderId} as failed:`, error);
    }
  }

  // Handle shop order payment failure
  if (metadata.shopOrderId) {
    try {
      const response = await fetch(`${API_BASE_URL}/shop/orders/${metadata.shopOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'FAILED',
        }),
      });

      if (!response.ok) {
        console.error(`Failed to update shop order ${metadata.shopOrderId} as failed:`, await response.text());
      }
    } catch (error) {
      console.error(`Error updating shop order ${metadata.shopOrderId} as failed:`, error);
    }
  }
}
