/**
 * Order, step 6: pay (Task D5). The order id comes from the flow (or the
 * group lobby, or an add-on on the status page); everything else, including
 * the amount, comes from the API at render time in OrderPaymentForm.
 */
import OrderPaymentForm from "./payment-form";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ orderId?: string; orderNumber?: string }> }) {
  const { orderId, orderNumber } = await searchParams;
  return <OrderPaymentForm orderId={orderId || null} orderNumber={orderNumber || null} />;
}
