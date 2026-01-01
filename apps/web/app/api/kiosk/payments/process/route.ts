import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

/**
 * POST /api/kiosk/payments/process
 * Send payment to Stripe Terminal S700 reader for processing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, readerId } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing required field: paymentIntentId' },
        { status: 400 }
      );
    }

    // Use the reader ID from request or environment variable
    const terminalReaderId = readerId || process.env.STRIPE_TERMINAL_READER_ID;

    if (!terminalReaderId) {
      return NextResponse.json(
        { error: 'No terminal reader configured' },
        { status: 400 }
      );
    }

    // Send payment to the S700 reader
    const reader = await stripe.terminal.readers.processPaymentIntent(
      terminalReaderId,
      { payment_intent: paymentIntentId }
    );

    return NextResponse.json({
      status: reader.action?.status,
      readerId: reader.id,
      readerStatus: reader.status,
    });
  } catch (error) {
    console.error('Failed to process payment on terminal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process payment' },
      { status: 500 }
    );
  }
}
