import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { kioskPaymentIntent } from '@/lib/site/orders';

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

    const res = await kioskPaymentIntent(ids, { baseUrl: API_URL, headers: { Authorization: authorization }, terminal: true });
    if (!res.ok) {
      return NextResponse.json({ error: res.error.message || res.error.code || 'Failed to create payment' }, { status: res.status || 502 });
    }

    return NextResponse.json({
      paymentIntentId: res.data.paymentIntentId,
      clientSecret: res.data.clientSecret,
      status: res.data.status,
      amountCents: res.data.amountCents,
    });
  } catch (error) {
    console.error('Failed to create PaymentIntent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment' },
      { status: 500 }
    );
  }
}
