import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

/**
 * POST /api/kiosk/payments/[paymentIntentId]/cancel
 * Cancel a PaymentIntent (e.g., when customer backs out)
 */
export async function POST(
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

    // Cancel the reader action if in progress
    const readerId = process.env.STRIPE_TERMINAL_READER_ID;
    if (readerId) {
      try {
        await stripe.terminal.readers.cancelAction(readerId);
      } catch (e) {
        // Ignore errors - action may not be in progress
        console.log('No reader action to cancel');
      }
    }

    // Cancel the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    return NextResponse.json({
      success: true,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error('Failed to cancel payment:', error);

    // If already canceled or succeeded, that's fine
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      if (error.message.includes('cannot be canceled')) {
        return NextResponse.json({
          success: true,
          status: 'already_processed',
        });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel payment' },
      { status: 500 }
    );
  }
}
