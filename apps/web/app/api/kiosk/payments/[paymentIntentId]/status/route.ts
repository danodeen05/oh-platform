import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

/**
 * GET /api/kiosk/payments/[paymentIntentId]/status
 * Check the status of a PaymentIntent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentIntentId: string }> }
) {
  try {
    const { paymentIntentId } = await params;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing paymentIntentId' },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return NextResponse.json({
      status: paymentIntent.status,
      amountReceived: paymentIntent.amount_received,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
    });
  } catch (error) {
    console.error('Failed to get payment status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get payment status' },
      { status: 500 }
    );
  }
}
