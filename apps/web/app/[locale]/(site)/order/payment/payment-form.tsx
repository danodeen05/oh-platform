"use client";

/**
 * The pay step's client entry (Task D5): the Stripe Payment Element and
 * Express Checkout in the visitor's language, the "Save this card" choice
 * (sent as savePaymentMethod to POST /orders/:id/payment-intent), and the
 * server-verified confirm. See components/site/order/PayStep.tsx.
 */
import { PayStep } from "@/components/site/order/PayStep";

export default function OrderPaymentForm({ orderId, orderNumber }: { orderId: string | null; orderNumber: string | null }) {
  return <PayStep orderId={orderId} orderNumber={orderNumber} />;
}
