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

/**
 * POST /api/kiosk/payments/create-intent
 * Create a PaymentIntent for kiosk order with card_present payment method
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, amountCents, locationId } = body;

    if (!orderId || !amountCents) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, amountCents' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Create PaymentIntent for Stripe Terminal (card_present)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      metadata: {
        orderId,
        locationId: locationId || '',
        source: 'kiosk',
      },
    });

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error('Failed to create PaymentIntent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment' },
      { status: 500 }
    );
  }
}
