import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

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

    const stripe = getStripe();

    // Helper to process with retry on busy
    const processWithRetry = async (maxRetries = 3): Promise<Stripe.Terminal.Reader> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Cancel any existing action first
        try {
          await stripe.terminal.readers.cancelAction(terminalReaderId);
          // Wait a moment for the cancel to fully process
          await new Promise(r => setTimeout(r, 300));
        } catch {
          // No action to cancel - that's fine
        }

        try {
          return await stripe.terminal.readers.processPaymentIntent(
            terminalReaderId,
            { payment_intent: paymentIntentId }
          );
        } catch (err) {
          const isLastAttempt = attempt === maxRetries - 1;
          const isBusyError = err instanceof Error && err.message.includes('busy');

          if (isBusyError && !isLastAttempt) {
            // Wait longer before retry
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          throw err;
        }
      }
      throw new Error('Failed to process after retries');
    };

    const reader = await processWithRetry();

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
