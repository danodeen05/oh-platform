import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { confirmFromWebhook } from '@/lib/site/orders';

/** A confirm call that failed in a way a redelivery can fix (network, API 5xx). */
class RetryableWebhookError extends Error {}

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
    if (error instanceof RetryableWebhookError) {
      // A payment may be charged but not yet recorded: make Stripe retry.
      console.error('Stripe webhook: retryable confirm failure:', error.message);
      return NextResponse.json({ received: false, error: 'Confirm failed, retry' }, { status: 503 });
    }
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

  // Food orders, host-paid groups (Task A7), shop orders and gift cards
  // (Task D10a): the API re-retrieves the PaymentIntent, checks status, amount
  // and metadata itself, and settles once (idempotent with the return page).
  // Shop orders go to POST /shop/orders/:id/confirm-payment (metadata
  // {kind:"shop", shopOrderId}); gift cards to POST /gift-cards/confirm-payment,
  // which finds the card by its PaymentIntent or issues it from the server-built
  // metadata. A retryable failure (network, API 5xx) throws so Stripe delivers
  // the event again; a verified refusal or "already paid" is final.
  const result = await confirmFromWebhook(paymentIntent, { baseUrl: API_BASE_URL, serviceKey: process.env.ADMIN_API_KEY || null });
  if (result.handled) {
    if (result.ok) console.log(`${result.handled} payment ${paymentIntent.id} confirmed via webhook`);
    else console.error(`Failed to confirm ${result.handled} payment ${paymentIntent.id}:`, result.status, result.code);
    if (result.retry) throw new RetryableWebhookError(`${result.handled} confirm failed with ${result.status}`);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  const errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
  console.log(`Payment failed: ${paymentIntent.id}`, errorMessage, metadata);

  // Food order payment failure: nothing to write. The order stays unpaid
  // (PENDING) and the customer can retry; payment status is server-owned and
  // no longer settable through PATCH /orders/:id (Task A6).
  if (metadata.orderId && metadata.source !== 'shop' && metadata.source !== 'gift_card') {
    console.log(`Food order ${metadata.orderId} payment failed; order left unpaid for retry`);
  }
}
