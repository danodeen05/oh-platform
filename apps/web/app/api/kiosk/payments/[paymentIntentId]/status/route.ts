import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

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

    const stripe = getStripe();
    const readerId = process.env.STRIPE_TERMINAL_READER_ID;

    // Check both PaymentIntent and reader status for faster response
    const [paymentIntent, reader] = await Promise.all([
      stripe.paymentIntents.retrieve(paymentIntentId),
      readerId ? stripe.terminal.readers.retrieve(readerId) : null,
    ]);

    // Check if reader action failed (declined, canceled, etc.)
    let readerActionStatus = null;
    let readerActionError = null;
    if (reader?.action) {
      readerActionStatus = reader.action.status;
      if (reader.action.failure_code) {
        readerActionError = reader.action.failure_message || reader.action.failure_code;
      }
    }

    return NextResponse.json({
      status: paymentIntent.status,
      amountReceived: paymentIntent.amount_received,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
      readerActionStatus,
      readerActionError,
    });
  } catch (error) {
    console.error('Failed to get payment status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get payment status' },
      { status: 500 }
    );
  }
}
