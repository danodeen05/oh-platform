import { NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * POST /api/kiosk/payments/cancel-reader
 * Cancel any in-progress action on the terminal reader
 */
export async function POST() {
  try {
    const readerId = process.env.STRIPE_TERMINAL_READER_ID;

    if (!readerId) {
      return NextResponse.json({ success: true, message: 'No reader configured' });
    }

    const stripe = getStripe();

    try {
      await stripe.terminal.readers.cancelAction(readerId);
      return NextResponse.json({ success: true, message: 'Reader action canceled' });
    } catch (e) {
      // No action in progress - that's fine
      return NextResponse.json({ success: true, message: 'No action to cancel' });
    }
  } catch (error) {
    console.error('Failed to cancel reader action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel reader' },
      { status: 500 }
    );
  }
}
