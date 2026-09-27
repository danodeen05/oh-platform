import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { confirmPayment, groupConfirmPayment } from '@/lib/site/orders';

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

  // Host pays for the group (Task A7): one PaymentIntent for several orders.
  // The API re-verifies it (status, amount, metadata.orderIds, group) and
  // settles every order once; idempotent with the host's return page. The
  // route takes the host's session or a trusted service call, so without
  // ADMIN_API_KEY here the host's page is what confirms.
  if (metadata.kind === 'group' && metadata.groupCode) {
    const serviceKey = process.env.ADMIN_API_KEY;
    if (!serviceKey) {
      console.log(`Group payment ${paymentIntent.id}: no ADMIN_API_KEY, left to the host's confirmation`);
      return;
    }
    const res = await groupConfirmPayment(metadata.groupCode, paymentIntent.id, {
      baseUrl: API_BASE_URL,
      headers: { 'x-admin-api-key': serviceKey },
    });
    if (!res.ok) console.error(`Failed to confirm group ${metadata.groupCode}:`, res.status, res.error.code);
    return;
  }

  // Handle food order payment
  if (metadata.orderId && metadata.source !== 'shop' && metadata.source !== 'gift_card') {
    // The API re-retrieves the PaymentIntent and checks status, amount and
    // metadata.orderId itself; this call is idempotent with the return page.
    const res = await confirmPayment(metadata.orderId, paymentIntent.id, { baseUrl: API_BASE_URL });
    if (!res.ok) {
      console.error(`Failed to confirm order ${metadata.orderId}:`, res.status, res.error.code, res.error.refunded ? '(refunded)' : '');
    } else {
      console.log(`Order ${metadata.orderId} marked as PAID via webhook`);
    }
  }

  // Shop orders: no shop PaymentIntent carries metadata.shopOrderId, so the
  // old PATCH {paymentStatus: 'PAID'} branch never ran; it is gone (clients
  // never send paymentStatus). Verified shop payment is Task D10.

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

  // Food order payment failure: nothing to write. The order stays unpaid
  // (PENDING) and the customer can retry; payment status is server-owned and
  // no longer settable through PATCH /orders/:id (Task A6).
  if (metadata.orderId && metadata.source !== 'shop' && metadata.source !== 'gift_card') {
    console.log(`Food order ${metadata.orderId} payment failed; order left unpaid for retry`);
  }
}
