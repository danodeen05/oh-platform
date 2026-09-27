import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';

/**
 * POST /api/kiosk/payments/create-intent
 * Create a card_present PaymentIntent for the Stripe Terminal S700.
 *
 * The amount is computed by the API from the orders themselves (their
 * server-quoted amountDueCents), never taken from the kiosk screen: this route
 * forwards the order ids and the device's kiosk key to
 * POST /kiosk/orders/payment-intent, which also sets metadata.orderIds so the
 * payment can be verified at POST /kiosk/orders/confirm-payment (Task A6).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderIds } = body;
    const ids: string[] = Array.isArray(orderIds) && orderIds.length ? orderIds : orderId ? [orderId] : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Missing required field: orderIds' }, { status: 400 });
    }

    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Kiosk device not authorized' }, { status: 401 });
    }

    const res = await fetch(`${API_URL}/kiosk/orders/payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify({ orderIds: ids, terminal: true }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json({ error: data.message || data.error || 'Failed to create payment' }, { status: res.status });
    }

    return NextResponse.json({
      paymentIntentId: data.paymentIntentId,
      clientSecret: data.clientSecret,
      status: data.status,
      amountCents: data.amountCents,
    });
  } catch (error) {
    console.error('Failed to create PaymentIntent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment' },
      { status: 500 }
    );
  }
}
